import { test, expect } from "@playwright/test";
import { trackConsole } from "../helpers/console";

// Why this spec exists: commit 05db52b added a NotFound view for unknown
// routes after the heuristic walkthrough found that random paths
// soft-404'd into the home view. If the known-paths whitelist in
// main.tsx ever falls behind a real route, real users hit a confusing
// soft-404. This spec reproduces the case (visit a nonexistent path,
// expect the visible "page not found" message + a working go-home link).
test("unknown URL renders the 404 view and Go-home returns to /", async ({ page }) => {
  const noise = trackConsole(page);

  await page.goto("/this-path-does-not-exist");

  await expect(page.getByText(/404 · page not found/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: /we couldn't find that/i })).toBeVisible();

  // The Go-home anchor uses href="/" so it's also crawlable; click it
  // and confirm the URL navigates back.
  await page.getByRole("link", { name: /go home/i }).click();
  await expect(page).toHaveURL(/\/$/);

  noise.assertNoNew();
});
