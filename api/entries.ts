import type { ApiRequest, ApiResponse } from "./_lib/types";
import { verifyAuth } from "./_lib/verifyAuth.js";
import { rateLimit } from "./_lib/rateLimit.js";
import { checkBrainAccess } from "./_lib/checkBrainAccess.js";
import { applySecurityHeaders } from "./_lib/securityHeaders.js";

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ENTRY_FIELDS = "id,title,content,type,tags,metadata,brain_id,importance,pinned,created_at";
const sbHdrs = (): Record<string, string> => ({ "apikey": SB_KEY!, "Authorization": `Bearer ${SB_KEY}` });
const sbHdrsJson = (extra: Record<string, string> = {}): Record<string, string> => ({ "Content-Type": "application/json", "apikey": SB_KEY!, "Authorization": `Bearer ${SB_KEY}`, ...extra });

// Dispatched via rewrites:
//   /api/delete-entry, /api/update-entry → /api/entries
//   /api/entry-brains → /api/entries?resource=entry-brains
export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  applySecurityHeaders(res);
  if (req.query.resource === "entry-brains") return handleEntryBrains(req, res);
  if (req.method === "GET") return handleGet(req, res);
  if (req.method === "DELETE") return handleDelete(req, res);
  if (req.method === "PATCH") return handlePatch(req, res);
  return res.status(405).json({ error: "Method not allowed" });
}

// ── /api/entry-brains (rewritten to /api/entries?resource=entry-brains) ──
async function handleEntryBrains(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method === "GET") return handleEntryBrainsGet(req, res);
  if (req.method === "POST") return handleEntryBrainsPost(req, res);
  if (req.method === "DELETE") return handleEntryBrainsDelete(req, res);
  return res.status(405).json({ error: "Method not allowed" });
}

async function handleEntryBrainsGet(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (!(await rateLimit(req, 60))) return res.status(429).json({ error: "Too many requests" });
  const user: any = await verifyAuth(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const entry_id = req.query.entry_id as string | undefined;
  if (!entry_id || typeof entry_id !== "string" || entry_id.length > 100) {
    return res.status(400).json({ error: "Missing or invalid entry_id" });
  }

  const r = await fetch(
    `${SB_URL}/rest/v1/entry_brains?entry_id=eq.${encodeURIComponent(entry_id)}&select=brain_id`,
    { headers: sbHdrs() },
  );
  if (!r.ok) return res.status(502).json({ error: "Database error" });
  const rows: any[] = await r.json();
  return res.status(200).json(rows.map((row) => row.brain_id));
}

async function handleEntryBrainsPost(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (!(await rateLimit(req, 30))) return res.status(429).json({ error: "Too many requests" });
  const user: any = await verifyAuth(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { entry_id, brain_id } = req.body;
  if (
    !entry_id || typeof entry_id !== "string" || entry_id.length > 100 ||
    !brain_id  || typeof brain_id  !== "string" || brain_id.length  > 100
  ) {
    return res.status(400).json({ error: "Missing or invalid entry_id / brain_id" });
  }

  const entryRes = await fetch(
    `${SB_URL}/rest/v1/entries?id=eq.${encodeURIComponent(entry_id)}&select=brain_id`,
    { headers: sbHdrs() },
  );
  if (!entryRes.ok) return res.status(502).json({ error: "Database error" });
  const [entry]: any[] = await entryRes.json();
  if (!entry) return res.status(404).json({ error: "Entry not found" });

  const access = await checkBrainAccess(user.id, entry.brain_id);
  if (!access) return res.status(403).json({ error: "Forbidden" });

  const r = await fetch(`${SB_URL}/rest/v1/entry_brains`, {
    method: "POST",
    headers: sbHdrsJson({ Prefer: "resolution=ignore-duplicates,return=minimal" }),
    body: JSON.stringify({ entry_id, brain_id }),
  });
  if (!r.ok) return res.status(502).json({ error: "Database error" });
  return res.status(200).json({ ok: true });
}

async function handleEntryBrainsDelete(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (!(await rateLimit(req, 30))) return res.status(429).json({ error: "Too many requests" });
  const user: any = await verifyAuth(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const entry_id = req.query.entry_id as string | undefined;
  const brain_id = req.query.brain_id as string | undefined;
  if (
    !entry_id || typeof entry_id !== "string" || entry_id.length > 100 ||
    !brain_id  || typeof brain_id  !== "string" || brain_id.length  > 100
  ) {
    return res.status(400).json({ error: "Missing or invalid entry_id / brain_id" });
  }

  const entryRes = await fetch(
    `${SB_URL}/rest/v1/entries?id=eq.${encodeURIComponent(entry_id)}&select=brain_id`,
    { headers: sbHdrs() },
  );
  if (!entryRes.ok) return res.status(502).json({ error: "Database error" });
  const [entry]: any[] = await entryRes.json();
  if (!entry) return res.status(404).json({ error: "Entry not found" });

  const access = await checkBrainAccess(user.id, entry.brain_id);
  if (!access) return res.status(403).json({ error: "Forbidden" });

  const r = await fetch(
    `${SB_URL}/rest/v1/entry_brains?entry_id=eq.${encodeURIComponent(entry_id)}&brain_id=eq.${encodeURIComponent(brain_id)}`,
    { method: "DELETE", headers: sbHdrs() },
  );
  if (!r.ok) return res.status(502).json({ error: "Database error" });
  return res.status(200).json({ ok: true });
}

// ── GET /api/entries ──
async function handleGet(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (!(await rateLimit(req, 60))) return res.status(429).json({ error: "Too many requests" });

  const user: any = await verifyAuth(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const brain_id = req.query.brain_id as string | undefined;
  const limit = Math.min(parseInt((req.query.limit as string) || "50", 10), 100);
  const cursor = req.query.cursor as string | undefined;
  const trash = req.query.trash === "true";

  // Build cursor + trash filters for direct REST queries
  const cursorFilter = cursor ? `&created_at=lt.${encodeURIComponent(cursor)}` : "";
  const deletedFilter = trash
    ? "&deleted_at=not.is.null"
    : "&deleted_at=is.null";

  if (brain_id) {
    // SEC-1: Verify the requesting user is a member or owner of this brain
    const access = await checkBrainAccess(user.id, brain_id);
    if (!access) return res.status(403).json({ error: "Forbidden" });

    // Use RPC to get entries visible in this brain (primary + cross-brain shares)
    // RPC doesn't support cursor pagination, fall through to direct query when cursor is set
    if (!cursor && !trash) {
      const rpcRes = await fetch(
        `${SB_URL}/rest/v1/rpc/get_entries_for_brain?select=${encodeURIComponent(ENTRY_FIELDS)}&order=created_at.desc&limit=${limit + 1}`,
        {
          method: "POST",
          headers: sbHdrsJson(),
          body: JSON.stringify({ p_brain_id: brain_id }),
        }
      );

      if (rpcRes.ok) {
        const rows: any[] = await rpcRes.json();
        const hasMore = rows.length > limit;
        const results = hasMore ? rows.slice(0, limit) : rows;
        const nextCursor = hasMore ? results[results.length - 1].created_at : null;
        return res.status(200).json({ entries: results, nextCursor, hasMore });
      }
    }

    // Fallback: direct query if RPC not yet available (pre-migration) or when cursor/trash params used
    const fallbackUrl = `${SB_URL}/rest/v1/entries?select=${encodeURIComponent(ENTRY_FIELDS)}&order=created_at.desc&limit=${limit + 1}${deletedFilter}&or=(brain_id.eq.${encodeURIComponent(brain_id)},and(user_id.eq.${encodeURIComponent(user.id)},brain_id.is.null))${cursorFilter}`;
    const fallbackRes = await fetch(fallbackUrl, { headers: sbHdrs() });
    const rows: any[] = await fallbackRes.json();
    const hasMore = rows.length > limit;
    const results = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? results[results.length - 1].created_at : null;
    return res.status(fallbackRes.status).json({ entries: results, nextCursor, hasMore });
  }

  // Fallback: user's own entries (pre-migration compatibility)
  const url = `${SB_URL}/rest/v1/entries?select=${encodeURIComponent(ENTRY_FIELDS)}&order=created_at.desc&limit=${limit + 1}${deletedFilter}&user_id=eq.${encodeURIComponent(user.id)}${cursorFilter}`;
  const response = await fetch(url, { headers: sbHdrs() });
  const rows: any[] = await response.json();
  const hasMore = rows.length > limit;
  const results = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? results[results.length - 1].created_at : null;
  res.status(response.status).json({ entries: results, nextCursor, hasMore });
}

// ── DELETE /api/entries (was /api/delete-entry) — soft delete ──
async function handleDelete(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (!(await rateLimit(req, 30))) return res.status(429).json({ error: "Too many requests" });

  const user: any = await verifyAuth(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { id } = req.body;
  if (!id || typeof id !== "string" || id.length > 100) {
    return res.status(400).json({ error: "Missing or invalid id" });
  }

  // SEC-1: Verify the requesting user is a member or owner of this entry's brain
  const entryRes = await fetch(`${SB_URL}/rest/v1/entries?id=eq.${encodeURIComponent(id)}&select=brain_id`, {
    headers: sbHdrs(),
  });
  if (!entryRes.ok) return res.status(502).json({ error: "Database error" });
  const [entry]: any[] = await entryRes.json();
  if (!entry) return res.status(404).json({ error: "Not found" });

  const access = await checkBrainAccess(user.id, entry.brain_id);
  if (!access) return res.status(403).json({ error: "Forbidden" });

  // Soft delete: set deleted_at instead of hard deleting (recoverable within 30 days)
  const response = await fetch(
    `${SB_URL}/rest/v1/entries?id=eq.${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: sbHdrsJson({ "Prefer": "return=minimal" }),
      body: JSON.stringify({ deleted_at: new Date().toISOString() }),
    }
  );

  console.log(`[audit] SOFT_DELETE entry id=${id} user=${user.id} ok=${response.ok}`);

  // SEC-14: Fire-and-forget audit log write to Supabase
  fetch(`${SB_URL}/rest/v1/audit_log`, {
    method: 'POST',
    headers: sbHdrsJson({ 'Prefer': 'return=minimal' }),
    body: JSON.stringify({
      user_id: user.id,
      action: 'entry_delete',
      resource_id: id,
      timestamp: new Date().toISOString(),
    }),
  }).catch(() => {}); // best-effort, never blocks

  res.status(response.ok ? 200 : 502).json({ ok: response.ok });
}

// ── PATCH /api/entries (was /api/update-entry) ──
async function handlePatch(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (!(await rateLimit(req, 30))) return res.status(429).json({ error: "Too many requests" });

  const user: any = await verifyAuth(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const action = req.query.action as string | undefined;

  // ── PATCH ?action=restore — restore a soft-deleted entry ──
  if (action === "restore") {
    const { id } = req.body;
    if (!id || typeof id !== "string" || id.length > 100) {
      return res.status(400).json({ error: "Missing or invalid id" });
    }

    // SEC-1: Verify the requesting user is a member or owner of this entry's brain
    const entryRes = await fetch(`${SB_URL}/rest/v1/entries?id=eq.${encodeURIComponent(id)}&select=brain_id`, {
      headers: sbHdrs(),
    });
    if (!entryRes.ok) return res.status(502).json({ error: "Database error" });
    const [entryData]: any[] = await entryRes.json();
    if (!entryData) return res.status(404).json({ error: "Not found" });

    const access = await checkBrainAccess(user.id, entryData.brain_id);
    if (!access) return res.status(403).json({ error: "Forbidden" });

    const response = await fetch(
      `${SB_URL}/rest/v1/entries?id=eq.${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: sbHdrsJson({ "Prefer": "return=representation" }),
        body: JSON.stringify({ deleted_at: null }),
      }
    );
    console.log(`[audit] RESTORE entry id=${id} user=${user.id} ok=${response.ok}`);
    const data: any = await response.json();
    return res.status(response.ok ? 200 : 502).json(data);
  }

  const { id, title, content, type, tags, metadata, brain_id } = req.body;
  if (!id || typeof id !== "string" || id.length > 100) {
    return res.status(400).json({ error: "Missing or invalid id" });
  }
  if (title !== undefined && (typeof title !== "string" || title.length > 500)) {
    return res.status(400).json({ error: "Invalid title" });
  }
  if (type !== undefined && (typeof type !== "string" || type.length > 50)) {
    return res.status(400).json({ error: "Invalid type" });
  }

  const patch: Record<string, any> = {};
  if (title !== undefined) patch.title = title;
  if (content !== undefined) patch.content = String(content).slice(0, 10000);
  if (type !== undefined) patch.type = type;
  if (Array.isArray(tags)) patch.tags = tags.filter((t: any) => typeof t === "string").slice(0, 50);
  if (metadata !== undefined && typeof metadata === "object" && !Array.isArray(metadata)) patch.metadata = metadata;
  if (brain_id !== undefined && typeof brain_id === "string" && brain_id.length <= 100) patch.brain_id = brain_id;

  // SEC-1: Verify the requesting user is a member or owner of this entry's brain
  const entryRes = await fetch(`${SB_URL}/rest/v1/entries?id=eq.${encodeURIComponent(id)}&select=brain_id`, {
    headers: sbHdrs(),
  });
  if (!entryRes.ok) return res.status(502).json({ error: "Database error" });
  const [entry]: any[] = await entryRes.json();
  if (!entry) return res.status(404).json({ error: "Not found" });

  const access = await checkBrainAccess(user.id, entry.brain_id);
  if (!access) return res.status(403).json({ error: "Forbidden" });

  const response = await fetch(
    `${SB_URL}/rest/v1/entries?id=eq.${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: sbHdrsJson({ "Prefer": "return=representation" }),
      body: JSON.stringify(patch),
    }
  );

  console.log(`[audit] PATCH entry id=${id} user=${user.id} ok=${response.ok}`);

  // SEC-14: Fire-and-forget audit log write to Supabase
  fetch(`${SB_URL}/rest/v1/audit_log`, {
    method: 'POST',
    headers: sbHdrsJson({ 'Prefer': 'return=minimal' }),
    body: JSON.stringify({
      user_id: user.id,
      action: 'entry_update',
      resource_id: id,
      timestamp: new Date().toISOString(),
    }),
  }).catch(() => {}); // best-effort, never blocks

  const data: any = await response.json();
  res.status(response.ok ? 200 : 502).json(data);
}
