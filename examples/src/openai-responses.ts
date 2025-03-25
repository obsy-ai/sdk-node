import { ObsyClient, obsyExpress } from "@obsy-ai/sdk";
import "dotenv/config";
import express from "express";
import OpenAI from "openai";

// use zod instead of this shit
const env = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY!,
  OBSY_API_KEY: process.env.OBSY_API_KEY!,
  OBSY_PROJECT_ID: process.env.OBSY_PROJECT_ID!,
};

const app = express();

app.use(express.json());

const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

// 1. create Obsy client
const obsy = new ObsyClient({
  apiKey: env.OBSY_API_KEY!,
  projectId: env.OBSY_PROJECT_ID!,
});

// 2. instrument OpenAI client
obsy.instrument(openai);

// 3. enable tracing for each request
app.use(obsyExpress({ client: obsy }));

app.post("/chat", async (req, res) => {
  const { message } = req.body;
  if (!message) {
    res.status(400).json({ error: "no message provided" });
    return;
  }

  const response = await openai.responses.create({
    model: "gpt-4o-mini",
    instructions: "You are a coding assistant that talks like a pirate",
    input: "Are semicolons optional in JavaScript?",
  });

  res.json(response.output_text);
});

const PORT = 6969;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
