/**
 * Lighthouse — synthetic audit against the production custom domain.
 *
 * Runs mobile + desktop presets, saves timestamped HTML + JSON reports
 * under `.lighthouse/`, prints a summary table to stdout. Doesn't fail
 * on score thresholds — this is monitoring, not a build gate. The
 * companion GitHub workflow (`.github/workflows/lighthouse.yml`) runs
 * the same script weekly so trend data accumulates without a single
 * false-red CI build.
 *
 *   npm run lighthouse                              # against prod
 *   LH_URL=https://staging... npm run lighthouse    # arbitrary URL
 *
 * Why we test the custom domain not target_url: same reason as the e2e
 * workflow — Vercel Deployment Protection 401s the *.vercel.app URLs.
 * (See memory: vercel-deployment-protection.)
 *
 * Why programmatic, not CLI: the lighthouse CLI calls chrome-launcher's
 * cleanup which fails with EPERM on Windows ~half the time (file-lock
 * race on the headless Chrome temp dir). Owning the Chrome lifecycle
 * lets us swallow that specific cleanup error without losing the
 * actual audit results.
 */
// @ts-expect-error — lighthouse types are CommonJS-shaped, ESM import works at runtime
import lighthouse from "lighthouse";
import * as chromeLauncher from "chrome-launcher";
// @ts-expect-error — lighthouse desktop config has no shipped .d.ts
import desktopConfig from "lighthouse/core/config/desktop-config.js";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const URL_TO_AUDIT = process.env.LH_URL ?? "https://everion.smashburgerbar.co.za";
const OUT_DIR = ".lighthouse";
const PRESETS = ["mobile", "desktop"] as const;
type Preset = (typeof PRESETS)[number];

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

interface RunResult {
  preset: Preset;
  perf: number;
  a11y: number;
  best: number;
  seo: number;
  htmlPath: string;
}

async function auditOnce(preset: Preset): Promise<RunResult> {
  const chrome = await chromeLauncher.launch({
    chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu"],
  });
  try {
    const flags = {
      logLevel: "error" as const,
      output: ["html", "json"] as Array<"html" | "json">,
      port: chrome.port,
    };
    const config = preset === "desktop" ? desktopConfig : undefined;
    const result = await lighthouse(URL_TO_AUDIT, flags, config);
    if (!result) throw new Error(`lighthouse ${preset} returned no result`);
    const [html, json] = result.report as [string, string];
    const base = path.join(OUT_DIR, `${stamp}-${preset}`);
    writeFileSync(`${base}.html`, html);
    writeFileSync(`${base}.json`, json);
    const lhr = result.lhr as {
      categories: Record<string, { score: number | null }>;
    };
    const score = (key: string): number =>
      Math.round((lhr.categories[key]?.score ?? 0) * 100);
    return {
      preset,
      perf: score("performance"),
      a11y: score("accessibility"),
      best: score("best-practices"),
      seo: score("seo"),
      htmlPath: `${base}.html`,
    };
  } finally {
    // chrome-launcher.kill() does an `rm -rf` of its temp profile dir.
    // On Windows that race-loses to whatever still has handles open,
    // throws EPERM. The audit's already saved by this point — swallow.
    try {
      await chrome.kill();
    } catch {
      /* known-Windows-only cleanup race; ignore */
    }
  }
}

// Retry once on Chrome protocol flakes ("Execution context was destroyed",
// "Target closed", etc.). One retry beats marking the weekly run red on a
// transient that has nothing to do with the site under test.
async function audit(preset: Preset): Promise<RunResult | null> {
  try {
    return await auditOnce(preset);
  } catch (err) {
    console.warn(`  ${preset} attempt 1 failed: ${(err as Error).message}`);
    console.warn(`  retrying ${preset}…`);
    try {
      return await auditOnce(preset);
    } catch (err2) {
      console.error(`  ${preset} attempt 2 failed: ${(err2 as Error).message}`);
      return null;
    }
  }
}

function flag(n: number): string {
  if (n >= 90) return "✓";
  if (n >= 75) return "!";
  return "✗";
}

function pad(s: string | number, w: number): string {
  return String(s).padEnd(w);
}

async function main(): Promise<void> {
  console.log(`\nLighthouse → ${URL_TO_AUDIT}\n`);
  const results: Array<RunResult | { preset: Preset; failed: true }> = [];
  for (const preset of PRESETS) {
    console.log(`  running ${preset}…`);
    const r = await audit(preset);
    results.push(r ?? { preset, failed: true });
  }

  console.log("\n  Preset     Perf    A11y    Best    SEO");
  console.log("  ──────────────────────────────────────────");
  for (const r of results) {
    if ("failed" in r) {
      console.log(`  ${pad(r.preset, 9)}  (audit failed twice — see logs)`);
      continue;
    }
    console.log(
      `  ${pad(r.preset, 9)}  ${pad(r.perf, 3)} ${flag(r.perf)}   ${pad(
        r.a11y,
        3,
      )} ${flag(r.a11y)}   ${pad(r.best, 3)} ${flag(r.best)}   ${pad(r.seo, 3)} ${flag(r.seo)}`,
    );
  }
  console.log("\n  ✓ ≥90   ! ≥75   ✗ <75\n");
  console.log(`  reports → ${OUT_DIR}/${stamp}-*.{html,json}\n`);

  // Exit non-zero only if EVERY preset failed. Partial success still
  // uploads useful artifacts and shouldn't redden the weekly run.
  const allFailed = results.every((r) => "failed" in r);
  if (allFailed) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
