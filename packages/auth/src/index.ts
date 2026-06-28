import { createDb, resolveSingleMembershipOrg, schema } from "@RetailOS/db";
import { env } from "@RetailOS/env/server";
import { expo } from "@better-auth/expo";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, organization } from "better-auth/plugins";

export function createAuth() {
  const db = createDb();
  // Production runs behind HTTPS (reverse proxy) ⇒ secure cookies; local http dev
  // ⇒ non-secure so the cookie is actually set over http://localhost. A configured
  // root cookie domain shares the session across same-site subdomains (web ↔ api).
  const isProd = env.NODE_ENV === "production";
  const cookieDomain = env.AUTH_COOKIE_DOMAIN;

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "pg",

      schema,
    }),
    trustedOrigins: [
      env.CORS_ORIGIN,
      "RetailOS://",
      "exp://",
      "http://localhost:8081",
    ],
    emailAndPassword: {
      enabled: true,
    },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    advanced: {
      // Prod (HTTPS) keeps secure cross-site cookies for the web/mobile clients;
      // local http dev relaxes to non-secure + Lax so the cookie sets on
      // http://localhost. Prod is NEVER weakened.
      defaultCookieAttributes: isProd
        ? { sameSite: "none", secure: true, httpOnly: true }
        : { sameSite: "lax", secure: false, httpOnly: true },
      // Share the session cookie across same-site subdomains (web ↔ api) when a
      // root cookie domain is configured. Unset (local dev) ⇒ host-only cookie.
      ...(cookieDomain
        ? { crossSubDomainCookies: { enabled: true, domain: cookieDomain } }
        : {}),
      // In prod the app is only reachable through Traefik/Pangolin, which sets
      // X-Forwarded-For — trust it for accurate rate-limit bucketing. Not trusted
      // in local dev (no proxy ⇒ spoofable).
      ...(isProd
        ? { ipAddress: { ipAddressHeaders: ["x-forwarded-for"] } }
        : {}),
    },
    // Default the active organization on login so a single-org user lands in
    // their tenant instead of a tenant-less shell (the org-selection gap, #41).
    // Convenience only — wrapped so a lookup failure can NEVER block login.
    databaseHooks: {
      session: {
        create: {
          before: async (session) => {
            try {
              const orgId = await resolveSingleMembershipOrg(
                db,
                session.userId
              );
              if (orgId) {
                return {
                  data: { ...session, activeOrganizationId: orgId },
                };
              }
            } catch {
              // Non-fatal: fall through to the unmodified session.
            }
            return { data: session };
          },
        },
      },
    },
    // Coarse org/admin identity (charter §6); fine-grained ERP entitlements are
    // handled by the RetailOS Entitlements layer, not Better Auth.
    plugins: [organization(), admin(), expo()],
  });
}

export const auth = createAuth();
