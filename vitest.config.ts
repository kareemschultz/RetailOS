import { defineConfig } from "vitest/config";

// Shared Vitest base config (charter §4/§43/§46). Each workspace package has a
// `vitest.config.ts` that re-exports this. Vitest sets the project root to the
// directory of the config file it loads, so `turbo run test` runs each package's
// tests scoped to that package (per-package orchestration + caching), while a
// root `vitest` run (`test:watch`) discovers the whole repo via the default include.
//
// `passWithNoTests` keeps the gate green for packages that don't ship tests yet;
// add `*.test.ts(x)` files beside the code they cover. DOM environment is set for
// React/TanStack/shadcn unit tests (harmless for node-style logic tests).
export default defineConfig({
  test: {
    environment: "happy-dom",
    passWithNoTests: true,
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.turbo/**",
      "**/.output/**",
      "**/.nitro/**",
      "e2e/**",
      "**/*.e2e.*",
    ],
  },
});
