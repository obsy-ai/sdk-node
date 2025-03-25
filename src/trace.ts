import crypto from "node:crypto";

import type { ChatCompletionChunk } from "openai/resources/chat/completions";
import { ResponseStreamEvent } from "openai/resources/responses/responses";
import { Stream } from "openai/streaming";

import type { ObsyClient } from "./client.js";
import type { AnyFunction, Op, OpTracerFn, OperationType, OperationVendor } from "./types/index.js";
import type { OaiCompletionCreateReturnType, OaiCompletionCreateType, OaiResponsesCreateType } from "./types/openai.js";
import type { PineconeIndexQueryType } from "./types/pinecone.js";
import { redactSensitiveKeys } from "./utils.js";

interface TraceHttpRequest {
  url: string;
  method: string;
  query: Record<string, any>;
  headers: Record<string, any>;
  body: Record<string, any>;
}

interface TraceHttpResponse {
  statusCode: number;
  headers: Record<string, any>;
  body?: string;
}

interface Operation {
  traceId: string;
  label: string;
  vendor: OperationVendor;
  type: OperationType;
  inputs: unknown[];
  startedAt: number;
  endedAt?: number;
  duration?: number;
  result?: {
    value?: any;
    model?: string;
    usage?: any;
  };
  error?: any;
}

export class ObsyTrace {
  readonly #id: string;
  readonly #client: ObsyClient;
  readonly #startedAt: number;
  #endedAt: number | null;
  #duration: number | null;
  #operations: Operation[];
  readonly #request?: TraceHttpRequest;
  #response?: TraceHttpResponse;
  #metadata?: Record<string, any>;
  #opTracers: Record<OperationType, OpTracerFn<AnyFunction>>;

  constructor(client: ObsyClient, request?: TraceHttpRequest, metadata?: Record<string, any>) {
    this.#id = crypto.randomUUID();
    this.#client = client;
    this.#startedAt = Date.now();
    this.#endedAt = null;
    this.#duration = null;
    this.#operations = [];
    this.#request = request;
    this.#metadata = metadata;
    this.#opTracers = {
      "openai.responses.create": this.recordOpenAi.bind(this),
      "openai.chat.completions.create": this.recordOpenAi.bind(this),
      "pinecone.index.query": this.recordPineconeQuery.bind(this),
      "pinecone.index.namespace.query": this.recordPineconeQuery.bind(this),
    };
  }

  traceOp(op: Op<any>) {
    const tracer = this.#opTracers[op.type];
    if (!tracer) {
      throw new Error(`no tracer found for type ${op.type}`);
    }

    return tracer(op);
  }

  private async recordOpenAi(op: Op<OaiCompletionCreateType | OaiResponsesCreateType>) {
    const operation = this.createOperation(op.label, "openai", op.type, op.args);
    operation.result = {
      value: undefined,
      model: op.args[0].model,
      usage: undefined,
    };

    try {
      const result: Awaited<OaiCompletionCreateReturnType | OaiCompletionCreateReturnType> = await (op.fn as any).apply(
        op.thisArg,
        op.args
      );

      if (result instanceof Stream) {
        // recordOpenAiStream will asynchronously handle the stream & save the operation, hence
        // we're passing the operation object to it and returning the user's stream
        return this.recordOpenAiStream(result, operation);
      }

      operation.result.value = result;
      operation.result.usage = result.usage;
      return result;
    } catch (err) {
      operation.error = err;
    } finally {
      operation.endedAt = Date.now();
      operation.duration = operation.endedAt - operation.startedAt;
      if (operation.error) {
        throw operation.error;
      }
    }
  }

  private recordOpenAiStream(
    stream: Stream<ChatCompletionChunk | ResponseStreamEvent>,
    operation: Operation
  ): Stream<ChatCompletionChunk | ResponseStreamEvent> {
    const opResult = operation.result;
    if (!opResult) {
      throw new Error("recordOpenAiCompletionStream(): operation.result must be initialized");
    }

    if (!opResult.model) {
      throw new Error("recordOpenAiCompletionStream(): model must be present in operation.result");
    }

    // split the stream into two - one for processing and one for the user
    const [processingStream, userStream] = stream.tee();

    const chunks: Array<ChatCompletionChunk | ResponseStreamEvent> = [];
    opResult.value = chunks;

    // asynchronously process our copy of the stream
    (async () => {
      try {
        for await (const chunk of processingStream) {
          if ("type" in chunk) {
            if (chunk.type === "response.completed") {
              opResult.usage = chunk.response.usage;
            }

            chunks.push(chunk);
            continue;
          }

          // when using Groq API, the usage is returned in the `x_groq` field
          if (!opResult.usage && (chunk.usage || (chunk as any).x_groq?.usage)) {
            opResult.usage = chunk.usage || (chunk as any).x_groq.usage;
          }

          chunks.push(chunk);
        }
      } catch (err: unknown) {
        operation.error = err;
      } finally {
        operation.endedAt = Date.now();
        operation.duration = operation.endedAt - operation.startedAt;
        if (operation.error) {
          throw operation.error;
        }
      }
    })();

    // return the user's copy of the stream
    return userStream;
  }

  async recordPineconeQuery<T>(op: Op<PineconeIndexQueryType>) {
    // copy args to remove the big ass vector array from the trace payload
    const argsCopyForSavingInDb = [...op.args];
    argsCopyForSavingInDb[0] = {
      ...argsCopyForSavingInDb[0],
      vector: "<redacted>",
    } as any;

    const operation = this.createOperation(op.label, "pinecone", op.type, argsCopyForSavingInDb);
    operation.result = {
      value: undefined,
      usage: undefined,
    };

    try {
      const result = await op.fn.apply(op.thisArg, op.args);
      operation.result.value = result;
      operation.result.usage = result.usage;
      return result;
    } catch (err) {
      operation.error = err;
      throw err;
    } finally {
      operation.endedAt = Date.now();
      operation.duration = operation.endedAt - operation.startedAt;
      if (operation.error) {
        throw operation.error;
      }
    }
  }

  addResponse(response: TraceHttpResponse) {
    this.#response = response;
  }

  end() {
    this.#endedAt = Date.now();
    this.#duration = this.#endedAt - this.#startedAt;
    this.#client.sendTrace(this);
  }

  createOperation(label: string, vendor: OperationVendor, type: OperationType, args: unknown[]) {
    const operation: Operation = {
      traceId: this.#id,
      label,
      vendor,
      type,
      inputs: args,
      startedAt: Date.now(),
    };

    this.#operations.push(operation);
    return operation;
  }

  runInContext<T>(fn: (...args: any[]) => T) {
    return this.#client.runInContext(this, fn);
  }

  toJSON() {
    const trace = {
      id: this.#id,
      startedAt: this.#startedAt,
      endedAt: this.#endedAt,
      duration: this.#duration,
      operations: this.#operations,
      request: this.#request,
      response: this.#response,
      metadata: this.#metadata,
    };

    // Error objects are not JSON serializable by default
    trace.operations.forEach((op) => {
      if (op.error instanceof Error) {
        op.error = {
          message: op.error.message,
          stack: op.error.stack,
        };
      }
    });

    // redact sensitive data before sending
    return redactSensitiveKeys(trace, this.#client.sensitiveKeys);
  }
}
