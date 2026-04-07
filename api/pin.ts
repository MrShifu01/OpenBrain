import type { ApiRequest, ApiResponse } from "./_lib/types";
import { verifyAuth } from "./_lib/verifyAuth.js";
import { rateLimit } from "./_lib/rateLimit.js";
import { applySecurityHeaders } from "./_lib/securityHeaders.js";
import crypto from "crypto";

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hdrs = (extra?: Record<string, string>) => ({
  "Content-Type": "application/json",
  apikey: SB_KEY!,
  Authorization: `Bearer ${SB_KEY}`,
  ...extra,
});

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  applySecurityHeaders(res);
  if (!(await rateLimit(req, 10))) return void res.status(429).json({ error: "Too many requests" });

  const user: any = await verifyAuth(req);
  if (!user) return void res.status(401).json({ error: "Unauthorized" });

  const action = req.query.action as string;

  if (req.method === "POST" && action === "setup") {
    const { hash, salt } = req.body;
    if (!hash || typeof hash !== "string" || !/^[0-9a-f]{64}$/i.test(hash))
      return void res.status(400).json({ error: "Invalid hash" });
    if (!salt || typeof salt !== "string" || !/^[0-9a-f]{32}$/i.test(salt))
      return void res.status(400).json({ error: "Invalid salt" });

    const r = await fetch(
      `${SB_URL}/rest/v1/user_ai_settings?user_id=eq.${encodeURIComponent(user.id)}`,
      {
        method: "PATCH",
        headers: hdrs({ Prefer: "return=minimal" }),
        body: JSON.stringify({ pin_hash: hash, pin_hash_salt: salt }),
      },
    );
    if (!r.ok) {
      // Try insert if no row exists yet
      await fetch(`${SB_URL}/rest/v1/user_ai_settings`, {
        method: "POST",
        headers: hdrs({ Prefer: "resolution=merge-duplicates,return=minimal" }),
        body: JSON.stringify({ user_id: user.id, pin_hash: hash, pin_hash_salt: salt }),
      });
    }
    return void res.status(200).json({ ok: true });
  }

  if (req.method === "POST" && action === "verify") {
    const { hash } = req.body;
    if (!hash || typeof hash !== "string") return void res.status(400).json({ error: "hash required" });

    const r = await fetch(
      `${SB_URL}/rest/v1/user_ai_settings?user_id=eq.${encodeURIComponent(user.id)}&select=pin_hash`,
      { headers: hdrs() },
    );
    const rows: any[] = r.ok ? await r.json() : [];
    const storedHash = rows[0]?.pin_hash;
    if (!storedHash) return void res.status(200).json({ valid: false, noPinSet: true });

    try {
      const valid = crypto.timingSafeEqual(
        Buffer.from(hash.toLowerCase(), "hex"),
        Buffer.from(storedHash.toLowerCase(), "hex"),
      );
      return void res.status(200).json({ valid });
    } catch {
      return void res.status(200).json({ valid: false });
    }
  }

  if (req.method === "DELETE" && action === "delete") {
    await fetch(
      `${SB_URL}/rest/v1/user_ai_settings?user_id=eq.${encodeURIComponent(user.id)}`,
      {
        method: "PATCH",
        headers: hdrs({ Prefer: "return=minimal" }),
        body: JSON.stringify({ pin_hash: null, pin_hash_salt: null }),
      },
    );
    return void res.status(200).json({ ok: true });
  }

  return void res.status(405).json({ error: "Method not allowed" });
}
