import { test, expect } from "@playwright/test";
import { trackConsole } from "../helpers/console";

// Why this spec exists: POPI/GDPR right-of-access. Compliance hangs on
// the user being able to download a copy of their data. This spec
// proves two things in one ride:
//   1. The UI affordance to reach the destructive flow is discoverable
//      from settings (Danger zone → "Export & delete" → modal opens).
//   2. The /api/export endpoint actually returns the user's data when
//      hit with their session — the compliance contract.
//
// We don't click "Export then delete" itself — that would nuke the admin
// account that every other spec depends on. The export endpoint hit
// proves the underlying right works without exercising the destructive
// path. A future ephemeral-user spec can cover the full export-then-
// delete flow once SUPABASE_SERVICE_ROLE_KEY is in CI secrets.
test("user can reach the export affordance and the export API returns data", async ({ page }) => {
  const noise = trackConsole(page);

  await page.addInitScript(() => {
    localStorage.setItem("openbrain_onboarded", "1");
  });
  await page.goto("/");

  // Open settings via the sidebar/header button. Both desktop sidebar
  // and mobile topbar render a button labelled "Settings".
  await page
    .getByRole("button", { name: /^Settings$/ })
    .first()
    .click();

  // Switch to the Privacy & danger tab. The label in src/views/SettingsView.tsx
  // is "Privacy & danger" — match case-insensitively to absorb trivial copy
  // changes. Danger zone is rendered as a sub-section inside it.
  await page
    .getByRole("button", { name: /privacy & danger/i })
    .first()
    .click();

  // Confirm we're actually on the destructive surface and the entry
  // affordance is reachable.
  const openModal = page.getByRole("button", { name: /^Export & delete$/i });
  await expect(openModal).toBeVisible();
  await openModal.click();

  // Modal contract — these are the three branching choices, and a user
  // doing a compliance export needs the first one specifically.
  const dialog = page.locator('[role="dialog"], .anim-scale-in-design').first();
  await expect(page.getByRole("button", { name: /export then delete/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /delete without export/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /^cancel$/i })).toBeVisible();

  // Bail out of the modal — we will not actually delete admin.
  await page.getByRole("button", { name: /^cancel$/i }).click();
  await expect(dialog).toBeHidden();

  // Now exercise the API directly with the admin's session. The browser
  // already carries the JWT in localStorage (key: `sb-<ref>-auth-token`).
  // Discover the key dynamically so this spec doesn't need the project
  // ref injected into the test process — the global-setup is the only
  // place that should care about Supabase env vars.
  const accessToken = await page.evaluate(() => {
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
  expect(accessToken, "admin access_token must be present in localStorage").toBeTruthy();

  // Resolve the active brain via /api/brains so the test isn't pinned to
  // a specific brain ID.
  const brainsRes = await page.request.get("/api/brains", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  expect(brainsRes.ok(), `/api/brains: HTTP ${brainsRes.status()}`).toBe(true);
  const brainsBody = (await brainsRes.json()) as
    | { brains: Array<{ id: string }> }
    | Array<{ id: string }>;
  const brains = Array.isArray(brainsBody) ? brainsBody : brainsBody.brains;
  expect(brains.length, "admin must own at least one brain").toBeGreaterThan(0);
  const brainId = brains[0].id;

  // Hit the export endpoint. Compliance contract: it must respond OK
  // and return JSON the user could plausibly consume. Shape is loose
  // on purpose — the rule is "data flows out", not "data flows out in
  // exactly this schema", which would make this test brittle to
  // legitimate API evolution.
  const exportRes = await page.request.get(`/api/export?brain_id=${brainId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  expect(exportRes.ok(), `/api/export: HTTP ${exportRes.status()}`).toBe(true);
  const exportBody = await exportRes.json().catch(() => null);
  expect(exportBody, "export response must be valid JSON").toBeTruthy();
  expect(typeof exportBody, "export must return an object or array").not.toBe("string");

  noise.assertNoNew();
});
