import type { embedMany, generateText, streamText } from "ai";

/**
 * The type of the `embedMany` function from Vercel's `ai` package.
 */
export type VercelAIEmbedManyType = typeof embedMany;

/**
 * The type of the `generateText` function from Vercel's `ai` package.
 */
export type VercelAIGenerateTextType = typeof generateText;

/**
 * The type of the `streamText` function from Vercel's `ai` package.
 */
export type VercelAIStreamTextType = typeof streamText;

/**
 * A union type of all the instrumented functions from Vercel's `ai` package.
 */
export type VercelAIInstrumentedFunctions = VercelAIEmbedManyType | VercelAIGenerateTextType | VercelAIStreamTextType;
