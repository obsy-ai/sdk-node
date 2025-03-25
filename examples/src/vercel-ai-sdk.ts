import { openai } from "@ai-sdk/openai";
import { ObsyClient, obsyExpress } from "@obsy-ai/sdk";
import { generateObject as aiGenerateObject, generateText as aiGenerateText, streamText as aiStreamText } from "ai";
import "dotenv/config";
import express from "express";
import { z } from "zod";

const app = express();

const env = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY!,

  OBSY_API_KEY: process.env.OBSY_API_KEY!,
  OBSY_PROJECT_ID: process.env.OBSY_PROJECT_ID!,
};

app.use(express.json());

// 1. initialize Obsy client with local server URL
const obsy = new ObsyClient({
  apiKey: env.OBSY_API_KEY!,
  projectId: env.OBSY_PROJECT_ID!,
});

// 2. instrument functions from Vercel AI SDK
const { generateText, streamText, generateObject } = obsy.instrumentVercelAI({
  generateText: aiGenerateText,
  streamText: aiStreamText,
  generateObject: aiGenerateObject,
});

// 3. enable tracing for each request
app.use(obsyExpress({ client: obsy }));

app.post("/generate-text", async (req, res) => {
  const { message } = req.body;

  const result = await generateText({
    model: openai("gpt-4o-mini"),
    prompt: message,
  });

  res.json(result);
});

app.post("/stream-text", async (req, res) => {
  const { message } = req.body;

  const result = streamText({
    model: openai("gpt-4o-mini"),
    prompt: message,
  });

  for await (const chunk of result.textStream) {
    res.write(chunk);
  }

  res.end();
});

app.post("/generate-object", async (req, res) => {
  const { foodItem } = req.body;

  const result = await generateObject({
    model: openai("gpt-4-turbo"),
    schema: z.object({
      recipe: z.object({
        name: z.string(),
        ingredients: z.array(
          z.object({
            name: z.string(),
            amount: z.string(),
          })
        ),
        steps: z.array(z.string()),
      }),
    }),
    prompt: `Generate a recipe for ${foodItem}.`,
  });

  res.json(result);
});

const PORT = 6969;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
