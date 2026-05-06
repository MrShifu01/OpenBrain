/**
 * Playwright global teardown — runs once after all tests finish.
 *
 * Floor-sweep for any e2e-tagged entries that escaped per-spec cleanup.
 * Per-spec finally blocks are the primary defence (every test deletes what
 * it creates), but if a test crashes mid-flight before reaching its finally
 * an entry survives. Without this teardown those orphans accumulate in the
 * admin's brain and pollute real memory.
 *
 * Mirrors the sweep that global-setup runs at the start of each run — same
 * helper, just a different phase tag for the log line. See
 * e2e/helpers/sweep-residue.ts for the matching rule and scope.
 */

import fs from "node:fs";
import path from "node:path";
import { sweepE2EResidue } from "./helpers/sweep-residue";

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

  await sweepE2EResidue({
    supabaseUrl: get("VITE_SUPABASE_URL"),
    anonKey: get("VITE_SUPABASE_ANON_KEY"),
    email: get("E2E_ADMIN_EMAIL"),
    password: get("E2E_ADMIN_PASSWORD"),
    phase: "teardown",
  });
}
