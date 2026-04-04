/**
 * GET  /api/vault — Fetch vault salt + verify token for the authenticated user.
 * POST /api/vault — Store vault salt + verify token (first-time setup only).
 */
import { verifyAuth } from "./_lib/verifyAuth.js";
import { rateLimit } from "./_lib/rateLimit.js";

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hdrs = { "Content-Type": "application/json", "apikey": SB_KEY, "Authorization": `Bearer ${SB_KEY}` };

export default async function handler(req, res) {
  if (!(await rateLimit(req, 20))) return res.status(429).json({ error: "Too many requests" });

  const user = await verifyAuth(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  if (req.method === "GET") {
    const r = await fetch(
      `${SB_URL}/rest/v1/vault_keys?user_id=eq.${encodeURIComponent(user.id)}&select=salt,verify_token`,
      { headers: hdrs }
    );
    if (!r.ok) return res.status(502).json({ error: "Database error" });
    const rows = await r.json();
    if (rows.length === 0) return res.status(200).json({ exists: false });
    return res.status(200).json({ exists: true, salt: rows[0].salt, verify_token: rows[0].verify_token });
  }

  if (req.method === "POST") {
    const { salt, verify_token } = req.body || {};
    if (!salt || typeof salt !== "string" || salt.length !== 32) {
      return res.status(400).json({ error: "Invalid salt (must be 32-char hex)" });
    }
    if (!verify_token || typeof verify_token !== "string") {
      return res.status(400).json({ error: "Missing verify_token" });
    }

    // Prevent overwrite — vault can only be set up once
    const existing = await fetch(
      `${SB_URL}/rest/v1/vault_keys?user_id=eq.${encodeURIComponent(user.id)}&select=user_id`,
      { headers: hdrs }
    );
    const rows = await existing.json();
    if (rows.length > 0) {
      return res.status(409).json({ error: "Vault already set up" });
    }

    const r = await fetch(`${SB_URL}/rest/v1/vault_keys`, {
      method: "POST",
      headers: { ...hdrs, "Prefer": "return=minimal" },
      body: JSON.stringify({ user_id: user.id, salt, verify_token }),
    });
    if (!r.ok) {
      const err = await r.text().catch(() => r.status);
      return res.status(502).json({ error: `Database error: ${err}` });
    }
    return res.status(201).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
