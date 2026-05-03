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
  request,
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

  // Capture the entry id from the /api/capture response so finally{} can
  // hard-delete it. Without this the onboarding example sits in the
  // admin's brain forever — there's no e2e- prefix on the title and the
  // residue sweep would miss it.
  const captureResponsePromise = page.waitForResponse(
    (r) => r.url().includes("/api/capture") && r.request().method() === "POST",
  );

  // Trigger the first capture so we move past the mandatory gate. Tap a
  // pre-filled example chip rather than typing — keeps the test fast and
  // avoids racing the textarea onChange handler. Picked a non-secret
  // example so the entry, even if cleanup somehow fails, never carries
  // sensitive content.
  await modal.getByRole("button", { name: /a recipe to remember/i }).click();
  await modal.getByRole("button", { name: /save & continue/i }).click();

  let createdEntryId: string | null = null;
  try {
    const captureResponse = await captureResponsePromise;
    const data = await captureResponse.json().catch(() => null);
    createdEntryId = (data?.entry?.id as string | undefined) ?? null;
  } catch {
    /* best-effort — finally{} below still runs */
  }

  try {
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
  } finally {
    // Hard-delete the onboarding capture so it doesn't sit in the admin's
    // brain. Uses the in-page session token (we're already signed in).
    if (createdEntryId) {
      const token = await page.evaluate(() => {
        const url = (
          (import.meta as unknown as { env?: { VITE_SUPABASE_URL?: string } }).env
            ?.VITE_SUPABASE_URL ?? ""
        ).replace(/^https?:\/\//, "");
        const ref = url.split(".")[0];
        const raw = localStorage.getItem(`sb-${ref}-auth-token`);
        if (!raw) return null;
        try {
          const parsed = JSON.parse(raw) as { access_token?: string };
          return parsed.access_token ?? null;
        } catch {
          return null;
        }
      });
      if (token) {
        await request
          .delete(`/api/delete-entry?id=${encodeURIComponent(createdEntryId)}&permanent=true`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          .catch(() => {});
      }
    }
  }
});
