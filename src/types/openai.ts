import type OpenAI from "openai";

/**
 * type of `OpenAI.prototype.chat.completions.create`
 */
export type OaiCompletionCreateType = typeof OpenAI.prototype.chat.completions.create;

/**
 * The return type of `OpenAI.prototype.chat.completions.create`
 */
export type OaiCompletionCreateReturnType = ReturnType<OaiCompletionCreateType>;

/**
 * type of `OpenAI.prototype.responses.create`
 */
export type OaiResponsesCreateType = typeof OpenAI.prototype.responses.create;

/**
 * The return type of `OpenAI.prototype.responses.create`
 */
export type OaiResponsesCreateReturnType = ReturnType<OaiResponsesCreateType>;
