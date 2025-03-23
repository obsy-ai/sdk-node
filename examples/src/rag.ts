import { ObsyClient, obsyExpress } from "@obsy-ai/sdk";
import { Pinecone } from "@pinecone-database/pinecone";
import "dotenv/config";
import express from "express";
import OpenAI from "openai";
import type { ChatCompletionChunk, ChatCompletionMessageParam } from "openai/resources/chat/completions";

// use zod instead of this shit
const env = {
  GROQ_API_KEY: process.env.GROQ_API_KEY!,

  OBSY_API_KEY: process.env.OBSY_API_KEY!,
  OBSY_PROJECT_ID: process.env.OBSY_PROJECT_ID!,

  PINECONE_API_KEY: process.env.PINECONE_API_KEY!,
  PINECONE_INDEX: process.env.PINECONE_INDEX!,
  PINECONE_NAMESPACE: process.env.PINECONE_NAMESPACE!,
};

const app = express();

app.use(express.json());

// initialize OpenAI client
const openai = new OpenAI({
  apiKey: env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

// initialize Pinecone client
const pinecone = new Pinecone({
  apiKey: env.PINECONE_API_KEY!,
});

// 1. initialize Obsy client with local server URL
const obsy = new ObsyClient({
  apiKey: env.OBSY_API_KEY!,
  projectId: env.OBSY_PROJECT_ID!,
});

// 2. instrument OpenAI and Pinecone clients
obsy.instrument(openai).instrument(pinecone);

// 3. enable tracing for each request
app.use(obsyExpress({ client: obsy }));

// store conversation history for RAG demo
let messageHistory: ChatCompletionMessageParam[] = [];

const pineconeNs = pinecone.index(env.PINECONE_INDEX!).namespace(env.PINECONE_NAMESPACE!);

app.post("/rag", async (req, res) => {
  const { message } = req.body;

  // add user message to history
  messageHistory.push({ role: "user", content: message });

  // generate search query using LLM
  const searchQueryResponse = await openai.chat.completions.create({
    messages: [
      {
        role: "system",
        content:
          "Generate a CONCISE search query, like how people search on Google, to find relevant information for the user's question. Focus on key terms and concepts. Just return the search query, no other text.",
      },
      ...messageHistory,
    ],
    model: "llama3-8b-8192",
    stream: false,
  });

  const searchQuery = searchQueryResponse.choices[0].message.content || "";

  // generate embeddings for the search query
  const embeddings = await pinecone.inference.embed("llama-text-embed-v2", [searchQuery], {
    inputType: "passage",
    truncate: "END",
  });

  const vector =
    embeddings.data[0].vectorType === "dense" ? embeddings.data[0].values : embeddings.data[0].sparseValues;

  // query Pinecone (retrieval)
  const results = await pineconeNs.query({
    vector,
    topK: 3,
    includeMetadata: true,
  });

  // finally "augment" the generation lol
  const docs = results.matches.map((match) => match.metadata?.text || "").join("\n\n");
  const finalResponseStream = await openai.chat.completions.create({
    messages: [
      {
        role: "system",
        content: `You are a helpful assistant. Answer the user's question based on the following context:\n\n${
          docs || "<NO CONTEXT AVAILABLE>"
        }\n\nIf the answer is not available in the context, say "I don't know".`,
      },
      ...messageHistory,
    ],
    model: "llama3-8b-8192",
    stream: true,
  });

  const chunks: ChatCompletionChunk[] = [];

  // set response headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  for await (const chunk of finalResponseStream) {
    // write it in EventStream format
    res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    chunks.push(chunk);
  }

  res.end();

  // merge chunks and add to history
  messageHistory.push({
    role: "assistant",
    content: chunks.map((c) => c.choices[0].delta.content).join(""),
  });
});

app.get("/", (req, res) => {
  res.sendFile(path.resolve(import.meta.dirname, "./index.html"));
});

const PORT = 6969;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// the following code is just for you to generate embeddings from the kb.txt file
// and store them in Pinecone

import fs from "node:fs/promises";
import path from "node:path";

async function consume(filePath: string) {
  try {
    // Read file content
    const fileContent = await fs.readFile(filePath, "utf-8");

    // Split into paragraphs (split on double newline)
    const paragraphs = fileContent.split(/\n\s*\n/).filter((p) => p.trim());

    // Process each paragraph
    for (let i = 0; i < paragraphs.length; i += 4) {
      let paragraph = paragraphs[i];
      for (let j = 1; j < 4; j++) {
        if (paragraphs[i + j]) {
          paragraph += `\n\n${paragraphs[i + j]}`;
        }
      }

      // generate embeddings docs: https://docs.pinecone.io/guides/inference/generate-embeddings
      const embeddings = await pinecone.inference.embed("llama-text-embed-v2", [paragraph], {
        inputType: "passage",
        truncate: "END",
      });

      const vector =
        embeddings.data[0].vectorType === "dense" ? embeddings.data[0].values : embeddings.data[0].sparseValues;

      // Store in Pinecone
      await pineconeNs.upsert([
        {
          id: `doc_${i}`,
          values: vector,

          metadata: {
            text: paragraph,
            source: filePath,
          },
        },
      ]);

      console.log(`Processed paragraph ${i + 1} of ${paragraphs.length}`);
    }

    console.log("File processing complete");
  } catch (error) {
    console.error("Error processing file:", error);
    throw error;
  }
}

// const kb = path.join(import.meta.dirname, "./kb.txt");
// consume(kb);
