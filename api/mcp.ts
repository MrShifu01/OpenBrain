/**
 * POST /api/mcp — EverionMind MCP server (JSON-RPC 2.0 over HTTP)
 *
 * Authentication: Authorization: Bearer em_<raw_key>
 * The raw key is SHA-256 hashed and compared against user_api_keys.key_hash.
 *
 * Reasoning tools (primary):
 *   ask_everionmind              — full multi-stage retrieval pipeline via /api/chat
 *   submit_everionmind_feedback  — submit thumbs up/down to improve future retrieval
 *   debug_everionmind_retrieval  — inspect raw semantic scores for a query
 *
 * Knowledge base tools:
 *   list_brains      — list the user's brains
 *   search_entries   — low-level semantic search within a brain
 *   get_entry        — fetch a single entry by ID
 *   create_entry     — create a new entry with embedding
 *
 * Prompts:
 *   everionmind_system — system prompt for AI clients to use EverionMind correctly
 */
import { createHash, randomUUID } from "crypto";
import type { ApiRequest, ApiResponse } from "./_lib/types";
import { applySecurityHeaders } from "./_lib/securityHeaders.js";
import { rateLimit } from "./_lib/rateLimit.js";
import { generateEmbedding, buildEntryText } from "./_lib/generateEmbedding.js";
import { learnKnowledgeShortcut } from "./_lib/feedback.js";

const SB_URL = process.env.SUPABASE_URL!;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || "").trim();

// Self-URL for internal calls to /api/chat (which owns the full retrieval pipeline).
// APP_URL must be set to the canonical production URL in Vercel env vars.
// Without it we fall back to VERCEL_PROJECT_PRODUCTION_URL (auto-set by Vercel) then
// VERCEL_URL (deployment-specific — may point to a preview, not production).
const APP_URL =
  process.env.APP_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null) ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
  "http://localhost:3000";

if (!process.env.APP_URL && !process.env.VERCEL_PROJECT_PRODUCTION_URL) {
  console.warn(
    "[mcp] WARNING: Neither APP_URL nor VERCEL_PROJECT_PRODUCTION_URL is set. " +
    "ask_everionmind will call: " + APP_URL + " — if this is a preview URL, " +
    "set APP_URL=https://your-production-domain.com in Vercel environment variables."
  );
}

const hdrs = (extra: Record<string, string> = {}): Record<string, string> => ({
  "Content-Type": "application/json",
  apikey: SB_KEY,
  Authorization: `Bearer ${SB_KEY}`,
  ...extra,
});

// ── MCP tool definitions ──────────────────────────────────────────────────────

const TOOLS = [
  // ── Primary reasoning tool ─────────────────────────────────────────────────
  {
    name: "ask_everionmind",
    description: `Query EverionMind's full intelligent retrieval pipeline and get a synthesized answer.

USAGE RULES (follow exactly):
1. Call this tool whenever the user asks about personal data, stored knowledge, people, contacts, notes, or anything they may have saved.
2. ALWAYS expand vague queries before calling: "henk id" → "What is Henk Stander's ID number?", "my dad's phone" → "What is my father's phone number?"
3. You may call this tool UP TO 3 TIMES per user turn. Use multi-step reasoning:
   - Step 1: clear, direct query
   - If answer is incomplete or involves relationships (person → attribute): Step 2 with refined/expanded query
   - Combine results before answering
4. Use mode "deep" when the first response is weak, the query is complex, or you suspect hidden relationships.
5. DO NOT manually simulate retrieval — this tool already does semantic search, keyword expansion, concept graph reasoning, and relationship synthesis.
6. Answer the user naturally — do NOT mention this tool or EverionMind by name.`,
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Fully expanded, clear natural-language question" },
        brain_ids: { type: "array", items: { type: "string" }, description: "Brain UUIDs to search. Omit to use all user brains." },
        mode: { type: "string", enum: ["fast", "deep"], description: "fast = primary brain only (default), deep = all brains with maximum retrieval" },
      },
      required: ["query"],
    },
  },
  // ── Feedback tool ──────────────────────────────────────────────────────────
  {
    name: "submit_everionmind_feedback",
    description: `Submit feedback on an ask_everionmind answer to improve future retrieval.

Call with feedback: 1 when the user confirms an answer was correct ("yes", "that's right", "perfect").
Call with feedback: -1 when the user says an answer was wrong ("that's wrong", "incorrect", "not right").
After submitting -1 feedback, retry ask_everionmind with a better query.
Use the brain_id and sources returned by ask_everionmind.`,
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "The original question asked" },
        answer: { type: "string", description: "The answer that was shown to the user" },
        feedback: { type: "number", enum: [1, -1], description: "1 = correct, -1 = incorrect" },
        brain_id: { type: "string", description: "Brain UUID returned by ask_everionmind" },
        sources: { type: "array", items: { type: "string" }, description: "Source entry IDs returned by ask_everionmind" },
        confidence: { type: "string", enum: ["high", "medium", "low"], description: "Confidence level returned by ask_everionmind" },
      },
      required: ["query", "answer", "feedback"],
    },
  },
  // ── Debug tool ─────────────────────────────────────────────────────────────
  {
    name: "debug_everionmind_retrieval",
    description: "Inspect raw retrieval scores for a query. Use when troubleshooting why ask_everionmind returned unexpected results.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Query to debug" },
        brain_id: { type: "string", description: "Brain UUID to inspect. Uses first brain if omitted." },
      },
      required: ["query"],
    },
  },
  // ── Knowledge base management ──────────────────────────────────────────────
  {
    name: "list_brains",
    description: "List all brains (knowledge bases) for the authenticated user.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "search_entries",
    description: "Low-level semantic search across entries in a brain. Prefer ask_everionmind for question-answering — use this only when you need raw entry data.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Natural language search query" },
        brain_id: { type: "string", description: "Brain UUID to search. Uses first brain if omitted." },
      },
      required: ["query"],
    },
  },
  {
    name: "get_entry",
    description: "Fetch a single entry by ID.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", description: "Entry UUID" } },
      required: ["id"],
    },
  },
  {
    name: "create_entry",
    description: "Create a new entry in a brain. Generates an embedding for semantic search.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Entry title (max 200 chars)" },
        content: { type: "string", description: "Entry content" },
        brain_id: { type: "string", description: "Brain UUID to save into" },
        type: { type: "string", description: "Entry type (e.g. note, person, recipe). Defaults to note." },
        tags: { type: "array", items: { type: "string" }, description: "Optional tags" },
      },
      required: ["title", "content", "brain_id"],
    },
  },
];

// ── MCP system prompt (returned via prompts/list for clients that support it) ─
const EVERIONMIND_SYSTEM_PROMPT = `You are an AI assistant connected to EverionMind, the user's intelligent second brain.

EverionMind is your PRIMARY SOURCE for all user-specific knowledge. It performs multi-stage semantic retrieval, concept graph reasoning, and relationship synthesis — far beyond simple keyword search.

## Core Rules
- ALWAYS use ask_everionmind for: personal data, stored knowledge, people, contacts, notes, anything the user may have saved.
- NEVER guess or hallucinate when EverionMind could contain the answer.
- NEVER manually simulate retrieval logic — EverionMind already does this better.

## Multi-Step Reasoning
You may call ask_everionmind up to 3 times per user turn.

Strategy:
1. Start with a clear, expanded query (normalize names and attributes first)
2. Analyze the response — is it complete?
3. If incomplete, ambiguous, or involves relationships (person → attribute):
   - Refine or expand the query
   - Try a follow-up query from a different angle
4. Combine results and answer confidently

Example — "What is Henk's ID?":
- Call 1: "What is Henk Stander's ID number?"
- If unclear: Call 2: "What ID information exists for Henk Stander or father?"
- Combine and answer.

## Query Rewriting (do this before every call)
- "henk id" → "What is Henk Stander's ID number?"
- "my dad's phone" → "What is my father's phone number?"
- "meeting notes" → "What meeting notes or summaries are stored?"

## Deep Mode
Use mode "deep" when:
- First response was weak or incomplete
- Query involves complex relationships
- You suspect the answer is stored but not surfacing

## Response Style
- Answer naturally and confidently
- Never mention EverionMind or tool names
- Speak as if you already know the answer
- Phone numbers and credentials go on their own line

## Failure Handling
If the answer seems wrong or incomplete:
1. Retry with a better, expanded query
2. Try a second angle (role-based, attribute-based)
3. Only fall back to general knowledge if EverionMind has truly no relevant data

## Feedback Handling
- User says "that's wrong" / "incorrect" → call submit_everionmind_feedback with -1, then retry
- User confirms correctness → optionally call submit_everionmind_feedback with +1

## Efficiency
- Prefer 1–2 strong queries over many weak ones
- Maximum 3 tool calls per user turn`;

// ── Auth ──────────────────────────────────────────────────────────────────────

async function resolveUserFromKey(rawKey: string): Promise<{ userId: string; keyId: string } | null> {
  if (!rawKey.startsWith("em_")) return null;
  const hash = createHash("sha256").update(rawKey).digest("hex");

  const r = await fetch(
    `${SB_URL}/rest/v1/user_api_keys?key_hash=eq.${encodeURIComponent(hash)}&revoked_at=is.null&select=id,user_id&limit=1`,
    { headers: hdrs() },
  );
  if (!r.ok) return null;
  const rows: any[] = await r.json();
  if (!rows.length) return null;

  // Update last_used_at (fire and forget)
  fetch(
    `${SB_URL}/rest/v1/user_api_keys?id=eq.${encodeURIComponent(rows[0].id)}`,
    {
      method: "PATCH",
      headers: hdrs({ Prefer: "return=minimal" }),
      body: JSON.stringify({ last_used_at: new Date().toISOString() }),
    },
  ).catch(() => {});

  return { userId: rows[0].user_id, keyId: rows[0].id };
}

// ── Tool implementations ──────────────────────────────────────────────────────

async function listBrains(userId: string): Promise<unknown> {
  const r = await fetch(
    `${SB_URL}/rest/v1/brains?owner_id=eq.${encodeURIComponent(userId)}&select=id,name,type,created_at&order=created_at.asc`,
    { headers: hdrs() },
  );
  if (!r.ok) throw new Error("Failed to fetch brains");
  return r.json();
}

async function searchEntries(userId: string, query: string, brainId?: string): Promise<unknown> {
  // Resolve brain_id — use provided or fall back to user's first brain
  let resolvedBrainId = brainId;
  if (!resolvedBrainId) {
    const br = await fetch(
      `${SB_URL}/rest/v1/brains?owner_id=eq.${encodeURIComponent(userId)}&select=id&order=created_at.asc&limit=1`,
      { headers: hdrs() },
    );
    const brains: any[] = await br.json();
    if (!brains.length) throw new Error("No brains found");
    resolvedBrainId = brains[0].id;
  }

  // Verify the user owns this brain
  const access = await fetch(
    `${SB_URL}/rest/v1/brains?id=eq.${encodeURIComponent(resolvedBrainId!)}&owner_id=eq.${encodeURIComponent(userId)}&select=id&limit=1`,
    { headers: hdrs() },
  );
  const owned: any[] = await access.json();
  if (!owned.length) throw new Error("Brain not found or access denied");

  if (!GEMINI_API_KEY) throw new Error("Embedding not configured on server");

  const embedding = await generateEmbedding(query, GEMINI_API_KEY);
  if (!embedding) {
    // Fall back to keyword search
    const fallback = await fetch(
      `${SB_URL}/rest/v1/entries?brain_id=eq.${encodeURIComponent(resolvedBrainId!)}&deleted_at=is.null&select=id,title,content,type,tags,created_at&limit=10`,
      { headers: hdrs() },
    );
    return fallback.json();
  }

  const rpcRes = await fetch(`${SB_URL}/rest/v1/rpc/match_entries`, {
    method: "POST",
    headers: hdrs(),
    body: JSON.stringify({
      query_embedding: embedding,
      match_threshold: 0.3,
      match_count: 10,
      filter_brain_id: resolvedBrainId,
    }),
  });
  if (!rpcRes.ok) throw new Error("Search failed");
  return rpcRes.json();
}

async function getEntry(userId: string, id: string): Promise<unknown> {
  const r = await fetch(
    `${SB_URL}/rest/v1/entries?id=eq.${encodeURIComponent(id)}&deleted_at=is.null&select=id,title,content,type,tags,metadata,created_at,updated_at,brain_id`,
    { headers: hdrs() },
  );
  if (!r.ok) throw new Error("Failed to fetch entry");
  const rows: any[] = await r.json();
  if (!rows.length) throw new Error("Entry not found");

  // Verify the entry belongs to a brain the user owns
  const brainCheck = await fetch(
    `${SB_URL}/rest/v1/brains?id=eq.${encodeURIComponent(rows[0].brain_id)}&owner_id=eq.${encodeURIComponent(userId)}&select=id&limit=1`,
    { headers: hdrs() },
  );
  const owned: any[] = await brainCheck.json();
  if (!owned.length) throw new Error("Access denied");

  return rows[0];
}

async function createEntry(
  userId: string,
  title: string,
  content: string,
  brainId: string,
  type = "note",
  tags: string[] = [],
): Promise<unknown> {
  // Verify brain ownership
  const brainCheck = await fetch(
    `${SB_URL}/rest/v1/brains?id=eq.${encodeURIComponent(brainId)}&owner_id=eq.${encodeURIComponent(userId)}&select=id&limit=1`,
    { headers: hdrs() },
  );
  const owned: any[] = await brainCheck.json();
  if (!owned.length) throw new Error("Brain not found or access denied");

  const safeTitle = title.trim().slice(0, 200);
  const safeContent = content.slice(0, 10000);
  const safeType = type.trim().slice(0, 50).toLowerCase() || "note";
  const safeTags = Array.isArray(tags) ? tags.slice(0, 20).map((t) => String(t).slice(0, 50)) : [];

  // Generate embedding
  let embedding: number[] | null = null;
  if (GEMINI_API_KEY) {
    embedding = await generateEmbedding(buildEntryText({ title: safeTitle, content: safeContent, tags: safeTags }), GEMINI_API_KEY);
  }

  const id = (randomUUID as () => string)();
  const r = await fetch(`${SB_URL}/rest/v1/entries`, {
    method: "POST",
    headers: hdrs({ Prefer: "return=representation" }),
    body: JSON.stringify({
      id,
      brain_id: brainId,
      title: safeTitle,
      content: safeContent,
      type: safeType,
      tags: safeTags,
      embedding,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),
  });
  if (!r.ok) {
    const err = await r.text().catch(() => String(r.status));
    throw new Error(`Failed to create entry: ${err}`);
  }
  const rows: any[] = await r.json();
  return rows[0];
}

// ── New tool implementations ──────────────────────────────────────────────────

async function askEverionMind(
  userId: string,
  query: string,
  brainIds?: string[],
  mode?: "fast" | "deep",
): Promise<{ answer: string; sources: string[]; confidence: string; brain_id: string }> {
  // Resolve which brains to search
  let resolvedBrainIds: string[] = [];

  if (brainIds && brainIds.length > 0) {
    resolvedBrainIds = brainIds;
  } else {
    // Fetch all user brains; deep mode uses all, fast uses only the first
    const br = await fetch(
      `${SB_URL}/rest/v1/brains?owner_id=eq.${encodeURIComponent(userId)}&select=id&order=created_at.asc&limit=10`,
      { headers: hdrs() },
    );
    const allBrains: any[] = await br.json();
    if (!allBrains.length) throw new Error("No brains found for this user");
    resolvedBrainIds = mode === "deep" ? allBrains.map((b) => b.id) : [allBrains[0].id];
  }

  const chatRes = await fetch(`${APP_URL}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Internal bypass: service-role key + user id (chat.ts validates this pair)
      Authorization: `Bearer ${SB_KEY}`,
      "x-internal-uid": userId,
    },
    body: JSON.stringify({
      message: query,
      brain_ids: resolvedBrainIds,
      history: [],
    }),
  });

  if (!chatRes.ok) {
    const errText = await chatRes.text().catch(() => String(chatRes.status));
    throw new Error(`EverionMind retrieval failed: ${errText}`);
  }

  const data: any = await chatRes.json();
  const answer: string = data.content?.[0]?.text ?? data.error ?? "No answer returned";

  return {
    answer,
    sources: Array.isArray(data.sources) ? data.sources : [],
    confidence: data.confidence ?? "medium",
    brain_id: resolvedBrainIds[0],
  };
}

async function submitFeedback(
  userId: string,
  query: string,
  answer: string,
  feedback: 1 | -1,
  brainId: string,
  sources: string[],
  confidence: "high" | "medium" | "low",
): Promise<void> {
  // Verify user owns this brain
  const brainCheck = await fetch(
    `${SB_URL}/rest/v1/brains?id=eq.${encodeURIComponent(brainId)}&owner_id=eq.${encodeURIComponent(userId)}&select=id&limit=1`,
    { headers: hdrs() },
  );
  const owned: any[] = await brainCheck.json();
  if (!owned.length) throw new Error("Brain not found or access denied");

  await fetch(`${SB_URL}/rest/v1/query_feedback`, {
    method: "POST",
    headers: hdrs({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      brain_id: brainId,
      query: query.trim().slice(0, 2000),
      answer: answer.trim().slice(0, 20000),
      retrieved_entry_ids: sources,
      top_entry_ids: sources.slice(0, 5),
      feedback,
      confidence,
    }),
  });

  // Learn shortcut on positive high-confidence feedback (fire-and-forget)
  if (feedback === 1 && confidence === "high" && sources.length > 0) {
    learnKnowledgeShortcut(brainId, query, sources, sources.slice(0, 5)).catch(() => {});
  }
}

async function debugRetrieval(userId: string, query: string, brainId?: string): Promise<unknown> {
  // Reuse existing searchEntries but return more entries with scores
  const results = await searchEntries(userId, query, brainId);
  return { query, results, note: "Raw semantic search scores — does not include keyword expansion or graph boosts applied by ask_everionmind" };
}

// ── JSON-RPC helpers ──────────────────────────────────────────────────────────

function jsonRpcOk(id: unknown, result: unknown) {
  return { jsonrpc: "2.0", id, result };
}

function jsonRpcErr(id: unknown, code: number, message: string) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

function mcpToolResult(content: unknown) {
  return { content: [{ type: "text", text: typeof content === "string" ? content : JSON.stringify(content, null, 2) }] };
}

// ── Main handler ──────────────────────────────────────────────────────────────

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  applySecurityHeaders(res);

  // MCP over HTTP uses POST for all requests
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!(await rateLimit(req, 30))) return res.status(429).json({ error: "Too many requests" });

  // Auth
  const authHeader = (req.headers["authorization"] as string) || "";
  const rawKey = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!rawKey) return res.status(401).json(jsonRpcErr(null, -32001, "Missing Authorization header"));

  const auth = await resolveUserFromKey(rawKey);
  if (!auth) return res.status(401).json(jsonRpcErr(null, -32001, "Invalid or revoked API key"));

  const { userId } = auth;
  const { jsonrpc, id, method, params } = req.body || {};

  if (jsonrpc !== "2.0") return res.status(400).json(jsonRpcErr(id ?? null, -32600, "Invalid JSON-RPC version"));

  // ── initialize ──
  if (method === "initialize") {
    return res.status(200).json(jsonRpcOk(id, {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {}, prompts: {} },
      serverInfo: {
        name: "everionmind",
        version: "2.0.0",
        // Portable system prompt delivered at init for clients that read serverInfo.instructions
        instructions: EVERIONMIND_SYSTEM_PROMPT,
      },
    }));
  }

  // ── tools/list ──
  if (method === "tools/list") {
    return res.status(200).json(jsonRpcOk(id, { tools: TOOLS }));
  }

  // ── prompts/list — system prompt for clients that support MCP prompts ──
  if (method === "prompts/list") {
    return res.status(200).json(jsonRpcOk(id, {
      prompts: [{
        name: "everionmind_system",
        description: "System prompt that configures an AI assistant to use EverionMind as its external memory with multi-step reasoning",
        arguments: [],
      }],
    }));
  }

  // ── prompts/get ──
  if (method === "prompts/get") {
    if (params?.name !== "everionmind_system") {
      return res.status(200).json(jsonRpcErr(id, -32602, `Unknown prompt: ${params?.name}`));
    }
    return res.status(200).json(jsonRpcOk(id, {
      description: "EverionMind assistant system prompt",
      messages: [{ role: "user", content: { type: "text", text: EVERIONMIND_SYSTEM_PROMPT } }],
    }));
  }

  // ── tools/call ──
  if (method === "tools/call") {
    const toolName = params?.name as string;
    const args = params?.arguments || {};

    try {
      let result: unknown;

      if (toolName === "ask_everionmind") {
        if (!args.query) return res.status(200).json(jsonRpcErr(id, -32602, "query is required"));
        result = await askEverionMind(userId, args.query, args.brain_ids, args.mode);
      } else if (toolName === "submit_everionmind_feedback") {
        if (!args.query || !args.answer || args.feedback === undefined) {
          return res.status(200).json(jsonRpcErr(id, -32602, "query, answer, and feedback are required"));
        }
        if (args.feedback !== 1 && args.feedback !== -1) {
          return res.status(200).json(jsonRpcErr(id, -32602, "feedback must be 1 or -1"));
        }
        // brain_id is optional from the client — fall back to user's first brain
        let feedbackBrainId: string = args.brain_id || "";
        if (!feedbackBrainId) {
          const br = await fetch(
            `${SB_URL}/rest/v1/brains?owner_id=eq.${encodeURIComponent(userId)}&select=id&order=created_at.asc&limit=1`,
            { headers: hdrs() },
          );
          const brains: any[] = await br.json();
          if (!brains.length) return res.status(200).json(jsonRpcErr(id, -32603, "No brains found"));
          feedbackBrainId = brains[0].id;
        }
        const validConfidence = ["high", "medium", "low"].includes(args.confidence) ? args.confidence : "medium";
        await submitFeedback(
          userId, args.query, args.answer, args.feedback,
          feedbackBrainId, Array.isArray(args.sources) ? args.sources : [],
          validConfidence as "high" | "medium" | "low",
        );
        result = { ok: true };
      } else if (toolName === "debug_everionmind_retrieval") {
        if (!args.query) return res.status(200).json(jsonRpcErr(id, -32602, "query is required"));
        result = await debugRetrieval(userId, args.query, args.brain_id);
      } else if (toolName === "list_brains") {
        result = await listBrains(userId);
      } else if (toolName === "search_entries") {
        if (!args.query) return res.status(200).json(jsonRpcErr(id, -32602, "query is required"));
        result = await searchEntries(userId, args.query, args.brain_id);
      } else if (toolName === "get_entry") {
        if (!args.id) return res.status(200).json(jsonRpcErr(id, -32602, "id is required"));
        result = await getEntry(userId, args.id);
      } else if (toolName === "create_entry") {
        if (!args.title || !args.content || !args.brain_id) {
          return res.status(200).json(jsonRpcErr(id, -32602, "title, content, and brain_id are required"));
        }
        result = await createEntry(userId, args.title, args.content, args.brain_id, args.type, args.tags);
      } else {
        return res.status(200).json(jsonRpcErr(id, -32601, `Unknown tool: ${toolName}`));
      }

      return res.status(200).json(jsonRpcOk(id, mcpToolResult(result)));
    } catch (err: any) {
      return res.status(200).json(jsonRpcErr(id, -32603, err.message || "Internal error"));
    }
  }

  return res.status(200).json(jsonRpcErr(id ?? null, -32601, `Unknown method: ${method}`));
}
