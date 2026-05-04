/**
 * GET  /api/gmail-auth?provider=google            → initiate Gmail OAuth
 * GET  /api/gmail-auth?provider=google&code=...   → Gmail OAuth callback
 * (Routed via vercel.json: /api/gmail-auth → /api/gmail?action=auth)
 *
 * GET    /api/gmail?action=integration  → current integration status
 * PUT    /api/gmail?action=preferences  → update scan preferences
 * POST   /api/gmail?action=scan         → manual scan trigger
 * DELETE /api/gmail                     → disconnect Gmail
 *
 * Register redirect URI in Google Cloud Console:
 *   https://<your-domain>/api/gmail-auth?provider=google
 */
import type { ApiRequest, ApiResponse } from "./_lib/types";
import { applySecurityHeaders } from "./_lib/securityHeaders.js";
import { verifyAuth } from "./_lib/verifyAuth.js";
import { withAuth, requireBrainAccess } from "./_lib/withAuth.js";
import { rateLimit } from "./_lib/rateLimit.js";
import { encryptToken } from "./_lib/gmailTokenCrypto.js";
import { signOAuthState, verifyOAuthState } from "./_lib/oauthState.js";
import {
  type GmailPreferences,
  defaultPreferences,
  scanGmailForUser,
  deepScanBatch,
} from "./_lib/gmailScan.js";

const SB_URL = process.env.SUPABASE_URL!;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SB_HEADERS = {
  apikey: SB_KEY,
  Authorization: `Bearer ${SB_KEY}`,
  "Content-Type": "application/json",
};

const GMAIL_SCOPE = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

function gmailRedirectUri(): string {
  return (
    process.env.GMAIL_REDIRECT_URI ?? `${process.env.APP_URL ?? ""}/api/gmail-auth?provider=google`
  );
}

async function generateIgnoreRule(params: {
  subject?: string;
  from?: string;
  email_type?: string;
  content_preview?: string;
}): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return `Ignore emails from ${params.from ?? "this sender"}.`;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001",
      max_tokens: 150,
      messages: [
        {
          role: "user",
          content: `Generate a specific exclusion rule for a personal email scanning system.

The rule must describe WHAT TYPE of email to ignore based on its content, subject, or purpose — NOT the sender's address or domain.
The same sender may send both wanted and unwanted emails, so address-based rules block too much.

Email details:
- From: ${params.from ?? "unknown"}
- Subject: ${params.subject ?? ""}
- Type: ${params.email_type ?? ""}
- Preview: ${params.content_preview ?? ""}

Write ONE sentence starting with "Ignore" that targets the specific content pattern or email purpose.
Bad: "Ignore emails from capitec.co.za" (blocks everything from that sender)
Good: "Ignore Capitec promotional emails about credit card offers or insurance"
Return only the rule text, no explanation.`,
        },
      ],
    }),
  });
  if (!res.ok) return `Ignore emails from ${params.from ?? "this sender"}.`;
  const data = await res.json();
  return (
    (data.content?.[0]?.text ?? "").trim() || `Ignore emails from ${params.from ?? "this sender"}.`
  );
}

/* ── OAuth ── */

function buildGoogleAuthUrl(userId: string, preferences: GmailPreferences): string | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return null;
  const state = signOAuthState({ userId, data: { preferences } });
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", gmailRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GMAIL_SCOPE);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);
  return url.toString();
}

async function callbackGoogle(req: ApiRequest, res: ApiResponse) {
  const appUrl = process.env.APP_URL ?? "";
  const { code, state, error } = req.query as Record<string, string>;
  if (error) return res.redirect(302, `${appUrl}/settings?gmailError=google_denied`);
  if (!code || !state) return res.redirect(302, `${appUrl}/settings?gmailError=missing_params`);

  const verified = verifyOAuthState(state);
  if (!verified.ok) {
    const reason = verified.reason === "expired" ? "expired_state" : "invalid_state";
    return res.redirect(302, `${appUrl}/settings?gmailError=${reason}`);
  }
  const userId = verified.payload.userId;
  const prefRaw = verified.payload.data?.preferences;
  const preferences: GmailPreferences =
    prefRaw && typeof prefRaw === "object" ? (prefRaw as GmailPreferences) : defaultPreferences();

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: gmailRedirectUri(),
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) return res.redirect(302, `${appUrl}/settings?gmailError=token_exchange`);

  const tokens = await tokenRes.json();
  const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const profile = profileRes.ok ? await profileRes.json() : {};

  const dbRes = await fetch(`${SB_URL}/rest/v1/gmail_integrations`, {
    method: "POST",
    headers: { ...SB_HEADERS, Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({
      user_id: userId,
      access_token: encryptToken(tokens.access_token),
      refresh_token: encryptToken(tokens.refresh_token),
      token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      gmail_email: profile.email ?? null,
      preferences,
    }),
  });
  if (!dbRes.ok) return res.redirect(302, `${appUrl}/settings?gmailError=db_write_failed`);
  res.redirect(302, `${appUrl}/settings?gmailConnected=true`);
}

async function handleAuth(req: ApiRequest, res: ApiResponse): Promise<void> {
  // IP-based limit on the OAuth bootstrap. Both initiate (POST → JSON) and
  // callback (token exchange + DB write) hit external services and writes;
  // unbounded grinding would burn Google quota and pollute integrations.
  if (!(await rateLimit(req, 30, 60_000, "gmail-auth"))) {
    return void res.status(429).json({ error: "Too many requests" });
  }

  const { provider, code } = req.query as Record<string, string>;
  if (provider !== "google")
    return res.status(400).json({ error: "Only google provider supported" });

  // Google's redirect comes back here as a GET with `?code=`. Anything else
  // hitting this path is the legitimate user-driven start of the flow.
  if (req.method === "GET" && code) return callbackGoogle(req, res);

  // Initiation no longer accepts a Supabase bearer in the URL — the previous
  // `?token=<JWT>` pattern leaked tokens into server access logs, browser
  // history, and Referer headers. Clients now POST with a normal
  // Authorization header and receive a redirect URL to navigate to.
  if (req.method !== "POST" && req.method !== "GET")
    return res.status(405).json({ error: "Method not allowed" });

  // Reject GET initiation outright — only POST can start the flow now.
  if (req.method === "GET") {
    return res
      .status(405)
      .json({ error: "Use POST with Authorization header to start OAuth" });
  }

  const user = await verifyAuth(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  let preferences: GmailPreferences;
  try {
    const body = (req.body ?? {}) as { preferences?: GmailPreferences };
    preferences =
      body.preferences && typeof body.preferences === "object"
        ? body.preferences
        : defaultPreferences();
  } catch {
    preferences = defaultPreferences();
  }

  const redirectUrl = buildGoogleAuthUrl(user.id, preferences);
  if (!redirectUrl) return res.status(500).json({ error: "GOOGLE_CLIENT_ID not set" });
  return void res.status(200).json({ redirect_url: redirectUrl });
}

/* ── Main handler ── */

// Authed sub-handler covering all non-OAuth actions (integration, scan, deep-scan,
// preferences, delete-entries, ignore, DELETE). The OAuth `auth` action stays
// outside the wrapper because it has its own queryToken-based bootstrap and a
// 302 redirect response that doesn't fit withAuth.
const authedHandler = withAuth(
  // Outer baseline 60/min catches the cheap actions (GET integration, PUT
  // preferences, POST ignore, DELETE) that don't have inner action-specific
  // limits. Expensive actions (scan: 5/min, deep-scan: 3/min) still throttle
  // tighter inside the handler.
  { methods: ["GET", "POST", "PUT", "DELETE"], rateLimit: 60 },
  async ({ req, res, user }) => {
    const action = (req.query.action as string) ?? "";

    if (req.method === "DELETE") {
      await fetch(`${SB_URL}/rest/v1/gmail_integrations?user_id=eq.${user.id}`, {
        method: "DELETE",
        headers: SB_HEADERS,
      });
      return void res.status(200).json({ ok: true });
    }

    if (req.method === "GET" && action === "integration") {
      const r = await fetch(
        `${SB_URL}/rest/v1/gmail_integrations?user_id=eq.${user.id}&select=id,gmail_email,scan_enabled,last_scanned_at,preferences`,
        { headers: SB_HEADERS },
      );
      const rows: any[] = r.ok ? await r.json() : [];
      return void res.status(200).json(rows[0] ?? null);
    }

    if (req.method === "PUT" && action === "preferences") {
      const { preferences } = req.body ?? {};
      if (!preferences) return void res.status(400).json({ error: "preferences required" });
      await fetch(`${SB_URL}/rest/v1/gmail_integrations?user_id=eq.${user.id}`, {
        method: "PATCH",
        headers: SB_HEADERS,
        body: JSON.stringify({ preferences }),
      });
      return void res.status(200).json({ ok: true });
    }

    if (req.method === "POST" && action === "scan") {
      // §2.3: 5 manual scans/min per user — prevents DoS via repeat triggering
      if (!(await rateLimit(req, 5, 60_000, `gmail-scan:${user.id}`))) {
        return void res
          .status(429)
          .json({ error: "Too many scan requests — wait a minute and try again." });
      }
      const r = await fetch(`${SB_URL}/rest/v1/gmail_integrations?user_id=eq.${user.id}&select=*`, {
        headers: SB_HEADERS,
      });
      const rows: any[] = r.ok ? await r.json() : [];
      if (!rows[0]) return void res.status(404).json({ error: "No Gmail integration found" });
      // Gmail entries always land in the user's personal brain (see
      // gmailScan.getUserBrainId) so the caller's brain_id is no longer
      // honoured. Re-enrichment is targeted at the personal brain.
      try {
        const result = await scanGmailForUser(rows[0], true);
        return void res.status(200).json(result);
      } catch (e: any) {
        console.error("[gmail/scan]", e);
        return void res
          .status(500)
          .json({ error: String(e?.message ?? e), created: 0, entries: [], debug: null });
      }
    }

    if (req.method === "POST" && action === "delete-entries") {
      const { entryIds } = req.body ?? {};
      if (!Array.isArray(entryIds) || entryIds.length === 0)
        return void res.status(400).json({ error: "entryIds required" });
      // Audit #6: validate UUIDs and cap length so a malicious client cannot
      // explode the URL or sneak operators past encodeURIComponent.
      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const cleanIds = entryIds
        .filter((id: any) => typeof id === "string" && uuidRe.test(id))
        .slice(0, 200);
      if (!cleanIds.length) return void res.status(400).json({ error: "entryIds must be UUIDs" });
      const ids = cleanIds.map((id: string) => encodeURIComponent(id)).join(",");
      await fetch(`${SB_URL}/rest/v1/entries?id=in.(${ids})&user_id=eq.${user.id}`, {
        method: "DELETE",
        headers: SB_HEADERS,
      });
      return void res.status(200).json({ ok: true, deleted: cleanIds.length });
    }

    if (req.method === "POST" && action === "deep-scan") {
      // §2.3: 3 deep-scans/min per user — more expensive than regular scan
      if (!(await rateLimit(req, 3, 60_000, `gmail-deep-scan:${user.id}`))) {
        return void res
          .status(429)
          .json({ error: "Too many deep-scan requests — wait a minute and try again." });
      }
      const r = await fetch(`${SB_URL}/rest/v1/gmail_integrations?user_id=eq.${user.id}&select=*`, {
        headers: SB_HEADERS,
      });
      const rows: any[] = r.ok ? await r.json() : [];
      if (!rows[0]) return void res.status(404).json({ error: "No Gmail integration found" });
      const { cursor, sinceMs } = req.body ?? {};
      // Deep-scan output also locks to the personal brain — see
      // gmailScan.getUserBrainId. brain_id from body is ignored.
      const result = await deepScanBatch(rows[0], {
        cursor: typeof cursor === "string" ? cursor : undefined,
        sinceMs: typeof sinceMs === "number" ? sinceMs : Date.now() - 365 * 24 * 60 * 60 * 1000,
      });
      return void res.status(200).json(result);
    }

    if (req.method === "POST" && action === "ignore") {
      const { subject, from, email_type, content_preview } = req.body ?? {};
      const rule = await generateIgnoreRule({ subject, from, email_type, content_preview });
      const intRes = await fetch(
        `${SB_URL}/rest/v1/gmail_integrations?user_id=eq.${user.id}&select=preferences`,
        { headers: SB_HEADERS },
      );
      const rows: any[] = intRes.ok ? await intRes.json() : [];
      if (!rows[0]) return void res.status(404).json({ error: "No Gmail integration found" });
      const prefs = rows[0].preferences ?? { categories: [], custom: "" };
      const existing = (prefs.custom ?? "").trim();
      const newCustom = existing ? `${existing}\n${rule}` : rule;
      await fetch(`${SB_URL}/rest/v1/gmail_integrations?user_id=eq.${user.id}`, {
        method: "PATCH",
        headers: SB_HEADERS,
        body: JSON.stringify({ preferences: { ...prefs, custom: newCustom } }),
      });
      return void res.status(200).json({ ok: true, rule });
    }

    return void res.status(405).json({ error: "Method not allowed" });
  },
);

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  const action = (req.query.action as string) ?? "";
  if (action === "auth") {
    applySecurityHeaders(res);
    return handleAuth(req, res);
  }
  return authedHandler(req, res);
}
