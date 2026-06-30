import { defineConfig, devices } from "@playwright/test";

// Playwright config (charter §4/§46). Web E2E only — native (Expo) uses Maestro/Detox.
// These smoke specs intentionally avoid seeding/auth by verifying the public login
// surface and the `_app` auth guard. Authenticated POS checkout E2E belongs to the
// seeded prod/staging smoke suite once Infisical-backed credentials are available.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [["html", { open: "never" }], ["list"]],
  outputDir: "test-results",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:4177",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command:
          "bun run --cwd apps/web dev --host 127.0.0.1 --port 4177 --strictPort",
        reuseExistingServer: false,
        timeout: 120_000,
        url: "http://127.0.0.1:4177/login",
      },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
});
