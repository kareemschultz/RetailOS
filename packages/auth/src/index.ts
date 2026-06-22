import { createDb, schema } from "@RetailOS/db";
import { env } from "@RetailOS/env/server";
import { expo } from "@better-auth/expo";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, organization } from "better-auth/plugins";

export function createAuth() {
  const db = createDb();

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
      defaultCookieAttributes: {
        sameSite: "none",
        secure: true,
        httpOnly: true,
      },
    },
    // Coarse org/admin identity (charter §6); fine-grained ERP entitlements are
    // handled by the RetailOS Entitlements layer, not Better Auth.
    plugins: [organization(), admin(), expo()],
  });
}

export const auth = createAuth();
