/**
 * POST /api/memory/retrieve  → semantic retrieval over user's brain
 * GET  /api/memory/upcoming  → entries with upcoming dates
 *
 * Routed via vercel.json rewrites:
 *   /api/memory/retrieve → /api/memory-api?action=retrieve
 *   /api/memory/upcoming → /api/memory-api?action=upcoming
 *
 * Auth: Authorization: Bearer <em_key>  OR  Authorization: Bearer <supabase_jwt>
 */
import type { ApiRequest, ApiResponse } from "./_lib/types";
import { applySecurityHeaders } from "./_lib/securityHeaders.js";
import { rateLimit } from "./_lib/rateLimit.js";
import { verifyAuth } from "./_lib/verifyAuth.js";
import { resolveApiKey } from "./_lib/resolveApiKey.js";
import { retrieveEntries } from "./_lib/retrievalCore.js";

const SB_URL = process.env.SUPABASE_URL!;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SB_HEADERS = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` };
const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || "").trim();
const DATE_FIELDS = ["due_date", "deadline", "expiry_date", "event_date"] as const;

async function resolveUser(req: ApiRequest): Promise<{ userId: string; brainId: string } | null> {
  const authHeader = (req.headers.authorization as string) || "";
  const rawKey = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  if (rawKey.startsWith("em_")) {
    const result = await resolveApiKey(rawKey);
    return result ? { userId: result.userId, brainId: result.brainId } : null;
  }

  const user = await verifyAuth(req);
  if (!user) return null;

  const brainRes = await fetch(
    `${SB_URL}/rest/v1/brains?owner_id=eq.${encodeURIComponent(user.id)}&select=id&limit=1`,
    { headers: SB_HEADERS },
  );
  if (!brainRes.ok) return null;
  const brains: any[] = await brainRes.json();
  if (!brains.length) return null;
  return { userId: user.id, brainId: brains[0].id };
}

async function handleRetrieve(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!(await rateLimit(req, 20))) return res.status(429).json({ error: "Too many requests" });
  if (!GEMINI_API_KEY) return res.status(500).json({ error: "AI not configured" });

  const auth = await resolveUser(req);
  if (!auth) return res.status(401).json({ error: "Unauthorized" });

  const { query, limit } = req.body || {};
  if (!query || typeof query !== "string" || !query.trim()) {
    return res.status(400).json({ error: "query required" });
  }

  const safeLimit = Math.min(Math.max(1, parseInt(String(limit)) || 15), 50);
  try {
    const entries = await retrieveEntries(query.trim(), auth.brainId, GEMINI_API_KEY, safeLimit);
    return res.status(200).json({ entries });
  } catch (e: any) {
    return res.status(502).json({ error: e.message });
  }
}

async function handleUpcoming(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  if (!(await rateLimit(req, 30))) return res.status(429).json({ error: "Too many requests" });

  const auth = await resolveUser(req);
  if (!auth) return res.status(401).json({ error: "Unauthorized" });

  const query = req.query as Record<string, string>;
  const days = Math.min(Math.max(1, parseInt(query.days) || 30), 365);
  const today = new Date().toISOString().slice(0, 10);
  const future = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

  const fetches = await Promise.all(
    DATE_FIELDS.map(async (field) => {
      const params = new URLSearchParams({
        brain_id: `eq.${auth.brainId}`,
        deleted_at: "is.null",
        [`metadata->>${field}`]: `gte.${today}`,
        select: "id,title,type,tags,content,metadata,created_at",
        limit: "100",
        order: `metadata->>${field}.asc`,
      });
      const url = `${SB_URL}/rest/v1/entries?${params.toString()}&metadata->>${field}=lte.${future}`;
      const r = await fetch(url, { headers: SB_HEADERS });
      if (!r.ok) return [];
      const rows: any[] = await r.json();
      return rows.map((e) => ({ ...e, _date_field: field }));
    }),
  );

  const seen = new Set<string>();
  const merged: any[] = [];
  for (const rows of fetches) {
    for (const row of rows) {
      if (!seen.has(row.id)) { seen.add(row.id); merged.push(row); }
    }
  }

  merged.sort((a, b) => {
    const aDate = DATE_FIELDS.map((f) => a.metadata?.[f]).filter(Boolean).sort()[0] ?? "9999";
    const bDate = DATE_FIELDS.map((f) => b.metadata?.[f]).filter(Boolean).sort()[0] ?? "9999";
    return aDate.localeCompare(bDate);
  });

  return res.status(200).json({ entries: merged, days, from: today, to: future });
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  applySecurityHeaders(res);
  const action = (req.query.action as string) ?? "";
  if (action === "retrieve") return handleRetrieve(req, res);
  if (action === "upcoming") return handleUpcoming(req, res);
  return res.status(400).json({ error: "action must be retrieve or upcoming" });
}
