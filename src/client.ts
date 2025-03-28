import { AsyncLocalStorage } from "node:async_hooks";

import { Pinecone } from "@pinecone-database/pinecone";
import OpenAI from "openai";

import { DEFAULT_SENSITIVE_KEYS } from "./constants.js";
import { instrumentOpenAI } from "./instruments/openai.js";
import { instrumentPinecone } from "./instruments/pinecone.js";
import { instrumentVercelAI, type VercelAIFunctionsArg } from "./instruments/vercel-ai.js";
import type { ObsyTrace } from "./trace.js";
import type { Op } from "./types/index.js";

/**
 * Options to initialize the Obsy client
 */
interface ObsyClientOptions {
  /**
   * Your Obsy API key
   */
  apiKey: string;

  /**
   * Your Obsy project ID
   */
  projectId: string;

  /**
   * Optional URL to send traces to (defaults to https://api.obsy.com)
   */
  sinkUrl?: string;

  /**
   * Set of sensitive keys to redact from instrumented data. See `getDefaultSensitiveKeys()` static method for default values.
   */
  sensitiveKeys?: Set<string>;
}

export interface TraceContext {
  /**
   * Reference to the trace object
   */
  trace: ObsyTrace;
}

export class ObsyClient {
  readonly projectId: string;
  readonly sensitiveKeys: Set<string>;
  readonly #apiKey: string;
  readonly #sinkUrl: string;
  readonly #storage: AsyncLocalStorage<TraceContext>;

  constructor(options: ObsyClientOptions) {
    this.#apiKey = options.apiKey;
    this.projectId = options.projectId;
    this.sensitiveKeys = options.sensitiveKeys ?? ObsyClient.getDefaultSensitiveKeys();
    this.#sinkUrl = options.sinkUrl ?? "https://api.obsy.com";
    this.#sinkUrl = `${this.#sinkUrl}/v1/sdk/${this.projectId}/traces`;
    this.#storage = new AsyncLocalStorage<TraceContext>();
  }

  static getDefaultSensitiveKeys() {
    return new Set(DEFAULT_SENSITIVE_KEYS);
  }

  getContextStorage() {
    return this.#storage;
  }

  runInContext<T>(trace: ObsyTrace, fn: (...args: any[]) => T) {
    const context: TraceContext = {
      trace,
    };
    return this.#storage.run(context, fn);
  }

  getContext() {
    return this.#storage.getStore();
  }

  async sendTrace(trace: ObsyTrace) {
    try {
      const traceJSON = trace.toJSON();
      if (traceJSON.operations.length === 0) {
        return;
      }

      const response = await fetch(this.#sinkUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.#apiKey,
        },
        body: JSON.stringify(traceJSON),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error("[obsy] failed to send trace:", error);
      }
    } catch (error) {
      console.error("[obsy] error sending trace:", error);
    }
  }

  // must match `OpTracerFn` in `types/index.ts`
  #traceOp<F extends (...args: any[]) => any>(op: Op<F>) {
    const trace = this.getContext()?.trace;
    if (!trace) {
      throw new Error("no trace found for instrumenting client");
    }

    return trace.traceOp(op);
  }

  instrument(obj: OpenAI | Pinecone) {
    if (obj instanceof OpenAI) {
      instrumentOpenAI(obj, this.#traceOp.bind(this));
    } else if (obj instanceof Pinecone) {
      instrumentPinecone(obj, this.#traceOp.bind(this));
    } else {
      throw new Error("unsupported client");
    }

    return this;
  }

  instrumentVercelAI<T extends VercelAIFunctionsArg>(functions: T) {
    return instrumentVercelAI(functions, this.#traceOp.bind(this));
  }
}
