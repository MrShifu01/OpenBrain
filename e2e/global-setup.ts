/**
 * Playwright global setup — runs once before all tests.
 *
 * Signs the admin account in headlessly via the Supabase Auth REST API,
 * then writes a Playwright storageState file that every subsequent test
 * loads. No production code change, no test-only auth bypass — tests see
 * the same JWT a real signed-in admin would.
 *
 * The storageState file (e2e/.auth/admin.json) is gitignored. Add fresh
 * E2E_ADMIN_* credentials to .env.local; this file reads them via dotenv.
 *
 * Re-run setup any time the token has expired (`npx playwright test`
 * triggers it automatically).
 */

import { chromium, type FullConfig } from "@playwright/test";
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

export default async function globalSetup(_config: FullConfig): Promise<void> {
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
    throw new Error(
      `[e2e:global-setup] missing env: ${missing.join(", ")}.\n` +
        `Add E2E_ADMIN_EMAIL + E2E_ADMIN_PASSWORD to .env.local; the Supabase ` +
        `vars are already there.`,
    );
  }

  // Sweep residue from any previous run BEFORE we start. Without this, an
  // aborted/crashed run could leave entries sitting in the admin's brain
  // until the next teardown — pollutes the real UI between runs. Best-effort:
  // failures are swallowed inside sweepE2EResidue so a teardown problem
  // doesn't gate the run.
  await sweepE2EResidue({ supabaseUrl, anonKey, email, password, phase: "setup" });

  // Sign in via the Auth REST API directly — no browser flake, no UI.
  const tokenRes = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
    },
    body: JSON.stringify({ email, password }),
  });
  if (!tokenRes.ok) {
    const detail = await tokenRes.text().catch(() => "");
    throw new Error(`[e2e:global-setup] sign-in failed: ${tokenRes.status} ${detail}`);
  }
  const session = (await tokenRes.json()) as {
    access_token: string;
    refresh_token: string;
    expires_at: number;
    expires_in: number;
    token_type: string;
    user: { id: string; email: string; [key: string]: unknown };
  };

  // Mirror the shape supabase-js stores in localStorage so the client picks
  // up the session on first load. Key spelling matches src/lib/supabase.ts:
  //   sb-<project-ref>-auth-token
  const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
  const storageKey = `sb-${projectRef}-auth-token`;
  const supabaseSession = {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    expires_in: session.expires_in,
    token_type: session.token_type,
    user: session.user,
  };

  // Boot a real Chromium context, drop the session into localStorage on the
  // app origin, and snapshot the storage state Playwright will replay.
  const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:5174";
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(baseURL);
  await page.evaluate(
    ([key, sessionJson, emailValue]) => {
      localStorage.setItem(key, sessionJson);
      // Mirror what SettingsView would write so the admin chip / sidebar
      // pick the right email up immediately, before the auth state effect
      // gets a chance to run.
      localStorage.setItem("everion_email", emailValue);
      // Pre-decline the analytics consent banner. Without this it sits
      // pinned to the bottom of the viewport and intercepts pointer
      // events on the floating capture pill (and anything else in the
      // bottom-right). No spec exercises the banner itself.
      localStorage.setItem("everion_analytics_consent", "declined");
    },
    [storageKey, JSON.stringify(supabaseSession), email],
  );

  const outDir = path.resolve(process.cwd(), "e2e/.auth");
  fs.mkdirSync(outDir, { recursive: true });
  await context.storageState({ path: path.join(outDir, "admin.json") });
  await browser.close();
}
