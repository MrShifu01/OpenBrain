import { randomUUID } from "crypto";
import type { ApiRequest } from "./types";

export interface Logger {
  info(msg: string, extra?: Record<string, unknown>): void;
  warn(msg: string, extra?: Record<string, unknown>): void;
  error(msg: string, extra?: Record<string, unknown>): void;
}

export function getReqId(req: ApiRequest): string {
  return (req.headers["x-request-id"] as string | undefined) || randomUUID().slice(0, 8);
}

// Keys whose values must never be written to logs. Match is case-insensitive
// and substring-based so things like `userEmail`, `access_token`, `apiKey`,
// `sessionCookie` all get caught. Errs on the side of redacting too much
// rather than leaking — log readability is cheaper than a credentials leak.
const REDACT_RE =
  /(password|passwd|secret|token|apikey|api_key|key|jwt|cookie|session|email|authorization|bearer)/i;
const REDACTED = "[redacted]";

function redact(value: unknown, depth = 0): unknown {
  // Hard cap on recursion to avoid blowing the stack on cyclic structures.
  if (depth > 4) return value;
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (REDACT_RE.test(k)) {
      out[k] = REDACTED;
    } else {
      out[k] = redact(v, depth + 1);
    }
  }
  return out;
}

export function createLogger(reqId: string, context?: Record<string, unknown>): Logger {
  // Context is also passed through the redactor — if a caller put a JWT into
  // the per-request context (e.g. by accident from a request-scoped wrapper),
  // it stops there.
  const baseSafe = redact({ req_id: reqId, ...context }) as Record<string, unknown>;
  function emit(level: "info" | "warn" | "error", msg: string, extra?: Record<string, unknown>) {
    const safeExtra = extra ? (redact(extra) as Record<string, unknown>) : undefined;
    const line = JSON.stringify({
      level,
      msg,
      ...baseSafe,
      ...safeExtra,
      ts: new Date().toISOString(),
    });
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
  }
  return {
    info: (msg, extra) => emit("info", msg, extra),
    warn: (msg, extra) => emit("warn", msg, extra),
    error: (msg, extra) => emit("error", msg, extra),
  };
}
