#!/usr/bin/env node
// Provisions the demo "review tester" account that gets handed to Play
// Console reviewers in the App Access section of the listing. Idempotent:
// safe to re-run after each prod deploy.
//
// What this does:
//   1. Creates auth.users row for REVIEW_TESTER_EMAIL with REVIEW_TESTER_PASSWORD
//      (skips if already exists — Supabase admin API is idempotent on email).
//   2. Marks the user's onboarding complete so the reviewer doesn't get
//      stuck on the OnboardingModal (which is technically skippable but
//      reviewers don't always notice the skip).
//   3. Seeds a curated set of 6 sample entries spanning the core surfaces
//      (note, todo, person, secret-flagged thought, document-link,
//      reminder-with-due-date) so the app feels populated on first open.
//   4. Logs to audit_log so we have a record of every setup run.
//
// Reads:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   REVIEW_TESTER_EMAIL     — the email Play Console gets (e.g. play-tester@everionmind.com)
//   REVIEW_TESTER_PASSWORD  — the password Play Console gets (12+ chars, store in 1Password)
//
// Usage:
//   REVIEW_TESTER_EMAIL=play-tester@everionmind.com \
//   REVIEW_TESTER_PASSWORD='...' \
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//   node scripts/setup-review-tester.mjs
//
// Exit codes: 0 on success, non-zero on any failure (so CI/script callers
// can detect failure).

const SB_URL = (process.env.SUPABASE_URL || "").trim();
const SB_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const EMAIL = (process.env.REVIEW_TESTER_EMAIL || "").trim().toLowerCase();
const PASSWORD = (process.env.REVIEW_TESTER_PASSWORD || "").trim();

function fail(msg) {
  console.error(`[setup-review-tester] ${msg}`);
  process.exit(1);
}

const missing = [];
if (!SB_URL) missing.push("SUPABASE_URL");
if (!SB_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
if (!EMAIL) missing.push("REVIEW_TESTER_EMAIL");
if (!PASSWORD) missing.push("REVIEW_TESTER_PASSWORD");
if (missing.length) fail(`missing env: ${missing.join(", ")}`);
if (PASSWORD.length < 12) fail("REVIEW_TESTER_PASSWORD must be at least 12 chars");

const adminHdrs = {
  apikey: SB_KEY,
  Authorization: `Bearer ${SB_KEY}`,
  "Content-Type": "application/json",
};

async function findUserByEmail() {
  // Supabase admin API doesn't expose a get-by-email endpoint cheaply, so we
  // try to create the user — the API returns 422 with a recognisable message
  // if it already exists, and we then look up the existing row.
  const r = await fetch(`${SB_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: adminHdrs,
    body: JSON.stringify({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { review_tester: true },
    }),
  });
  if (r.status === 200 || r.status === 201) {
    const created = await r.json();
    console.log(`[setup-review-tester] created user ${created.id}`);
    return { id: created.id, created: true };
  }
  if (r.status === 422 || r.status === 400) {
    // Already exists — list and find. Pull only the first page (default 50)
    // since we'd never have hundreds of testers.
    const list = await fetch(`${SB_URL}/auth/v1/admin/users?per_page=200`, {
      headers: adminHdrs,
    });
    if (!list.ok) fail(`could not list users: ${list.status}`);
    const { users = [] } = await list.json();
    const existing = users.find((u) => (u.email || "").toLowerCase() === EMAIL);
    if (!existing) fail(`tester user not found and could not be created (${r.status})`);
    console.log(`[setup-review-tester] user already exists: ${existing.id}`);
    // Update the password so the reviewer credentials stay current.
    const upd = await fetch(`${SB_URL}/auth/v1/admin/users/${existing.id}`, {
      method: "PUT",
      headers: adminHdrs,
      body: JSON.stringify({
        password: PASSWORD,
        email_confirm: true,
        user_metadata: {
          ...(existing.user_metadata ?? {}),
          review_tester: true,
        },
      }),
    });
    if (!upd.ok) {
      const t = await upd.text().catch(() => "");
      fail(`could not refresh tester password: ${upd.status} ${t.slice(0, 200)}`);
    }
    return { id: existing.id, created: false };
  }
  const t = await r.text().catch(() => "");
  fail(`unexpected create status ${r.status}: ${t.slice(0, 200)}`);
}

async function ensureProfile(userId) {
  // user_profiles row + onboarded flag.
  const r = await fetch(`${SB_URL}/rest/v1/user_profiles?on_conflict=user_id`, {
    method: "POST",
    headers: {
      ...adminHdrs,
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({
      user_id: userId,
      onboarding_completed: true,
      tier: "free",
    }),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    console.warn(`[setup-review-tester] user_profiles upsert HTTP ${r.status}: ${t.slice(0, 200)}`);
  } else {
    console.log("[setup-review-tester] user_profiles marked onboarded");
  }
}

async function ensurePersonalBrain(userId) {
  // The brain auto-provisioning on first sign-in lives in api/user-data.ts
  // (handleBrains POST). Calling that path requires an auth token; we'd
  // rather just insert directly here so the tester sees a brain on first
  // open without needing to go through the auto-provision round trip.
  const list = await fetch(
    `${SB_URL}/rest/v1/brains?owner_id=eq.${userId}&is_personal=eq.true&select=id&limit=1`,
    { headers: adminHdrs },
  );
  if (list.ok) {
    const rows = await list.json();
    if (rows.length) {
      console.log(`[setup-review-tester] personal brain already exists: ${rows[0].id}`);
      return rows[0].id;
    }
  }
  const r = await fetch(`${SB_URL}/rest/v1/brains`, {
    method: "POST",
    headers: { ...adminHdrs, Prefer: "return=representation" },
    body: JSON.stringify({
      owner_id: userId,
      name: "My Brain",
      is_personal: true,
    }),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    fail(`brain create HTTP ${r.status}: ${t.slice(0, 200)}`);
  }
  const [brain] = await r.json();
  console.log(`[setup-review-tester] created personal brain ${brain.id}`);
  return brain.id;
}

async function seedSampleEntries(userId, brainId) {
  // Six entries spanning the core surfaces. Each is short, plausible, and
  // PG-safe. Avoid anything that looks scraped or copyrighted.
  const SAMPLES = [
    {
      type: "note",
      title: "Family WiFi password",
      content: "Setup notes for the household. Good signal upstairs, sketchy in the garage.",
    },
    {
      type: "todo",
      title: "Renew driver's licence",
      content: "Form DL1 + ID + R250 fee. Closest licencing centre is Vereeniging.",
      metadata: {
        due_date: new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10),
      },
    },
    {
      type: "person",
      title: "Sarah — bookkeeper",
      content: "Available Tue/Thu mornings. Prefers WhatsApp over email.",
      metadata: { phone: "+27821234567", email: "sarah@example.com" },
    },
    {
      type: "note",
      title: "Sample idea — second-brain product loop",
      content:
        "Capture is fast, recall is faster. The vault is for stuff you'd be stuck without — IDs, gate codes, alarm panel. Two halves of one app.",
    },
    {
      type: "note",
      title: "Insurance policy reference",
      content:
        "Policy number 78A-2024-0091. Renewal April 2026. Broker: Hollard. Premium R612/mo.",
      metadata: {
        url: "https://example.com/policy-pdf",
      },
    },
    {
      type: "reminder",
      title: "Check on the chimney sweep",
      content: "Booked for next month. Confirm timing the week before.",
      metadata: {
        due_date: new Date(Date.now() + 21 * 86_400_000).toISOString().slice(0, 10),
      },
    },
  ];

  // Skip seeding if the tester already has entries — keep the script idempotent.
  const existing = await fetch(
    `${SB_URL}/rest/v1/entries?user_id=eq.${userId}&deleted_at=is.null&select=id&limit=1`,
    { headers: adminHdrs },
  );
  if (existing.ok) {
    const rows = await existing.json();
    if (rows.length) {
      console.log(`[setup-review-tester] entries already exist (${rows.length}+) — skipping seed`);
      return;
    }
  }

  for (const s of SAMPLES) {
    const r = await fetch(`${SB_URL}/rest/v1/entries`, {
      method: "POST",
      headers: { ...adminHdrs, Prefer: "return=minimal" },
      body: JSON.stringify({
        user_id: userId,
        brain_id: brainId,
        type: s.type,
        title: s.title,
        content: s.content,
        metadata: s.metadata ?? {},
      }),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      console.warn(`[setup-review-tester] entry insert HTTP ${r.status}: ${t.slice(0, 200)}`);
    }
  }
  console.log(`[setup-review-tester] seeded ${SAMPLES.length} sample entries`);
}

async function logSetupRun(userId) {
  await fetch(`${SB_URL}/rest/v1/audit_log`, {
    method: "POST",
    headers: { ...adminHdrs, Prefer: "return=minimal" },
    body: JSON.stringify({
      actor_id: userId,
      action: "review_tester_setup",
      metadata: {
        email: EMAIL,
        ts: new Date().toISOString(),
        source: "scripts/setup-review-tester.mjs",
      },
    }),
  });
}

async function main() {
  console.log(`[setup-review-tester] target email: ${EMAIL}`);
  const { id, created } = await findUserByEmail();
  await ensureProfile(id);
  const brainId = await ensurePersonalBrain(id);
  await seedSampleEntries(id, brainId);
  await logSetupRun(id);
  console.log(`[setup-review-tester] done. user=${id} brain=${brainId} created=${created}`);
}

main().catch((err) => {
  console.error("[setup-review-tester] fatal:", err);
  process.exit(1);
});
