import { db, schema } from "@RetailOS/db";
import { eq } from "drizzle-orm";

import { storefrontProcedure } from "../storefront";

// Shopix Commerce Experience — the PUBLIC, anonymous storefront API (design §3).
// Every endpoint is a storefrontProcedure: tenant resolved from hostname, NO
// session/permission. DTOs are strict allow-lists (design §1.3) — only the listed
// fields ship; cost/margin/qty/internal ids/other-tenant data are never exposed.
//
// Commit 1 (this file) is the GATEWAY proof: `storefront` resolves the hostname to
// a tenant and returns that tenant's public display name only. Public catalog /
// PDP / coarse availability reads + the rate-limit budgets land in commit 2.

export const commerceRouter = {
  // Public storefront identity for the host-resolved tenant. Allow-list DTO:
  // `name` only — deliberately NOT slug, internal ids, vat/tax numbers, or any
  // tenant config. Proves the hostname → tenant gateway end-to-end. The
  // organization read is a platform read by id (the registry is not tenant-owned).
  storefront: storefrontProcedure.handler(async ({ context }) => {
    const row = (
      await db
        .select({ name: schema.organization.name })
        .from(schema.organization)
        .where(eq(schema.organization.id, context.storefront.tenantId))
        .limit(1)
    ).at(0);
    return { name: row?.name ?? null };
  }),
};
