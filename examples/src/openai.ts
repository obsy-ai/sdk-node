import { ObsyClient, obsyExpress } from "@obsy-ai/sdk";
import "dotenv/config";
import express from "express";
import OpenAI from "openai";

// use zod instead of this shit
const env = {
  GROQ_API_KEY: process.env.GROQ_API_KEY!,

  OBSY_API_KEY: process.env.OBSY_API_KEY!,
  OBSY_PROJECT_ID: process.env.OBSY_PROJECT_ID!,
};

const openai = new OpenAI({
  apiKey: env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

const app = express();

app.use(express.json());

// 1. create Obsy client
const obsy = new ObsyClient({
  apiKey: env.OBSY_API_KEY!,
  projectId: env.OBSY_PROJECT_ID!,
});

// 2. instrument OpenAI and Pinecone clients
obsy.instrument(openai);

// 3. enable tracing for each request
app.use(obsyExpress({ client: obsy }));

app.post("/chat", async (req, res) => {
  const { message } = req.body;
  if (!message) {
    res.status(400).json({ error: "no message provided" });
    return;
  }

  const response = await openai.chat.completions.create({
    messages: [{ role: "user", content: message }],
    model: "llama3-8b-8192",
    stream: true, // supports both streaming and non-streaming requests
  });

  for await (const chunk of response) {
    res.write(JSON.stringify(chunk));
  }

  res.end();
});

const PORT = 6969;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
