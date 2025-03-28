import type { NextFunction, Request, Response } from "express";

import { type ObsyClient } from "./client.js";
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
 * Express middleware to automatically start a new Obsy trace for each request.
 *
 * @param client Obsy client
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
