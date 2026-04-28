/**
 * Console / network error tracking for Playwright specs.
 *
 * Naïve `page.on("pageerror", err => throw err)` is a flake factory in this
 * codebase — Supabase realtime reconnects, intentionally-missing tables
 * (entry_brains), and Vite HMR all log noise that isn't actionable.
 *
 * Pattern: collect errors with an allow-list, assert "no NEW errors" at the
 * end of each spec via `noise.assertNoNew()`. New errors fail the test;
 * allow-listed noise is documented inline with a TODO to clean it up.
 *
 * See: ~/.claude/skills/playwright-everion/SKILL.md (Rule 4)
 */
import type { Page } from "@playwright/test";

// Each entry MUST have a comment explaining why it's allowed.
// Remove the entry the moment the underlying noise source is fixed.
const ALLOW: Array<RegExp> = [
  // entry_brains table does not exist by design — see CLAUDE.md
  /entry_brains/i,
  // Supabase realtime reconnect chatter — not actionable
  /WebSocket connection.*closed/i,
  // Vite HMR / dev-only chatter — only present in `npm run dev` runs
  /\[vite\]/i,
  // The Playwright webServer boots `npm run dev` (Vite only — no Vercel
  // functions), so any /api/* call throws "Failed to fetch". The app's
  // authFetch wrapper logs these as "[OpenBrain] /api/X failed". Both
  // are environmental, not real regressions.
  // TODO: switch playwright.config webServer to `vercel dev` and remove
  // these two entries.
  /TypeError: Failed to fetch/i,
  /\[OpenBrain\] \/api\/.*failed/i,
];

export interface ConsoleTracker {
  errors: string[];
  assertNoNew(): void;
}

export function trackConsole(page: Page): ConsoleTracker {
  const errors: string[] = [];

  page.on("pageerror", (err) => {
    const msg = err.message ?? String(err);
    if (ALLOW.some((rx) => rx.test(msg))) return;
    errors.push(`pageerror: ${msg}`);
  });

  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    // Chromium auto-emits "Failed to load resource: the server responded
    // with a status of <N>" for every non-2xx response. The response
    // listener below already governs network failures and intentionally
    // ignores 4xx, so we'd double-count if we kept these.
    if (/^Failed to load resource:/.test(text)) return;
    if (ALLOW.some((rx) => rx.test(text))) return;
    errors.push(`console.error: ${text}`);
  });

  page.on("response", (res) => {
    const status = res.status();
    if (status < 500) return; // 4xx is allowed (auth, missing rows, intentional 404s)
    const url = res.url();
    if (ALLOW.some((rx) => rx.test(url))) return;
    errors.push(`HTTP ${status} ${url}`);
  });

  return {
    errors,
    assertNoNew(): void {
      if (errors.length === 0) return;
      throw new Error(
        `Captured ${errors.length} unexpected console/network error(s):\n` +
          errors.map((e) => "  • " + e).join("\n"),
      );
    },
  };
}
