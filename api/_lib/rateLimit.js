const hits = new Map();

export function rateLimit(req, limit = 30, windowMs = 60000) {
  const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket?.remoteAddress || "unknown";
  const now = Date.now();
  const entry = hits.get(ip);

  if (!entry || now - entry.start > windowMs) {
    hits.set(ip, { start: now, count: 1 });
    return true;
  }

  entry.count++;
  if (entry.count > limit) return false;
  return true;
}
