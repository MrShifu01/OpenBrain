import { test, expect } from "@playwright/test";
import { trackConsole } from "../helpers/console";

// Why this spec exists: vault is the most security-sensitive surface in
// the app (master-passphrase-derived AES-GCM, opt-in encrypted secrets),
// and previously had zero e2e coverage. This is the smoke layer — it
// proves the Vault tab renders, the locked-state passphrase field is
// reachable, and a bad passphrase is rejected without any state leaking.
//
// Deeper flow coverage (full setup → save → re-lock → unlock → reveal →
// delete cycle) is owed but needs either a dedicated test brain or a
// VAULT_PASSPHRASE secret in CI — neither exists yet. The admin's
// production vault state is intentionally not mutated here so this spec
// stays safe to run on the real Supabase project (per skill Rule 3).
test("Vault tab renders, accepts a passphrase, rejects wrong input", async ({ page }) => {
  const noise = trackConsole(page);

  await page.addInitScript(() => {
    localStorage.setItem("openbrain_onboarded", "1");
  });
  await page.goto("/");
  await expect(page.getByRole("banner").first()).toBeVisible();

  // Navigate to the Vault tab. The sidebar has it as a button on desktop
  // and the bottom-nav exposes it on mobile — getByRole catches both.
  const vaultNav = page.getByRole("button", { name: /^vault$/i }).first();
  await expect(vaultNav).toBeVisible();
  await vaultNav.click();

  // Whatever vault state we land on (setup / locked / show-recovery /
  // unlocked), the page must show "Vault" somewhere prominent and not
  // crash. The h1 in both locked and unlocked states is exactly "Vault";
  // the setup state uses an h2 "Set up your Vault" — match either.
  await expect(
    page
      .getByRole("heading", { name: /^vault$/i })
      .or(page.getByRole("heading", { name: /set up your vault/i })),
  ).toBeVisible();

  // If the admin lands on the locked state (most common — fresh tab
  // doesn't cache the cryptoKey across the storageState replay), exercise
  // the bad-passphrase path. We don't know the real passphrase and we
  // shouldn't mutate state, so we feed obvious gibberish and confirm the
  // UI rejects it without revealing anything.
  const passphraseInput = page.getByPlaceholder(/^passphrase$/i);
  if (await passphraseInput.isVisible().catch(() => false)) {
    await passphraseInput.fill("definitely-not-the-passphrase-x9q2");
    await passphraseInput.press("Enter");

    // Wait for the "vault remains locked" signal — either the input is
    // still visible (no navigation away) or an error message renders.
    // Either is acceptable; what matters is the vault did NOT unlock,
    // which would have replaced this UI with the secrets grid.
    await expect(passphraseInput).toBeVisible({ timeout: 5000 });
    // Confirm we did NOT land on the unlocked grid by checking the
    // "unlocked" subtitle that the unlocked state shows.
    await expect(page.getByText(/^unlocked/i)).toBeHidden();
  }

  noise.assertNoNew();
});
