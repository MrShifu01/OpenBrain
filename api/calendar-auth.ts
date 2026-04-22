/**
 * GET /api/calendar-auth?provider=google            → initiate OAuth
 * GET /api/calendar-auth?provider=google&code=...   → OAuth callback (Google redirects here)
 * GET /api/calendar-auth?provider=microsoft          → initiate OAuth
 * GET /api/calendar-auth?provider=microsoft&code=... → OAuth callback
 *
 * Register these redirect URIs in your OAuth apps:
 *   Google:    https://<your-domain>/api/calendar-auth?provider=google
 *   Microsoft: https://<your-domain>/api/calendar-auth?provider=microsoft
 */
import type { ApiRequest, ApiResponse } from "./_lib/types";
import { applySecurityHeaders } from "./_lib/securityHeaders.js";
import { verifyAuth } from "./_lib/verifyAuth.js";

const SB_URL = process.env.SUPABASE_URL!;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

const MICROSOFT_SCOPES = "Calendars.Read User.Read offline_access";

function redirectUri(provider: string): string {
  const base = process.env.APP_URL ?? "";
  const custom =
    provider === "google"
      ? process.env.GOOGLE_REDIRECT_URI
      : process.env.MICROSOFT_REDIRECT_URI;
  return custom ?? `${base}/api/calendar-auth?provider=${provider}`;
}

/* ── Initiate Google OAuth ── */
function initiateGoogle(res: ApiResponse, userId: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return res.status(500).json({ error: "GOOGLE_CLIENT_ID not set" });

  const state = Buffer.from(JSON.stringify({ userId })).toString("base64url");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri("google"));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_SCOPES);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);
  res.redirect(302, url.toString());
}

/* ── Handle Google callback ── */
async function callbackGoogle(req: ApiRequest, res: ApiResponse) {
  const appUrl = process.env.APP_URL ?? "";
  const { code, state, error } = req.query as Record<string, string>;

  if (error) return res.redirect(302, `${appUrl}/settings?calendarError=google_denied`);
  if (!code || !state) return res.redirect(302, `${appUrl}/settings?calendarError=missing_params`);

  let userId: string;
  try {
    const decoded = JSON.parse(Buffer.from(state, "base64url").toString());
    userId = decoded.userId;
    if (!userId) throw new Error();
  } catch {
    return res.redirect(302, `${appUrl}/settings?calendarError=invalid_state`);
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri("google"),
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) return res.redirect(302, `${appUrl}/settings?calendarError=token_exchange`);

  const tokens = await tokenRes.json();
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const profile = profileRes.ok ? await profileRes.json() : {};

  await fetch(`${SB_URL}/rest/v1/calendar_integrations`, {
    method: "POST",
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify({
      user_id: userId,
      provider: "google",
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: expiresAt,
      calendar_email: profile.email ?? null,
    }),
  });

  res.redirect(302, `${appUrl}/settings?calendarConnected=google`);
}

/* ── Initiate Microsoft OAuth ── */
function initiateMicrosoft(res: ApiResponse, userId: string) {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  if (!clientId) return res.status(500).json({ error: "MICROSOFT_CLIENT_ID not set" });

  const tenantId = process.env.MICROSOFT_TENANT_ID ?? "common";
  const state = Buffer.from(JSON.stringify({ userId })).toString("base64url");
  const url = new URL(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri("microsoft"));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", MICROSOFT_SCOPES);
  url.searchParams.set("response_mode", "query");
  url.searchParams.set("state", state);
  res.redirect(302, url.toString());
}

/* ── Handle Microsoft callback ── */
async function callbackMicrosoft(req: ApiRequest, res: ApiResponse) {
  const appUrl = process.env.APP_URL ?? "";
  const tenantId = process.env.MICROSOFT_TENANT_ID ?? "common";
  const { code, state, error } = req.query as Record<string, string>;

  if (error) return res.redirect(302, `${appUrl}/settings?calendarError=microsoft_denied`);
  if (!code || !state) return res.redirect(302, `${appUrl}/settings?calendarError=missing_params`);

  let userId: string;
  try {
    const decoded = JSON.parse(Buffer.from(state, "base64url").toString());
    userId = decoded.userId;
    if (!userId) throw new Error();
  } catch {
    return res.redirect(302, `${appUrl}/settings?calendarError=invalid_state`);
  }

  const tokenRes = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.MICROSOFT_CLIENT_ID!,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
      redirect_uri: redirectUri("microsoft"),
      grant_type: "authorization_code",
      scope: MICROSOFT_SCOPES,
    }),
  });

  if (!tokenRes.ok) return res.redirect(302, `${appUrl}/settings?calendarError=token_exchange`);

  const tokens = await tokenRes.json();
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  const profileRes = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const profile = profileRes.ok ? await profileRes.json() : {};

  await fetch(`${SB_URL}/rest/v1/calendar_integrations`, {
    method: "POST",
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify({
      user_id: userId,
      provider: "microsoft",
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: expiresAt,
      calendar_email: profile.mail ?? profile.userPrincipalName ?? null,
    }),
  });

  res.redirect(302, `${appUrl}/settings?calendarConnected=microsoft`);
}

/* ── Main handler ── */
export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  applySecurityHeaders(res);
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const { provider, code } = req.query as Record<string, string>;

  if (!provider || !["google", "microsoft"].includes(provider)) {
    return res.status(400).json({ error: "provider must be google or microsoft" });
  }

  // Callback: Google/Microsoft redirected back with code
  if (code) {
    return provider === "google"
      ? callbackGoogle(req, res)
      : callbackMicrosoft(req, res);
  }

  // Initiation: user clicked Connect — must be authenticated
  const user = await verifyAuth(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  return provider === "google"
    ? initiateGoogle(res, user.id)
    : initiateMicrosoft(res, user.id);
}
