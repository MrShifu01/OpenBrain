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

  // Wait for the actual save round-trip before asserting anything UI-side.
  // /api/capture is the canonical endpoint; the rewrites in vercel.json
  // route a few aliases there but the underlying call is the same.
  const saveResponse = page.waitForResponse(
    (r) =>
      r.url().includes("/api/capture") &&
      r.request().method() === "POST" &&
      r.ok(),
    { timeout: 20_000 },
  );

  // Click Capture. For plain text the sheet saves directly; for
  // files / links / certain triggers it enters a preview/confirm step.
  await sheet.getByRole("button", { name: /^capture$/i }).click();
  const preview = page.getByRole("dialog", { name: /confirm entry/i });
  if (await preview.isVisible().catch(() => false)) {
    await preview.getByRole("button", { name: /^save$/i }).click();
  }

  // Server confirmed the save.
  await saveResponse;
  // Sheet hides via CSS transform (translateY 100%) rather than unmounting.
  await expect(sheet).toBeHidden();

  // Find OUR entry. AI enrichment rewrites the title (real-world
  // observation: tagged "e2e-cap-XYZ captured by playwright" entries
  // get re-titled to "Playwright Capture Log"), so the tag-in-title
  // approach is unreliable. The body content is preserved, so we open
  // the topmost (most recent) entry and verify by body match.
  // Workers run serially in CI and one-at-a-time locally, so the most
  // recent entry is guaranteed to be the one we just created.
  const topEntry = page.getByRole("article").first();
  await expect(topEntry).toBeVisible();
  await topEntry.click();

  const detail = page.getByRole("dialog");
  await expect(detail).toBeVisible();
  // The detail modal renders the body — assert our tag is in it.
  // If this fails, we'd be deleting someone else's entry, which is bad.
  await expect(detail).toContainText(tag);

  // Cleanup — two-click confirm delete.
  await detail.getByRole("button", { name: /^delete$/i }).click();
  await detail.getByRole("button", { name: /confirm delete/i }).click();
  await expect(detail).toBeHidden();

  noise.assertNoNew();
});
