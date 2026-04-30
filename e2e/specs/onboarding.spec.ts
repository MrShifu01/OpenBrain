import { test, expect } from "@playwright/test";
import { trackConsole } from "../helpers/console";

// Why this spec exists: the onboarding modal is gated by the
// localStorage key `everion_onboarded` (legacy alias `openbrain_onboarded`
// is still cleared for migration). The most painful user-facing
// regression isn't a broken step — it's the modal popping back up after
// a user dismissed or completed it. That's what this spec catches.
//
// As of 2026-04-30 the flow is mandatory on step 1: there is no Skip
// button until the user has captured at least one entry (anti-bounce
// safeguard). Step 2/3 still carry a Skip — AI calls there can fail
// non-deterministically and we don't want users stranded.
test("onboarding gates on localStorage and stays dismissed after first-capture + Skip", async ({
  page,
}) => {
  const noise = trackConsole(page);

  await page.goto("/");

  // Force a known "first-visit" state. Removing the key after goto and
  // then reloading is robust regardless of what the storageState already
  // contains for this key — no assumption about admin's prior runs.
  await page.evaluate(() => {
    localStorage.removeItem("everion_onboarded");
    localStorage.removeItem("openbrain_onboarded");
  });
  await page.reload();

  const modal = page.getByRole("dialog", { name: /onboarding/i });
  await expect(modal).toBeVisible();

  // Confirm we land on step 1 (welcome). Heading + counter both prove it.
  await expect(modal.getByText(/step 1 of 3/i)).toBeVisible();

  // Mandatory step: Skip must NOT be present on step 1.
  await expect(modal.getByRole("button", { name: /^skip$/i })).toHaveCount(0);

  // Trigger the first capture so we move past the mandatory gate. Tap a
  // pre-filled example chip rather than typing — keeps the test fast and
  // avoids racing the textarea onChange handler.
  await modal.getByRole("button", { name: /the gate code/i }).click();
  await modal.getByRole("button", { name: /save & continue/i }).click();

  // After at least one capture the Skip control re-appears so the user
  // can bail out without going through the AI demo (network-dependent).
  const skipBtn = modal.getByRole("button", { name: /^skip$/i });
  await expect(skipBtn).toBeVisible();
  await skipBtn.click();
  await expect(modal).toHaveCount(0);

  const flag = await page.evaluate(() => localStorage.getItem("everion_onboarded"));
  expect(flag).toBe("1");

  // The actual regression: the modal coming back on the next visit.
  await page.reload();
  await expect(page.getByRole("dialog", { name: /onboarding/i })).toHaveCount(0);

  noise.assertNoNew();
});
