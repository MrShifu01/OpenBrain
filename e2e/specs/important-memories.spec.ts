import { test, expect } from "@playwright/test";
import { trackConsole } from "../helpers/console";

// Why this spec exists: Important Memories is the v0 of Everion's third
// pillar (capture / recall / keep / lock). Without coverage, every shadcn
// migration and god-component split lands blind. This spec exercises the
// happy path: open the screen, create a memory, see it render, filter by
// type, retire it. Cleanup hits /api/important-memories DELETE directly
// in finally{} so a mid-test failure can't leave orphans on the admin's
// real brain.
//
// Feature flag: importantMemories ships off by default; the test enables
// it via the localStorage admin-flags object that Everion reads at boot.

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

test("user can create, filter, and retire an Important Memory", async ({ page }) => {
  const noise = trackConsole(page);
  // Per-spec tag — concurrent runs and stale data can't collide.
  const tag = "e2e-im-" + Math.random().toString(36).slice(2, 10);
  const title = `${tag} Wi-Fi password for studio`;
  const summary = "The current studio access code is documented elsewhere.";

  // Capture the row id from the create response so finally can scrub it.
  let createdId: string | null = null;
  page.on("response", async (res) => {
    if (
      res.url().includes("/api/important-memories") &&
      res.request().method() === "POST" &&
      res.ok()
    ) {
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
      // Flip the importantMemories feature flag on for this run. Mirrors
      // what AdminTab toggling would persist; Everion reads on boot.
      localStorage.setItem("openbrain_admin_flags", JSON.stringify({ importantMemories: true }));
    });

    await page.goto("/");

    // Open the Important Memories view via the new nav item.
    await page
      .getByRole("button", { name: /important/i })
      .first()
      .click();

    await expect(page.getByRole("heading", { name: /^important memories$/i })).toBeVisible();

    // Composer is hidden until "+ New memory" is clicked.
    await page.getByRole("button", { name: /^\+ new memory$/i }).click();

    // Type defaults to "fact" — verify before changing it.
    await page.getByRole("radio", { name: /preference/i }).click();

    await page.getByPlaceholder(/title — what is this memory/i).fill(title);
    await page.getByPlaceholder(/summary — the fact everion/i).fill(summary);

    await page.getByRole("button", { name: /^save memory$/i }).click();

    // Card should render at the top of the list.
    const card = page.locator("article", { hasText: title });
    await expect(card).toBeVisible();
    await expect(card).toContainText(/preference/i);

    // Filter chips: switching to "Facts" hides this preference; switching to
    // "Preferences" or "All" shows it again.
    await page.getByRole("tab", { name: /^facts/i }).click();
    await expect(card).toBeHidden();

    await page.getByRole("tab", { name: /^preferences/i }).click();
    await expect(card).toBeVisible();

    // Retire — card stays mounted but moves to the Retired filter.
    await card.getByRole("button", { name: /^retire$/i }).click();

    await page.getByRole("tab", { name: /^retired/i }).click();
    await expect(card).toBeVisible();

    noise.assertNoNew();
  } finally {
    // Backstop cleanup. The retire path doesn't hard-delete (status =
    // "retired"), so we DELETE the row by id to keep the admin's brain
    // clean across re-runs.
    if (createdId) {
      const token = await getAdminAccessToken(page).catch(() => null);
      if (token) {
        await page.request
          .delete(`/api/important-memories?id=${encodeURIComponent(createdId)}`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          .catch(() => {
            /* swallow — best-effort cleanup */
          });
      }
    }
  }
});
