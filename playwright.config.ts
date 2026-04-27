import { defineConfig, devices } from "@playwright/test";

// When E2E_BASE_URL is set we're testing against a deployed URL (a Vercel
// preview from the GitHub Actions workflow, or production for the daily
// cron). When unset we fall back to a local Vite dev server.
const remoteBaseURL = process.env.E2E_BASE_URL;
const baseURL = remoteBaseURL ?? "http://localhost:5174";
const isRemote = Boolean(remoteBaseURL);

export default defineConfig({
  testDir: "./e2e/specs",
  // Vitest tests live in tests/ — keep them out of Playwright's runner.
  testIgnore: ["**/tests/**", "**/__tests__/**"],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : [["list"], ["html", { open: "never" }]],
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL,
    trace: "on-first-retry",
    storageState: "e2e/.auth/admin.json",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    // Remote URLs incur real network latency; bump the per-action timeout
    // so the default 5s assertion doesn't race CDN warm-up or cold lambdas.
    actionTimeout: isRemote ? 15_000 : undefined,
    navigationTimeout: isRemote ? 30_000 : undefined,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // Spawn a local Vite dev server only when there's no remote URL to test.
  webServer: isRemote
    ? undefined
    : {
        command: "npm run dev -- --port 5174",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
