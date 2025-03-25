import type { embedMany, generateObject, generateText, streamText } from "ai";

/**
 * The type of the `embedMany` function from Vercel's `ai` package.
 */
export type VercelAIEmbedManyType = typeof embedMany;

/**
 * The type of the `generateText` function from Vercel's `ai` package.
 */
export type VercelAIGenerateTextType = typeof generateText;

/**
 * The return type of the `generateText` function from Vercel's `ai` package.
 */
export type VercelAIGenerateTextReturnType = ReturnType<VercelAIGenerateTextType>;

/**
 * The type of the `streamText` function from Vercel's `ai` package.
 */
export type VercelAIStreamTextType = typeof streamText;

/**
 * The type of the `generateObject` function from Vercel's `ai` package.
 */
export type VercelAIGenerateObjectType = typeof generateObject;

/**
 * The return type of the `generateObject` function from Vercel's `ai` package.
 */
export type VercelAIGenerateObjectReturnType = ReturnType<VercelAIGenerateObjectType>;

/**
 * A union type of all the instrumented functions from Vercel's `ai` package.
 */
export type VercelAIInstrumentedFunctions =
  | VercelAIEmbedManyType
  | VercelAIGenerateTextType
  | VercelAIStreamTextType
  | VercelAIGenerateObjectType;
