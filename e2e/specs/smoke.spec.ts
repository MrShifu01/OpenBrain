import { test, expect } from "@playwright/test";

/**
 * Smoke test — proves the global-setup auth flow works end to end:
 *   1. Playwright loads e2e/.auth/admin.json (written by globalSetup)
 *   2. The app boots with a Supabase session already in localStorage
 *   3. The signed-out LoginScreen never renders; we land on the app shell
 *
 * If this fails, the auth-replay pipeline is broken and every subsequent
 * test would fail for the same reason — fix this one first.
 */

test("admin lands on the signed-in shell, not the login screen", async ({ page }) => {
  await page.goto("/");
  // The login screen renders this CTA. If we see it, auth replay failed.
  await expect(page.getByRole("button", { name: /sign in/i })).toHaveCount(0);
  // The signed-in shell renders one or more <header role="banner"> elements
  // (DesktopHeader + the memory-topbar on the entries view). Either one
  // proves we're past auth.
  await expect(page.getByRole("banner").first()).toBeVisible();
});
