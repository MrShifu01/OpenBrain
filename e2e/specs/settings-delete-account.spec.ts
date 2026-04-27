import { test, expect } from "@playwright/test";
import { trackConsole } from "../helpers/console";

// Why this spec exists: POPI/GDPR right-of-erasure. The most catastrophic
// UX bug in this region of the app is silently destroying an account, so
// the "are you sure?" speedbump must work. This spec proves:
//   1. The destructive flow has a real confirmation modal (not a single
//      misclick away from data loss).
//   2. Cancel actually backs the user out — modal closes, account intact,
//      they remain signed in.
//   3. Reopening the modal after cancel still works (no half-closed
//      state from the previous attempt).
//
// What this spec does NOT do: actually fire "Delete without export".
// That would destroy the admin account every other spec depends on.
// The cascade-delete contract (entries, vault, embeddings, push subs,
// brains all removed) is covered by Vitest unit tests on /api/user-data
// and a manual periodic check. A full destructive e2e needs an
// ephemeral test user, which in turn needs SUPABASE_SERVICE_ROLE_KEY
// in CI secrets — separate task, separate decision.
test("destructive account-delete flow is gated behind a real confirmation modal", async ({
  page,
}) => {
  const noise = trackConsole(page);

  await page.addInitScript(() => {
    localStorage.setItem("openbrain_onboarded", "1");
  });
  await page.goto("/");

  await page
    .getByRole("button", { name: /^Settings$/ })
    .first()
    .click();
  await page
    .getByRole("button", { name: /danger zone/i })
    .first()
    .click();

  const openModal = page.getByRole("button", { name: /^Export & delete$/i });
  await expect(openModal).toBeVisible();

  // First open: confirm the modal exists, all three branches are
  // present, and Cancel actually closes it.
  await openModal.click();
  const exportThenDelete = page.getByRole("button", { name: /export then delete/i });
  const deleteOnly = page.getByRole("button", { name: /delete without export/i });
  const cancel = page.getByRole("button", { name: /^cancel$/i });
  await expect(exportThenDelete).toBeVisible();
  await expect(deleteOnly).toBeVisible();
  await expect(cancel).toBeVisible();

  // The Cancel path is the real safety contract. If this regresses,
  // a user who clicks "Export & delete" by accident has no way out
  // short of refreshing the page.
  await cancel.click();
  await expect(deleteOnly).toBeHidden();

  // Reopen — proves the modal isn't permanently disabled after cancel,
  // and proves the dangerous action remains available for the user
  // who actually wants it (compliance: must be a working path, not
  // just a button that opens a broken dialog).
  await openModal.click();
  await expect(deleteOnly).toBeVisible();
  await page.getByRole("button", { name: /^cancel$/i }).click();
  await expect(deleteOnly).toBeHidden();

  // Sanity: still signed in. If this fails, something fired the delete
  // path despite us only clicking Cancel — that's a critical bug.
  await expect(page.getByRole("button", { name: /^Settings$/ }).first()).toBeVisible();

  noise.assertNoNew();
});
