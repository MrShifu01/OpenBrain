// Per-instance in-memory rate limiter (serverless: limits bursts within a single cold-start instance)
const counts = new Map();

export function rateLimit(req, limit = 20, windowMs = 60_000) {
  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    "unknown";
  const now = Date.now();
  const entry = counts.get(ip) || { count: 0, reset: now + windowMs };

  if (now > entry.reset) {
    entry.count = 0;
    entry.reset = now + windowMs;
  }

  entry.count++;
  counts.set(ip, entry);
  return entry.count <= limit;
}
