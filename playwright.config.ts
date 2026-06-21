import { defineConfig, devices } from "@playwright/test";

// Playwright config (charter §4/§46). Web E2E only — native (Expo) uses Maestro/Detox.
// Real POS-checkout / offline-sync / storefront specs land in Phase 1+; e2e/ holds a
// placeholder so the harness + CI artifact upload are wired now.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["html", { open: "never" }], ["list"]],
  outputDir: "test-results",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3001",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
