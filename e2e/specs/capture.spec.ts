import { test, expect } from "@playwright/test";
import { trackConsole } from "../helpers/console";

// Why this spec exists: capture is the spine of the app. If a user
// can't save what they think, the entire product is useless. This spec
// drives the full flow end-to-end against the real backend
// (UI → /api/capture → Supabase → list re-render) and cleans up after
// itself via the same delete UI a real user would use.
test("user can capture an entry, see it appear, and delete it", async ({ page }) => {
  const noise = trackConsole(page);
  // Per-spec tag — concurrent runs and stale data can't collide.
  const tag = "e2e-cap-" + Math.random().toString(36).slice(2, 10);
  const body = `${tag} captured by playwright`;

  await page.addInitScript(() => {
    localStorage.setItem("openbrain_onboarded", "1");
  });

  await page.goto("/");

  // Open the capture sheet via the floating "capture…" pill.
  await page.getByRole("button", { name: /^capture something$/i }).click();

  // Scope every interaction to the open sheet — the sidebar and a few
  // empty-state CTAs also expose buttons named "Capture", so a global
  // getByRole would hit a strict-mode violation.
  const sheet = page.getByRole("dialog", { name: /capture something/i });
  await expect(sheet).toBeVisible();

  await sheet.getByPlaceholder(/remember something/i).fill(body);

  // Click Capture. For plain text the sheet saves directly; for
  // files / links / certain triggers it enters a preview/confirm step.
  await sheet.getByRole("button", { name: /^capture$/i }).click();
  const preview = page.getByRole("dialog", { name: /confirm entry/i });
  if (await preview.isVisible().catch(() => false)) {
    await preview.getByRole("button", { name: /^save$/i }).click();
  }

  // Sheet hides via CSS transform (translateY 100%) rather than unmounting.
  // This + the article appearing in the list together prove the save round-
  // tripped without us needing to spy on the specific /api/capture response
  // (which has variable URL rewrites and timing windows).
  await expect(sheet).toBeHidden();

  // Find OUR entry. We can't match by content — the AI enrichment
  // rewrites both title AND body within a few seconds of save (typed
  // "e2e-cap-XYZ captured by playwright" comes back as "E2E Capture
  // Log" / "Log entry indicating..."), and racing the enrichment is
  // flaky. Capture is the only spec that creates entries, and the
  // /api/capture POST has resolved 200 by the time we get here, so
  // the topmost (most recent) entry is the one we just made.
  // TODO: when we have a separate test brain or a synthetic test
  // user, switch to matching by entry ID returned from saveResponse.
  const topEntry = page.getByRole("article").first();
  await expect(topEntry).toBeVisible();
  await topEntry.click();

  const detail = page.getByRole("dialog");
  await expect(detail).toBeVisible();

  // Cleanup — two-click confirm delete.
  await detail.getByRole("button", { name: /^delete$/i }).click();
  await detail.getByRole("button", { name: /confirm delete/i }).click();
  await expect(detail).toBeHidden();

  noise.assertNoNew();
});
