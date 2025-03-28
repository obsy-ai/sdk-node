import type OpenAI from "openai";

import type { OpTracerFn } from "#src/types/index.js";
import type { OaiCompletionCreateType, OaiResponsesCreateType } from "#src/types/openai.js";

/**
 * Instruments an OpenAI client to trace its operations.
 *
 * Supports
 * - `openai.chat.completions.create`
 * - `openai.responses.create` (new)
 */
export function instrumentOpenAI(
  client: OpenAI,
  opTracer: OpTracerFn<OaiCompletionCreateType | OaiResponsesCreateType>
): OpenAI {
  // create a proxy for the completions method to replace the original
  const completionsOrig = client.chat.completions.create.bind(client.chat.completions);
  client.chat.completions.create = new Proxy(completionsOrig, {
    apply: (target, thisArg, args: Parameters<OaiCompletionCreateType>) => {
      return opTracer({
        type: "openai.chat.completions.create",
        fn: target,
        thisArg,
        args,
        label: args[0].stream ? "openai-chat-stream" : "openai-chat-completion",
      });
    },
  });

  // create a proxy for the responses method to replace the original
  const responsesOrig = client.responses.create.bind(client.responses);
  client.responses.create = new Proxy(responsesOrig, {
    apply: (target, thisArg, args: Parameters<OaiResponsesCreateType>) => {
      return opTracer({
        type: "openai.responses.create",
        fn: target,
        thisArg,
        args,
        label: "openai-responses-create",
      });
    },
  });

  return client;
}
