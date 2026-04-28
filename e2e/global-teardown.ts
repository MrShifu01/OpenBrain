/**
 * Playwright global teardown — runs once after all tests finish.
 *
 * Floor-sweep for any e2e-tagged entries that escaped per-spec cleanup.
 * Per-spec cleanup is the primary defense (every test deletes what it
 * creates), but if a test crashes mid-flight before reaching its finally,
 * an entry can still survive. Without this teardown those orphan entries
 * accumulate in the admin's brain and pollute real memory.
 *
 * Targets ONLY entries whose title OR content matches the `e2e-` prefix
 * the spec template generates (`Math.random().toString(36).slice(2,10)`).
 * Real user data won't ever match that exact prefix shape.
 */

import fs from "node:fs";
import path from "node:path";

function readEnvLocal(): Record<string, string> {
  const out: Record<string, string> = {};
  const file = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(file)) return out;
  const text = fs.readFileSync(file, "utf-8");
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

export default async function globalTeardown(): Promise<void> {
  const local = readEnvLocal();
  const get = (key: string): string => process.env[key] ?? local[key] ?? "";

  const supabaseUrl = get("VITE_SUPABASE_URL");
  const anonKey = get("VITE_SUPABASE_ANON_KEY");
  const email = get("E2E_ADMIN_EMAIL");
  const password = get("E2E_ADMIN_PASSWORD");

  if (!supabaseUrl || !anonKey || !email || !password) {
    // No creds = nothing to clean up against. Don't fail the run.
    return;
  }

  // Fresh sign-in — storageState may be stale by the time teardown runs.
  let accessToken = "";
  let userId = "";
  try {
    const r = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: anonKey },
      body: JSON.stringify({ email, password }),
    });
    if (!r.ok) return;
    const session = (await r.json()) as {
      access_token: string;
      user: { id: string };
    };
    accessToken = session.access_token;
    userId = session.user.id;
  } catch {
    return;
  }

  if (!accessToken || !userId) return;

  const headers = {
    apikey: anonKey,
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };

  // Find anything that looks like e2e residue. PostgREST `or` syntax with
  // ilike — e2e- prefix in either title or content.
  const findUrl =
    `${supabaseUrl}/rest/v1/entries` +
    `?user_id=eq.${encodeURIComponent(userId)}` +
    `&or=(title.ilike.*e2e-*,content.ilike.*e2e-*)` +
    `&select=id,title&limit=1000`;

  let leaks: Array<{ id: string; title: string }> = [];
  try {
    const r = await fetch(findUrl, { headers });
    if (!r.ok) return;
    leaks = (await r.json()) as Array<{ id: string; title: string }>;
  } catch {
    return;
  }

  if (leaks.length === 0) return;

  // Hard-delete each. /api/delete-entry on the app does the same via
  // service role — but we hit PostgREST directly here to avoid depending
  // on the dev server still running.
  let deleted = 0;
  for (const row of leaks) {
    try {
      const r = await fetch(`${supabaseUrl}/rest/v1/entries?id=eq.${encodeURIComponent(row.id)}`, {
        method: "DELETE",
        headers,
      });
      if (r.ok) deleted += 1;
    } catch {
      /* best-effort */
    }
  }

  // eslint-disable-next-line no-console -- this only runs in test harness
  console.log(
    `[e2e:teardown] swept ${deleted}/${leaks.length} e2e residue ${leaks.length === 1 ? "entry" : "entries"}`,
  );
}
