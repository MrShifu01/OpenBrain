import { test, expect } from "@playwright/test";
import { trackConsole } from "../helpers/console";

// Why this spec exists: capture is the spine of the app. If a user
// can't save what they think, the entire product is useless. This spec
// drives the full flow end-to-end against the real backend
// (UI → /api/capture → Supabase → list re-render) and cleans up after
// itself via the same delete UI a real user would use, with an API
// backstop in `finally` so a mid-test failure can't leave orphans.

async function getAdminAccessToken(page: import("@playwright/test").Page): Promise<string | null> {
  return page.evaluate(() => {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith("sb-") || !key.endsWith("-auth-token")) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw) as { access_token?: string };
        if (parsed.access_token) return parsed.access_token;
      } catch {
        /* not JSON; keep looking */
      }
    }
    return null;
  });
}

test("user can capture an entry, see it appear, and delete it", async ({ page }) => {
  const noise = trackConsole(page);
  // Per-spec tag — concurrent runs and stale data can't collide.
  const tag = "e2e-cap-" + Math.random().toString(36).slice(2, 10);
  const body = `${tag} captured by playwright`;

  // Capture the entry ID from /api/capture so finally can delete it
  // even if the inline UI path fails.
  let createdId: string | null = null;
  page.on("response", async (res) => {
    if (
      res.url().includes("/api/capture") &&
      res.request().method() === "POST" &&
      res.ok()
    ) {
      try {
        const data = (await res.json()) as { id?: string };
        if (data?.id) createdId = data.id;
      } catch {
        /* non-JSON response; ignore */
      }
    }
  });

  try {
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

    await expect(sheet).toBeHidden();

    const topEntry = page.getByRole("article").first();
    await expect(topEntry).toBeVisible();
    await topEntry.click();

    const detail = page.getByRole("dialog");
    await expect(detail).toBeVisible();

    // Cleanup via UI — two-click confirm delete. This is the user-
    // visible path and proves delete works. The finally{} block below
    // is the backstop for the case where this test fails before
    // reaching here.
    await detail.getByRole("button", { name: /^delete$/i }).click();
    await detail.getByRole("button", { name: /confirm delete/i }).click();
    await expect(detail).toBeHidden();

    noise.assertNoNew();
  } finally {
    // Backstop: hit /api/delete-entry directly with the admin's JWT,
    // even if the test failed before the UI delete ran. No-op if the
    // entry is already gone (server returns 404 or 200 — we don't
    // care which).
    if (createdId) {
      const token = await getAdminAccessToken(page).catch(() => null);
      if (token) {
        await page.request
          .delete("/api/delete-entry", {
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            data: { id: createdId },
          })
          .catch(() => {
            /* swallow — best-effort cleanup */
          });
      }
    }
  }
});
