export type AnyFunction = (...args: any[]) => any;

export type OperationVendor = "openai" | "pinecone" | "vercel";

export type OpenAiOperationType = "openai.chat.completions.create" | "openai.responses.create";
export type PineconeOperationType = "pinecone.index.query" | "pinecone.index.namespace.query";
export type VercelAiOperationType =
  | "ai.embedMany"
  | "ai.generateText"
  | "ai.streamText"
  | "ai.generateObject"
  | "ai.streamObject";
export type OperationType = OpenAiOperationType | PineconeOperationType | VercelAiOperationType;

/**
 * An `Op` represents a function call with its arguments and the context in which it is called.
 * It will be automatically traced by Obsy.
 */
export type Op<F extends AnyFunction> = {
  /**
   * The type of operation
   */
  type: OperationType;

  /**
   * The function that is to be called
   */
  fn: F;

  /**
   * The context in which the function should be called
   */
  thisArg: ThisParameterType<F>;

  /**
   * The arguments to the function
   */
  args: Parameters<F>;

  /**
   * The label to use for this operation
   */
  label: string;
};

export type OpTracerFn<F extends (...args: any[]) => any> = (op: Op<F>) => ReturnType<F>;
