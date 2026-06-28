import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    CORS_ORIGIN: z.url(),
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    // Deployment tier (charter §9/§36) — surfaced in the request context for
    // audit/events/residency. Env-driven; never hardcoded.
    DEPLOYMENT_MODE: z
      .enum(["saas", "dedicated", "managed", "self-hosted"])
      .default("saas"),
    // Optional root cookie domain (e.g. "karetechsolutions.com") so the Better
    // Auth session cookie is shared across same-site subdomains (web ↔ api).
    // Env-driven; never hardcoded (§9). Unset ⇒ host-only cookie (local dev).
    AUTH_COOKIE_DOMAIN: z.string().optional(),
    // Google OAuth (social sign-in). Optional: the provider is only enabled when
    // both are present, so the app runs fine without them. Secrets via env only
    // (§25) — set in Infisical, never committed.
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
  },
  runtimeEnv: process.env,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
