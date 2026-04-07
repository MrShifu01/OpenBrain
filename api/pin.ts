import { verifyAuth } from "./_lib/verifyAuth";
import { rateLimit } from "./_lib/rateLimit";
import { applySecurityHeaders } from "./_lib/securityHeaders";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const supabase = require("@supabase/supabase-js").createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applySecurityHeaders(res);

  const { action } = req.query as { action: string };

  if (action === "setup") {
    const auth = await verifyAuth(req);
    if (!auth) return res.status(401).json({ error: "Unauthorized" });

    await rateLimit(req);

    const { hash, salt } = req.body as { hash?: string; salt?: string };

    // Validate hash: 64 hex chars (256-bit PBKDF2 output)
    if (!hash || !/^[a-f0-9]{64}$/i.test(hash)) {
      return res.status(400).json({ error: "Invalid hash format" });
    }

    // Validate salt: 32 hex chars (128-bit random)
    if (!salt || !/^[a-f0-9]{32}$/i.test(salt)) {
      return res.status(400).json({ error: "Invalid salt format" });
    }

    // Store server-side
    await supabase
      .from("user_security")
      .upsert(
        { user_id: auth.id, pin_hash: hash, pin_salt: salt, updated_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );

    return res.status(200).json({ ok: true });
  }

  if (action === "verify") {
    const auth = await verifyAuth(req);
    if (!auth) return res.status(401).json({ error: "Unauthorized" });

    const { hash } = req.body as { hash?: string };
    if (!hash || !/^[a-f0-9]{64}$/i.test(hash)) {
      return res.status(400).json({ error: "Invalid hash format" });
    }

    const { data } = await supabase
      .from("user_security")
      .select("pin_hash")
      .eq("user_id", auth.id)
      .single()
      .catch(() => ({ data: null }));

    if (!data) {
      return res.status(200).json({ noPinSet: true });
    }

    const valid = data.pin_hash === hash;
    return res.status(200).json({ valid });
  }

  if (action === "delete") {
    const auth = await verifyAuth(req);
    if (!auth) return res.status(401).json({ error: "Unauthorized" });

    await supabase.from("user_security").update({ pin_hash: null, pin_salt: null }).eq("user_id", auth.id);

    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: "Unknown action" });
}
