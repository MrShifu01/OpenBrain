#!/usr/bin/env -S npx tsx
/**
 * Manual one-shot sweep of e2e residue from the admin's brain.
 *
 *   npm run e2e:clean
 *
 * Same logic as global-setup / global-teardown but invokable any time the
 * admin notices test entries on prod (e.g. a CI run got SIGKILL'd between
 * setup and teardown). Reads creds from .env.local same as global-setup.
 */

import fs from "node:fs";
import path from "node:path";
import { sweepE2EResidue } from "../e2e/helpers/sweep-residue";

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

async function main(): Promise<void> {
  const local = readEnvLocal();
  const get = (key: string): string => process.env[key] ?? local[key] ?? "";

  const supabaseUrl = get("VITE_SUPABASE_URL");
  const anonKey = get("VITE_SUPABASE_ANON_KEY");
  const email = get("E2E_ADMIN_EMAIL");
  const password = get("E2E_ADMIN_PASSWORD");

  const missing = [
    !supabaseUrl && "VITE_SUPABASE_URL",
    !anonKey && "VITE_SUPABASE_ANON_KEY",
    !email && "E2E_ADMIN_EMAIL",
    !password && "E2E_ADMIN_PASSWORD",
  ].filter(Boolean);
  if (missing.length) {
    console.error(`[e2e:clean] missing env: ${missing.join(", ")}`);
    process.exit(1);
  }

  const result = await sweepE2EResidue({
    supabaseUrl,
    anonKey,
    email,
    password,
    phase: "manual",
  });

  const total =
    result.entries +
    result.importantMemories +
    result.vaultEntries +
    result.brainInvites +
    result.brains;
  console.log(`[e2e:clean] done. ${total} artifact${total === 1 ? "" : "s"} removed.`);
  console.log(
    "  Refresh your Everion app (or hard-reload) to see the cache catch up to the DB.",
  );
}

void main();
