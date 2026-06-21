import { defineConfig } from "vitest/config";

// Root Vitest config (charter §4/§43/§46). DOM environment for React/TanStack/shadcn
// unit tests. `passWithNoTests` keeps the `bun run test` gate green for packages that
// don't yet ship tests; add `*.test.ts(x)` files beside the code they cover.
export default defineConfig({
  test: {
    environment: "happy-dom",
    passWithNoTests: true,
    include: ["{apps,packages}/**/src/**/*.{test,spec}.{ts,tsx}"],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.turbo/**",
      "e2e/**",
      "**/*.e2e.*",
    ],
  },
});
