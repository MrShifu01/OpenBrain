/**
 * Sweep e2e residue from the admin's brain.
 *
 * Targets ONLY entries whose title OR content matches the `e2e-` prefix the
 * spec template generates (`e2e-<slug>-<random>` via Math.random().toString(36)).
 * Real user data won't match that exact prefix shape.
 *
 * Called from BOTH global-setup (before tests run, so residue from a previous
 * crashed run doesn't sit in the admin's UI between runs) and global-teardown
 * (after tests run, so anything new this run leaks gets caught).
 *
 * Scoped to the admin user_id — never touches another user's data.
 */

interface SweepDeps {
  supabaseUrl: string;
  anonKey: string;
  email: string;
  password: string;
  /** Phase tag for the log line ("setup" / "teardown") so logs are diffable. */
  phase: "setup" | "teardown";
}

export async function sweepE2EResidue(deps: SweepDeps): Promise<void> {
  const { supabaseUrl, anonKey, email, password, phase } = deps;
  if (!supabaseUrl || !anonKey || !email || !password) return;

  // Fresh sign-in — storageState may not exist (setup phase) or may be stale
  // (teardown phase). Either way we get a usable token here.
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

  // PostgREST `or` syntax with ilike — e2e- prefix in either column.
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
  if (leaks.length === 0) {
    if (phase === "setup") console.log(`[e2e:${phase}] no residue to sweep`);
    return;
  }

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

  console.log(
    `[e2e:${phase}] swept ${deleted}/${leaks.length} e2e residue ${
      leaks.length === 1 ? "entry" : "entries"
    }`,
  );
}
