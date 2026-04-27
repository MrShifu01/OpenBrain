import { test, expect } from "@playwright/test";
import { trackConsole } from "../helpers/console";

// Why this spec exists: the regression a real user hit on 2026-04-27 —
// "Click on the search icon on mobile Header, it opens the capture
// modal. Not the Omni search". Cmd/Ctrl+K was deliberately rebound to
// capture (Everion.tsx), but three call sites still dispatched
// Cmd+K instead of Cmd+/. This spec catches any future regression
// where the search affordance gets re-wired to capture.
//
// We deliberately do NOT round-trip "captured entry → search by tag"
// here — AI enrichment rewrites both title and content within seconds,
// and racing that produces flake. The regression is about WHAT opens,
// not about scoring entries. (See lib/searchIndex unit tests for that.)
test.describe("OmniSearch opens via search shortcuts (not capture)", () => {
  test("desktop: Cmd/Ctrl+/ opens OmniSearch, capture sheet stays closed", async ({ page }) => {
    const noise = trackConsole(page);
    await page.addInitScript(() => {
      localStorage.setItem("openbrain_onboarded", "1");
    });
    await page.goto("/");
    await expect(page.getByRole("banner").first()).toBeVisible();

    await page.keyboard.press("ControlOrMeta+/");

    const omniInput = page.getByRole("combobox").and(page.getByPlaceholder(/search everything/i));
    await expect(omniInput).toBeVisible();

    // The capture sheet is what the bug used to open by mistake.
    await expect(page.getByRole("dialog", { name: /capture something/i })).toBeHidden();

    await page.keyboard.press("Escape");
    await expect(omniInput).not.toBeVisible();

    noise.assertNoNew();
  });

  test("desktop: Cmd/Ctrl+K opens capture (the deliberate rebind, not search)", async ({
    page,
  }) => {
    // Locks in the rebind so a future rewrite back to "K = search" is
    // caught before it reaches a user.
    const noise = trackConsole(page);
    await page.addInitScript(() => {
      localStorage.setItem("openbrain_onboarded", "1");
    });
    await page.goto("/");
    await expect(page.getByRole("banner").first()).toBeVisible();

    await page.keyboard.press("ControlOrMeta+k");

    await expect(page.getByRole("dialog", { name: /capture something/i })).toBeVisible();
    await expect(
      page.getByRole("combobox").and(page.getByPlaceholder(/search everything/i)),
    ).toBeHidden();

    await page.keyboard.press("Escape");

    noise.assertNoNew();
  });
});

test.describe("Mobile search affordance", () => {
  // Set the viewport below the lg breakpoint (1024px) to render MobileHeader.
  // Using viewport-only override (not devices[]) avoids forcing a different
  // browser type, which would conflict with the Playwright project config.
  test.use({ viewport: { width: 390, height: 844 } });

  test("tapping the mobile header search icon opens OmniSearch (not capture)", async ({ page }) => {
    const noise = trackConsole(page);
    await page.addInitScript(() => {
      localStorage.setItem("openbrain_onboarded", "1");
    });
    await page.goto("/");

    // Mobile header has a dedicated Search button — this is the exact
    // affordance the user reported was opening capture.
    const searchButton = page.getByRole("button", { name: /^search$/i });
    await expect(searchButton).toBeVisible();
    await searchButton.click();

    await expect(
      page.getByRole("combobox").and(page.getByPlaceholder(/search everything/i)),
    ).toBeVisible();

    // The bug surfaced as the capture sheet opening — make sure it
    // didn't, even alongside OmniSearch.
    await expect(page.getByRole("dialog", { name: /capture something/i })).toBeHidden();

    noise.assertNoNew();
  });
});
