import { embedMany as aiEmbedMany, generateText as aiGenerateText, streamText as aiStreamText } from "ai";

import type { OpTracerFn, VercelAiOperationType } from "#src/types/index.js";
import type {
  VercelAIEmbedManyType,
  VercelAIGenerateTextType,
  VercelAIInstrumentedFunctions,
  VercelAIStreamTextType,
} from "#src/types/vercel-ai.js";

export type VercelAIFunctionsArg = Partial<{
  embedMany: VercelAIEmbedManyType;
  generateText: VercelAIGenerateTextType;
  streamText: VercelAIStreamTextType;
}>;

export function instrumentVercelAI<T extends VercelAIFunctionsArg>(
  functions: T,
  opTracer: OpTracerFn<VercelAIInstrumentedFunctions>
): T {
  if (Object.keys(functions).length === 0) {
    throw new Error("no functions to instrument");
  }

  const { embedMany, generateText, streamText } = functions;
  const result = {} as T;

  const createProxy = <F extends VercelAIInstrumentedFunctions>(params: {
    fn: F;
    originalFn: Function;
    type: VercelAiOperationType;
    label: string;
  }) => {
    const { fn, originalFn, type, label } = params;

    if (fn !== originalFn) {
      throw new Error(`given ${fn.name} is not a function from Vercel's AI SDK`);
    }

    return new Proxy(fn, {
      apply: (target, thisArg, args: Parameters<F>) => {
        return opTracer({
          type,
          fn: target,
          thisArg,
          args,
          label,
        });
      },
    });
  };

  if (embedMany) {
    result.embedMany = createProxy({
      fn: embedMany,
      originalFn: aiEmbedMany,
      type: "ai.embedMany",
      label: "vercel-ai-embed-many",
    });
  }

  if (generateText) {
    result.generateText = createProxy({
      fn: generateText,
      originalFn: aiGenerateText,
      type: "ai.generateText",
      label: "vercel-ai-generate-text",
    });
  }

  if (streamText) {
    result.streamText = createProxy({
      fn: streamText,
      originalFn: aiStreamText,
      type: "ai.streamText",
      label: "vercel-ai-stream-text",
    });
  }

  return result;
}
