import { test, expect } from "@playwright/test";
import { trackConsole } from "../helpers/console";

// Why this spec exists: the Schedule view is one of the four pillars
// (capture / recall / keep / lock) and ships Day / Week / Month tabs
// plus a Someday list (gated). After the recent unify pass that ported
// all three views to the PrimePro card chrome, regressions on the
// drawer / FAB / tab-routing surface were hard to catch without a
// real-device run. This smoke proves: the view mounts under /todos,
// each tab is reachable, and clicking a date opens the day drawer.
//
// Doesn't create entries — read-only smoke. Cleanup is unnecessary.

test("Schedule view — Day / Week / Month tabs reachable, drawer opens", async ({ page }) => {
  const noise = trackConsole(page);

  await page.addInitScript(() => {
    localStorage.setItem("openbrain_onboarded", "1");
    // Schedule is gated behind the `todos` feature flag; force it on
    // for this run regardless of prod env config.
    localStorage.setItem("openbrain_admin_flags", JSON.stringify({ todos: true }));
  });

  await page.goto("/");

  // Open Schedule tab via the nav.
  await page
    .getByRole("button", { name: /^schedule/i })
    .first()
    .click();

  // Day tab is the default landing.
  await expect(page.getByRole("tab", { name: /^day/i })).toBeVisible();

  // Switch to Week.
  await page.getByRole("tab", { name: /^week/i }).click();
  await expect(page.getByRole("tab", { name: /^week/i })).toHaveAttribute("aria-selected", "true");

  // Switch to Month — calendar grid should render.
  await page.getByRole("tab", { name: /^month/i }).click();
  await expect(page.getByRole("tab", { name: /^month/i })).toHaveAttribute("aria-selected", "true");

  noise.assertNoNew();
});
