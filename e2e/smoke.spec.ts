import { expect, test } from "@playwright/test";

// Placeholder so the Playwright harness is wired (charter §4/§46). Does NOT use the
// `page` fixture, so it runs without launching a browser. Replace in Phase 1+ with real
// POS checkout, offline-sync (network-disabled MSW), and storefront E2E + VRT.
test("playwright harness is configured", () => {
  expect(1 + 1).toBe(2);
});
