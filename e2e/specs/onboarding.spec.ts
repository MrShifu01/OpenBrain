import { test, expect } from "@playwright/test";
import { trackConsole } from "../helpers/console";

// Why this spec exists: the onboarding modal is gated by the
// localStorage key `openbrain_onboarded` (see useAppShell.ts:59).
// The most painful user-facing regression isn't a broken step — it's
// the modal popping back up after a user dismissed or completed it.
// That's what this spec catches.
//
// The full happy path (name → capture → query → import) is intentionally
// NOT exercised:
//   - the capture step writes real entries to the admin's brain
//   - the query step calls Gemini and is non-deterministic
//   - the name step mutates supabase.auth user_metadata
// Component-level step traversal lives in Vitest:
//   src/components/__tests__/OnboardingModal.test.tsx
test("onboarding modal gates on localStorage and stays dismissed after Skip", async ({ page }) => {
  const noise = trackConsole(page);

  await page.goto("/");

  // Force a known "first-visit" state. Removing the key after goto and
  // then reloading is robust regardless of what the storageState already
  // contains for this key — no assumption about admin's prior runs.
  await page.evaluate(() => localStorage.removeItem("openbrain_onboarded"));
  await page.reload();

  const modal = page.getByRole("dialog", { name: /onboarding/i });
  await expect(modal).toBeVisible();

  // Confirm we land on step 1 (welcome). Heading + counter both prove it.
  await expect(modal.getByRole("heading", { name: /welcome in/i })).toBeVisible();
  await expect(modal.getByText(/step 1 of 8/i)).toBeVisible();

  // Dismiss via Skip — closes the modal AND persists the gate key.
  await modal.getByRole("button", { name: /^skip$/i }).click();
  await expect(modal).toHaveCount(0);

  const flag = await page.evaluate(() => localStorage.getItem("openbrain_onboarded"));
  expect(flag).toBe("1");

  // The actual regression: the modal coming back on the next visit.
  await page.reload();
  await expect(page.getByRole("dialog", { name: /onboarding/i })).toHaveCount(0);

  noise.assertNoNew();
});
