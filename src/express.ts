import { NextFunction, Request, Response } from "express";

import { ObsyClient } from "./client.js";
import { ObsyTrace } from "./trace.js";

declare global {
  namespace Express {
    interface Request {
      trace: ObsyTrace;
    }
  }
}

interface ObsyExpressOptions {
  client: ObsyClient;
}

/**
 * Express middleware to auto-instrument OpenAI and Pinecone clients for each request.
 *
 * @param client - Obsy client
 * @param openai - OpenAI client
 * @param pinecone - Optional Pinecone client
 */
export function obsyExpress(options: ObsyExpressOptions) {
  return (req: Request, res: Response, next: NextFunction) => {
    const trace = new ObsyTrace(options.client, {
      url: req.url,
      method: req.method,
      query: req.query,
      headers: req.headers,
      body: req.body,
    });

    req.trace = trace;

    // auto-end trace on response finish
    res.on("finish", () => {
      trace.addResponse({
        statusCode: res.statusCode,
        headers: res.getHeaders(),
      });
      trace.end();
    });
    trace.runInContext(next);
  };
}
