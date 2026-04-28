#!/usr/bin/env node
// Sends a test push notification entirely from the GitHub Actions runner.
// No Vercel involvement: this is a diagnostic for whether VAPID config
// + the user's saved subscription are valid, or whether the Vercel cron
// path is the broken link.
//
// Reads:
//   VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   TEST_PUSH_EMAIL                     (target user; falls back to ADMIN_EMAIL)
//   TEST_PUSH_TITLE  / TEST_PUSH_BODY   (optional overrides)
//
// Exits non-zero on any failure so the workflow goes red. All output is
// printed verbatim so the run logs show exactly what the push service said.

import webpush from "web-push";

const SB_URL = (process.env.SUPABASE_URL || "").trim();
const SB_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const VAPID_SUBJECT = (process.env.VAPID_SUBJECT || "").trim();
const VAPID_PUB = (process.env.VAPID_PUBLIC_KEY || "").trim();
const VAPID_PRIV = (process.env.VAPID_PRIVATE_KEY || "").trim();
const TARGET_EMAIL = (process.env.TEST_PUSH_EMAIL || process.env.ADMIN_EMAIL || "").trim();
const TITLE = (process.env.TEST_PUSH_TITLE || "Everion · test push").trim();
const BODY = (
  process.env.TEST_PUSH_BODY ||
  "Sent from GitHub Actions. If you see this, push is wired correctly."
).trim();

function fail(msg) {
  console.error(`[test-push] ${msg}`);
  process.exit(1);
}

const missing = [];
if (!SB_URL) missing.push("SUPABASE_URL");
if (!SB_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
if (!VAPID_SUBJECT) missing.push("VAPID_SUBJECT");
if (!VAPID_PUB) missing.push("VAPID_PUBLIC_KEY");
if (!VAPID_PRIV) missing.push("VAPID_PRIVATE_KEY");
if (!TARGET_EMAIL) missing.push("TEST_PUSH_EMAIL or ADMIN_EMAIL");
if (missing.length) fail(`missing env: ${missing.join(", ")}`);

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUB, VAPID_PRIV);

const adminHdrs = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` };

// Diagnostic: log the SB host + a SHORT prefix of the service-role key so
// we can spot a wrong-paste without leaking the value. A real service-role
// JWT starts with "eyJ" (base64-encoded JWT header) and is ~200+ chars.
const keyPrefix = SB_KEY.slice(0, 8);
const sbHost = (() => {
  try {
    return new URL(SB_URL).host;
  } catch {
    return "(invalid URL)";
  }
})();
console.log(`[test-push] sb host: ${sbHost} · key prefix: ${keyPrefix}… (len=${SB_KEY.length})`);

// Find the user.
//
// listUsers (paginated) is broken on this project — returns "Database error
// finding users" 500. The paginated SELECT trips on a bad row in auth.users
// somewhere. Two routes that DO work:
//   1. /admin/users/{id}          — direct lookup by UUID (cheapest, surest)
//   2. /admin/users?filter=<text> — GoTrue's partial-match filter (substring)
// Try ID first if TEST_PUSH_USER_ID / ADMIN_USER_ID provided, else partial
// filter using the local-part of the email.

console.log(`[test-push] looking up user`);

async function fetchOnce(url) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const r = await fetch(url, { headers: adminHdrs });
    if (r.ok) return { ok: true, data: await r.json().catch(() => null) };
    const body = await r.text().catch(() => "");
    if (r.status >= 500 && attempt === 0) {
      console.log(`[test-push] HTTP ${r.status}, retrying once…`);
      await new Promise((res) => setTimeout(res, 1500));
      continue;
    }
    return { ok: false, status: r.status, body };
  }
  return { ok: false, status: 0, body: "no response" };
}

let user = null;
const userIdHint = (process.env.TEST_PUSH_USER_ID || process.env.ADMIN_USER_ID || "").trim();

if (userIdHint) {
  console.log(`[test-push] direct lookup by id: ${userIdHint}`);
  const r = await fetchOnce(`${SB_URL}/auth/v1/admin/users/${encodeURIComponent(userIdHint)}`);
  if (r.ok) user = r.data;
  else console.log(`[test-push] id lookup failed (HTTP ${r.status}) — falling back to filter`);
}

if (!user) {
  // GoTrue's filter is a partial-match against email/phone — not PostgREST
  // syntax. Use the part before @ so it actually matches.
  const localPart = TARGET_EMAIL.split("@")[0] || TARGET_EMAIL;
  const filterUrl = `${SB_URL}/auth/v1/admin/users?filter=${encodeURIComponent(localPart)}`;
  console.log(`[test-push] filter lookup (partial): ${localPart}`);
  const filtered = await fetchOnce(filterUrl);
  if (!filtered.ok) {
    fail(
      `admin users HTTP ${filtered.status}: ${(filtered.body || "").slice(0, 300)}\n` +
        `  Both ID + filter routes failed. Add ADMIN_USER_ID to GitHub Secrets ` +
        `(it's a UUID, get it from Supabase Dashboard → Authentication → Users).`,
    );
  }
  const users = Array.isArray(filtered.data?.users) ? filtered.data.users : [];
  user = users.find((u) => (u.email || "").toLowerCase() === TARGET_EMAIL.toLowerCase());
  if (!user && users.length === 1) user = users[0];
}

if (!user) fail(`no user found for ${TARGET_EMAIL}`);
console.log(`[test-push] found user ${user.id}`);
console.log(`[test-push] found user ${user.id}`);

const meta = user.user_metadata ?? {};
const sub = meta.push_subscription;
if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
  fail(
    `user has no saved push_subscription. Open Settings → Notifications and click Enable. ` +
      `(meta.notification_prefs.daily_enabled = ${meta?.notification_prefs?.daily_enabled})`,
  );
}

console.log(`[test-push] sending to endpoint: ${sub.endpoint.slice(0, 80)}…`);

try {
  const result = await webpush.sendNotification(
    { endpoint: sub.endpoint, keys: sub.keys },
    JSON.stringify({ title: TITLE, body: BODY, url: "/" }),
  );
  console.log(`[test-push] OK · status=${result.statusCode}`);
  if (result.headers) console.log(`[test-push] headers:`, result.headers);
  process.exit(0);
} catch (err) {
  console.error(`[test-push] webpush error · status=${err.statusCode} · ${err.message}`);
  if (err.body) console.error(`[test-push] body: ${err.body}`);
  // 410/404: the saved subscription is dead — push service revoked it.
  // The Vercel cron handler auto-prunes these; we'd surface the same hint
  // here so the admin knows to re-enable in Settings.
  if (err.statusCode === 410 || err.statusCode === 404) {
    console.error(
      `[test-push] subscription is gone. Open Settings → Notifications, Disable then Enable to refresh.`,
    );
  }
  process.exit(1);
}
