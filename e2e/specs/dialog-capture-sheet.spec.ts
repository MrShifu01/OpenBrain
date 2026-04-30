import { test, expect } from "@playwright/test";
import { trackConsole } from "../helpers/console";

// Why this spec exists: regression net for the planned CaptureSheet
// migration from focus-trap-react to shadcn Drawer (vaul). The sheet is
// the entry point for every capture — if it stops opening, focus-trapping,
// or closing on Escape / backdrop click, the entire app is unusable.
//
// Drag-to-close with the 80px threshold is hard to assert reliably across
// browsers without real touch hardware — that stays as a manual real-device
// QA item per LAUNCH_CHECKLIST.

test("CaptureSheet: opens, has correct ARIA, escape closes, body scroll locks", async ({
  page,
}) => {
  const noise = trackConsole(page);

  await page.addInitScript(() => {
    localStorage.setItem("openbrain_onboarded", "1");
  });
  await page.goto("/");

  // Open via the floating capture pill.
  await page.getByRole("button", { name: /^capture something$/i }).click();

  const sheet = page.getByRole("dialog", { name: /capture something/i });
  await expect(sheet).toBeVisible();
  await expect(sheet).toHaveAttribute("aria-modal", "true");

  // Body scroll lock — page must not scroll while the sheet is open.
  // Real-event check: wheel events at the corner of the viewport (on
  // the scrim/body, not the sheet panel) must not scroll the page.
  // Catches both lock mechanisms (position:fixed and react-remove-scroll
  // wheel-interception).
  const beforeY = await page.evaluate(() => window.scrollY);
  await page.mouse.move(5, 5);
  await page.mouse.wheel(0, 200);
  const afterY = await page.evaluate(() => window.scrollY);
  expect(afterY).toBe(beforeY);

  // Focus trap — the textarea inside the sheet should be focused (or
  // become focused as soon as we Tab once). focus-trap-react auto-focuses
  // the first focusable child; vaul Drawer does the same via Radix. We
  // assert that focus stays within the sheet after a Tab.
  await page.keyboard.press("Tab");
  const focusedInsideSheet = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el) return false;
    const sheetEl = document.querySelector('[role="dialog"][aria-label*="apture" i]');
    return !!sheetEl && sheetEl.contains(el);
  });
  expect(focusedInsideSheet).toBe(true);

  // Escape closes.
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();

  noise.assertNoNew();
});

test("CaptureSheet: backdrop click closes the sheet", async ({ page }) => {
  const noise = trackConsole(page);

  await page.addInitScript(() => {
    localStorage.setItem("openbrain_onboarded", "1");
  });
  await page.goto("/");

  await page.getByRole("button", { name: /^capture something$/i }).click();
  const sheet = page.getByRole("dialog", { name: /capture something/i });
  await expect(sheet).toBeVisible();

  // Click the very corner of the viewport — guaranteed scrim hit.
  await page.mouse.click(5, 5);
  await expect(sheet).toBeHidden();

  noise.assertNoNew();
});
