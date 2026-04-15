import type { ApiRequest, ApiResponse } from "./_lib/types";
import { verifyAuth } from "./_lib/verifyAuth.js";
import { applySecurityHeaders } from "./_lib/securityHeaders.js";

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  applySecurityHeaders(res);

  const user: any = await verifyAuth(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  if (req.method === "GET") {
    // Return saved prefs from user_metadata
    const r = await fetch(`${SB_URL}/auth/v1/admin/users/${user.id}`, {
      headers: { apikey: SB_KEY!, Authorization: `Bearer ${SB_KEY}` },
    });
    if (!r.ok) return res.status(500).json({ error: "Failed to fetch prefs" });
    const data: any = await r.json();
    const prefs = data.user_metadata?.notification_prefs ?? null;
    return res.status(200).json(prefs);
  }

  if (req.method === "POST") {
    // Merge new prefs into existing
    const updates = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    // Read current metadata first
    const getRes = await fetch(`${SB_URL}/auth/v1/admin/users/${user.id}`, {
      headers: { apikey: SB_KEY!, Authorization: `Bearer ${SB_KEY}` },
    });
    const current: any = getRes.ok ? await getRes.json() : {};
    const existingPrefs = current.user_metadata?.notification_prefs ?? {};

    const r = await fetch(`${SB_URL}/auth/v1/admin/users/${user.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", apikey: SB_KEY!, Authorization: `Bearer ${SB_KEY}` },
      body: JSON.stringify({
        user_metadata: {
          ...current.user_metadata,
          notification_prefs: { ...existingPrefs, ...updates },
        },
      }),
    });
    if (!r.ok) return res.status(500).json({ error: "Failed to save prefs" });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
