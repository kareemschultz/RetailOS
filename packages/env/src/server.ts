import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    // Comma-separated list of web origins allowed to call the API. Production
    // may be served from both the KareTech subdomain and the client apex domain.
    CORS_ORIGIN: z.string().min(1),
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
    // Shopix storefront base domain (charter §11) — when set (e.g.
    // "shop.retailos.com"), a request host of "{slug}.{STOREFRONT_BASE_DOMAIN}"
    // resolves to the tenant whose organization.slug matches. Custom storefront
    // domains use organization.storefront_domain instead. Env-driven; unset ⇒
    // only explicit storefront_domain hosts resolve. Never hardcoded (§9).
    STOREFRONT_BASE_DOMAIN: z.string().optional(),
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
