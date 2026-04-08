/**
 * S4-2: Response time tracking middleware.
 * Wrap any API handler to log slow requests (>1s).
 */
import type { ApiRequest, ApiResponse } from "./types";

type Handler = (req: ApiRequest, res: ApiResponse) => Promise<void>;

export function withTiming(handler: Handler): Handler {
  return async (req: ApiRequest, res: ApiResponse) => {
    const start = Date.now();
    try {
      await handler(req, res);
    } finally {
      const ms = Date.now() - start;
      if (ms > 1000) {
        console.warn(`[slow-api] ${req.method} ${req.url} took ${ms}ms`);
      }
    }
  };
}
