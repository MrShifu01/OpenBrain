import { test, expect } from "@playwright/test";
import { trackConsole } from "../helpers/console";

// Why this spec exists: regression net for the planned DetailModal
// migration from focus-trap-react to shadcn (Radix) Dialog. Without this,
// any of these silent regressions could ship: Escape stops closing the
// modal, body-scroll-lock breaks (page scrolls behind the modal on iOS),
// backdrop-click stops closing, ARIA roles get lost. Each assertion
// pins down one concrete behaviour.
//
// Captures one disposable entry, opens the modal on it, exercises the
// behaviours, and cleans up via /api/delete-entry in finally{} so a
// mid-test failure can't leave orphans.

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

test("DetailModal: opens, escape closes, body scroll locks, ARIA correct", async ({ page }) => {
  const noise = trackConsole(page);
  const tag = "e2e-detail-" + Math.random().toString(36).slice(2, 10);
  const body = `${tag} captured for detail-modal regression`;

  let createdId: string | null = null;
  page.on("response", async (res) => {
    if (res.url().includes("/api/capture") && res.request().method() === "POST" && res.ok()) {
      try {
        const data = (await res.json()) as { id?: string };
        if (data?.id) createdId = data.id;
      } catch {
        /* ignore */
      }
    }
  });

  try {
    await page.addInitScript(() => {
      localStorage.setItem("openbrain_onboarded", "1");
    });
    await page.goto("/");

    // Capture a disposable entry so the grid has at least one row.
    await page.getByRole("button", { name: /^capture something$/i }).click();
    const sheet = page.getByRole("dialog", { name: /capture something/i });
    await expect(sheet).toBeVisible();
    await sheet.getByPlaceholder(/remember something/i).fill(body);
    await sheet.getByRole("button", { name: /^capture$/i }).click();
    const preview = page.getByRole("dialog", { name: /confirm entry/i });
    if (await preview.isVisible().catch(() => false)) {
      await preview.getByRole("button", { name: /^save$/i }).click();
    }
    await expect(sheet).toBeHidden();

    // Open the entry.
    const topEntry = page.getByRole("article").first();
    await expect(topEntry).toBeVisible();
    await topEntry.click();

    // ── ARIA + visible ──
    const detail = page.getByRole("dialog").last();
    await expect(detail).toBeVisible();
    await expect(detail).toHaveAttribute("aria-modal", "true");

    // ── Body scroll lock ──
    // Current implementation pins document.body to position:fixed; the
    // shadcn Dialog migration uses Radix's `data-state` + a different
    // mechanism (overflow:hidden on body via Portal). Either way, the
    // page MUST NOT scroll while the dialog is open. Test the symptom,
    // not the implementation.
    const scrollableWhileOpen = await page.evaluate(() => {
      const before = window.scrollY;
      window.scrollTo(0, before + 200);
      const after = window.scrollY;
      window.scrollTo(0, before);
      return after !== before;
    });
    expect(scrollableWhileOpen).toBe(false);

    // ── Escape closes ──
    await page.keyboard.press("Escape");
    await expect(detail).toBeHidden();

    // ── Body scroll restored ──
    const scrollableAfterClose = await page.evaluate(() => {
      const before = window.scrollY;
      window.scrollTo(0, before + 50);
      const after = window.scrollY;
      window.scrollTo(0, before);
      return after !== before || document.body.scrollHeight <= window.innerHeight;
    });
    expect(scrollableAfterClose).toBe(true);

    noise.assertNoNew();
  } finally {
    if (createdId) {
      const token = await getAdminAccessToken(page).catch(() => null);
      if (token) {
        await page.request
          .delete("/api/delete-entry", {
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            data: { id: createdId },
          })
          .catch(() => {
            /* swallow — best-effort */
          });
      }
    }
  }
});

test("DetailModal: backdrop click closes (when not editing)", async ({ page }) => {
  const noise = trackConsole(page);
  const tag = "e2e-backdrop-" + Math.random().toString(36).slice(2, 10);
  const body = `${tag} for backdrop-click test`;

  let createdId: string | null = null;
  page.on("response", async (res) => {
    if (res.url().includes("/api/capture") && res.request().method() === "POST" && res.ok()) {
      try {
        const data = (await res.json()) as { id?: string };
        if (data?.id) createdId = data.id;
      } catch {
        /* ignore */
      }
    }
  });

  try {
    await page.addInitScript(() => {
      localStorage.setItem("openbrain_onboarded", "1");
    });
    await page.goto("/");

    await page.getByRole("button", { name: /^capture something$/i }).click();
    const sheet = page.getByRole("dialog", { name: /capture something/i });
    await sheet.getByPlaceholder(/remember something/i).fill(body);
    await sheet.getByRole("button", { name: /^capture$/i }).click();
    const preview = page.getByRole("dialog", { name: /confirm entry/i });
    if (await preview.isVisible().catch(() => false)) {
      await preview.getByRole("button", { name: /^save$/i }).click();
    }
    await expect(sheet).toBeHidden();

    await page.getByRole("article").first().click();
    const detail = page.getByRole("dialog").last();
    await expect(detail).toBeVisible();

    // Click in the very corner of the viewport — guaranteed to be on the
    // scrim/overlay, never on the modal panel itself.
    await page.mouse.click(5, 5);
    await expect(detail).toBeHidden();

    noise.assertNoNew();
  } finally {
    if (createdId) {
      const token = await getAdminAccessToken(page).catch(() => null);
      if (token) {
        await page.request
          .delete("/api/delete-entry", {
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            data: { id: createdId },
          })
          .catch(() => {
            /* swallow */
          });
      }
    }
  }
});
