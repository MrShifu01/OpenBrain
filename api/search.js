/**
 * POST /api/search — Semantic search using pgvector cosine similarity.
 * GET  /api/search?brain_id=...&threshold=0.4 — Embedding similarity graph links.
 */
import { verifyAuth } from "./_lib/verifyAuth.js";
import { rateLimit } from "./_lib/rateLimit.js";
import { generateEmbedding } from "./_lib/generateEmbedding.js";
import { checkBrainAccess } from "./_lib/checkBrainAccess.js";

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hdrs = () => ({ "Content-Type": "application/json", "apikey": SB_KEY, "Authorization": `Bearer ${SB_KEY}` });

export default async function handler(req, res) {
  if (req.method === "GET") return handleGraph(req, res);
  if (req.method === "POST") return handleSearch(req, res);
  return res.status(405).json({ error: "Method not allowed" });
}

// ── GET /api/search?brain_id=...&threshold=0.4 — similarity graph ──
async function handleGraph(req, res) {
  if (!(await rateLimit(req, 10))) return res.status(429).json({ error: "Too many requests" });

  const user = await verifyAuth(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const brain_id = req.query.brain_id;
  if (!brain_id) return res.status(400).json({ error: "brain_id required" });

  const access = await checkBrainAccess(user.id, brain_id);
  if (!access) return res.status(403).json({ error: "Forbidden" });

  const threshold = parseFloat(req.query.threshold) || 0.4;

  const rpcRes = await fetch(`${SB_URL}/rest/v1/rpc/build_similarity_graph`, {
    method: "POST",
    headers: hdrs(),
    body: JSON.stringify({ p_brain_id: brain_id, p_threshold: threshold }),
  });

  if (!rpcRes.ok) {
    const err = await rpcRes.text().catch(() => rpcRes.status);
    console.error("[graph:rpc]", err);
    return res.status(502).json({ error: "Graph build failed" });
  }

  const links = await rpcRes.json();
  return res.status(200).json(links);
}

// ── POST /api/search — semantic search ──
async function handleSearch(req, res) {
  if (!(await rateLimit(req, 30))) return res.status(429).json({ error: "Too many requests" });

  const user = await verifyAuth(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const provider = (req.headers["x-embed-provider"] || "openai").toLowerCase();
  const apiKey = (req.headers["x-embed-key"] || "").trim();
  if (!apiKey) return res.status(400).json({ error: "X-Embed-Key header required" });

  const { query, brain_id, limit: rawLimit } = req.body || {};
  if (!query || typeof query !== "string" || !query.trim()) return res.status(400).json({ error: "query required" });
  if (!brain_id || typeof brain_id !== "string") return res.status(400).json({ error: "brain_id required" });

  const matchCount = Math.min(Math.max(parseInt(rawLimit) || 20, 1), 50);

  const access = await checkBrainAccess(user.id, brain_id);
  if (!access) return res.status(403).json({ error: "Forbidden" });

  try {
    const queryEmbedding = await generateEmbedding(query.trim(), provider, apiKey);

    const rpcRes = await fetch(`${SB_URL}/rest/v1/rpc/match_entries`, {
      method: "POST",
      headers: hdrs(),
      body: JSON.stringify({
        query_embedding: `[${queryEmbedding.join(",")}]`,
        p_brain_id: brain_id,
        match_count: matchCount,
      }),
    });

    if (!rpcRes.ok) {
      const err = await rpcRes.text().catch(() => rpcRes.status);
      console.error("[search:rpc]", err);
      return res.status(502).json({ error: "Vector search failed" });
    }

    const results = await rpcRes.json();
    return res.status(200).json(results);
  } catch (e) {
    console.error("[search]", e.message);
    return res.status(502).json({ error: e.message });
  }
}
