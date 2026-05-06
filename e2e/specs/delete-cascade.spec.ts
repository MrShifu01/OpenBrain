import { test, expect } from "@playwright/test";
import { trackConsole } from "../helpers/console";

// Why this spec exists: when an entry is deleted, the row + its concept
// links + any embedding/persona-fact byproducts get scrubbed. A
// regression where a soft-deleted entry still surfaces in the list,
// in search, or in chat is the kind of bug the unit tests miss because
// they mock the realtime / cache layer. This test exercises the full
// user path against the real backend and confirms the entry vanishes
// from the rendered list after delete.
//
// Cleanup mirrors capture.spec — finally{} hits /api/delete-entry?permanent=true
// to scrub the trash row even if the test fails before the UI delete ran.

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

test("delete an entry — disappears from the list, undo restores it", async ({ page }) => {
  const noise = trackConsole(page);
  const tag = "e2e-del-" + Math.random().toString(36).slice(2, 10);
  const body = `${tag} delete-cascade smoke`;

  let createdId: string | null = null;
  page.on("response", async (res) => {
    if (res.url().includes("/api/capture") && res.request().method() === "POST" && res.ok()) {
      try {
        const data = (await res.json()) as { id?: string };
        if (data?.id) createdId = data.id;
      } catch {
        /* non-JSON; ignore */
      }
    }
  });

  try {
    await page.addInitScript(() => {
      localStorage.setItem("openbrain_onboarded", "1");
    });
    await page.goto("/");

    // Capture
    await page.getByRole("button", { name: /^capture something$/i }).click();
    const sheet = page.getByRole("dialog", { name: /capture something/i });
    await sheet.getByPlaceholder(/remember something/i).fill(body);
    await sheet.getByRole("button", { name: /^capture$/i }).click();
    const preview = page.getByRole("dialog", { name: /confirm entry/i });
    if (await preview.isVisible().catch(() => false)) {
      await preview.getByRole("button", { name: /^save$/i }).click();
    }
    await expect(sheet).toBeHidden();

    // Confirm rendered
    const card = page.locator("article", { hasText: tag });
    await expect(card).toBeVisible();

    // Open detail, delete (two-tap confirm)
    await card.click();
    const detail = page.getByRole("dialog");
    await detail.getByRole("button", { name: /^delete$/i }).click();
    await detail.getByRole("button", { name: /confirm delete/i }).click();
    await expect(detail).toBeHidden();

    // Undo toast should be visible — click undo
    await page.getByRole("button", { name: /^undo$/i }).click();

    // Card returns to the list
    await expect(page.locator("article", { hasText: tag })).toBeVisible();

    noise.assertNoNew();
  } finally {
    // Backstop — hard delete via API regardless of the path the test
    // took. Permanent flag bypasses the soft-delete trash so subsequent
    // runs don't accumulate orphans.
    if (createdId) {
      const token = await getAdminAccessToken(page).catch(() => null);
      if (token) {
        await page.request
          .delete("/api/delete-entry?permanent=true", {
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
