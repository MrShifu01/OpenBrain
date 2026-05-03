/**
 * Sweep e2e residue from the admin's brain.
 *
 * Targets ANY artifact that bears the e2e fingerprint:
 *   • entries          — title/content ilike '*e2e-*' OR tags contains 'e2e' OR
 *                        metadata->>e2e_test = 'true'
 *   • important_memories — title/summary/memory_key matching 'e2e-*'
 *   • vault_entries    — title matching 'e2e-*'
 *   • brain_invites    — invited_by = admin AND email contains 'e2e' / 'playwright'
 *   • brains           — non-personal brains owned by admin whose name matches 'e2e-*'
 *
 * The widest-net rule is the metadata flag — every spec creating an entry
 * stamps `metadata.e2e_test = true`, and the title-prefix rule is the legacy
 * defence. We keep both so a prior-version test that didn't set the metadata
 * flag still gets caught by title.
 *
 * Real user data won't carry these markers. Scoped to the admin user_id so
 * we never touch another account.
 *
 * Called from BOTH global-setup (before tests run) and global-teardown
 * (after tests run). Also exposed as `npm run e2e:clean` for manual sweeps.
 */

interface SweepDeps {
  supabaseUrl: string;
  anonKey: string;
  email: string;
  password: string;
  /** Phase tag for the log line ("setup" / "teardown" / "manual") so logs are diffable. */
  phase: "setup" | "teardown" | "manual";
}

interface SweepResult {
  entries: number;
  importantMemories: number;
  vaultEntries: number;
  brainInvites: number;
  brains: number;
}

interface TableSpec {
  name: keyof Omit<SweepResult, never>;
  table: string;
  /** Filter URL fragment beginning with `&` — appended to the base URL. */
  filter: string;
  /** The user-scoping filter (`user_id=eq.X` etc.) — repeated on the DELETE. */
  scopeFilter: string;
}

export async function sweepE2EResidue(deps: SweepDeps): Promise<SweepResult> {
  const { supabaseUrl, anonKey, email, password, phase } = deps;
  const empty: SweepResult = {
    entries: 0,
    importantMemories: 0,
    vaultEntries: 0,
    brainInvites: 0,
    brains: 0,
  };
  if (!supabaseUrl || !anonKey || !email || !password) return empty;

  let accessToken = "";
  let userId = "";
  try {
    const r = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: anonKey },
      body: JSON.stringify({ email, password }),
    });
    if (!r.ok) {
      console.warn(`[e2e:${phase}] sign-in failed: ${r.status}`);
      return empty;
    }
    const session = (await r.json()) as {
      access_token: string;
      user: { id: string };
    };
    accessToken = session.access_token;
    userId = session.user.id;
  } catch (err) {
    console.warn(`[e2e:${phase}] sign-in threw:`, err);
    return empty;
  }
  if (!accessToken || !userId) return empty;

  const headers = {
    apikey: anonKey,
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };

  const userScope = `user_id=eq.${encodeURIComponent(userId)}`;
  const ownerScope = `owner_id=eq.${encodeURIComponent(userId)}`;
  const inviterScope = `invited_by=eq.${encodeURIComponent(userId)}`;

  // PostgREST top-level filter syntax: `column=op.value`. Inside `or=(...)`
  // each clause uses dots: `column.op.value`. Each spec's row is matched
  // by the `or=(...)` block; the scope filter (user_id / owner_id) is its
  // own top-level clause.
  const specs: TableSpec[] = [
    {
      name: "entries",
      table: "entries",
      filter: `&${userScope}&or=(title.ilike.*e2e-*,content.ilike.*e2e-*,tags.cs.{e2e},metadata->>e2e_test.eq.true)`,
      scopeFilter: userScope,
    },
    {
      name: "importantMemories",
      table: "important_memories",
      filter: `&${userScope}&or=(title.ilike.*e2e-*,memory_key.ilike.e2e-*,summary.ilike.*e2e-*)`,
      scopeFilter: userScope,
    },
    {
      name: "vaultEntries",
      table: "vault_entries",
      filter: `&${userScope}&title=ilike.*e2e-*`,
      scopeFilter: userScope,
    },
    {
      name: "brainInvites",
      table: "brain_invites",
      filter: `&${inviterScope}&or=(email.ilike.*e2e*,email.ilike.*playwright*)`,
      scopeFilter: inviterScope,
    },
    {
      name: "brains",
      table: "brains",
      filter: `&${ownerScope}&is_personal=eq.false&name=ilike.*e2e-*`,
      scopeFilter: ownerScope,
    },
  ];

  const result: SweepResult = { ...empty };
  for (const spec of specs) {
    const findUrl = `${supabaseUrl}/rest/v1/${spec.table}?select=id&limit=2000${spec.filter}`;
    const count = await deleteMatching(findUrl, spec.table, spec.scopeFilter, headers, supabaseUrl);
    (result as unknown as Record<string, number>)[spec.name] = count;
  }

  const total =
    result.entries +
    result.importantMemories +
    result.vaultEntries +
    result.brainInvites +
    result.brains;
  if (total === 0) {
    if (phase !== "teardown") console.log(`[e2e:${phase}] no residue to sweep`);
    return result;
  }

  console.log(
    `[e2e:${phase}] swept ${total} residue artifact${total === 1 ? "" : "s"} ` +
      `(entries=${result.entries}, important=${result.importantMemories}, ` +
      `vault=${result.vaultEntries}, invites=${result.brainInvites}, brains=${result.brains})`,
  );
  return result;
}

async function deleteMatching(
  findUrl: string,
  table: string,
  scopeFilter: string,
  headers: Record<string, string>,
  supabaseUrl: string,
): Promise<number> {
  let leaks: Array<{ id: string }> = [];
  try {
    const r = await fetch(findUrl, { headers });
    if (!r.ok) {
      const detail = await r.text().catch(() => "");
      console.warn(`[e2e:sweep] ${table} list failed: ${r.status} ${detail.slice(0, 120)}`);
      return 0;
    }
    leaks = (await r.json()) as Array<{ id: string }>;
  } catch (err) {
    console.warn(`[e2e:sweep] ${table} list threw:`, err);
    return 0;
  }
  if (leaks.length === 0) return 0;

  // Batch DELETE via id=in.(...) — keep chunks small to stay under URL limits.
  const ids = leaks.map((r) => r.id);
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 50) chunks.push(ids.slice(i, i + 50));

  let deleted = 0;
  for (const chunk of chunks) {
    const inList = chunk.map((id) => encodeURIComponent(id)).join(",");
    const delUrl = `${supabaseUrl}/rest/v1/${table}?${scopeFilter}&id=in.(${inList})`;
    try {
      const r = await fetch(delUrl, { method: "DELETE", headers });
      if (r.ok) deleted += chunk.length;
      else {
        const detail = await r.text().catch(() => "");
        console.warn(
          `[e2e:sweep] ${table} delete chunk failed: ${r.status} ${detail.slice(0, 120)}`,
        );
      }
    } catch (err) {
      console.warn(`[e2e:sweep] ${table} delete chunk threw:`, err);
    }
  }
  return deleted;
}
