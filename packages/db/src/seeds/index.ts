import type { createDb } from "../index";
import { company, location, product } from "../schema";
import { withTenant } from "../tenant";

type Database = ReturnType<typeof createDb>;

export interface ProvisionedTenant {
  adminUserId: string;
  tenantId: string;
}

// Provisions the platform admin + a tenant organization THROUGH Better Auth
// (never a raw user/org insert) — injected so the seed package carries no auth
// bypass. Wired to the Better Auth server API in a later commit; kept as a
// dependency so the seeding discipline is established from day one (charter §32).
export type ProvisionTenant = (input: {
  name: string;
  adminEmail: string;
}) => Promise<ProvisionedTenant>;

export interface SeedDeps {
  database: Database;
  provisionTenant: ProvisionTenant;
}

function required<T>(row: T | undefined, what: string): T {
  if (!row) {
    throw new Error(`seed: expected ${what} to be inserted`);
  }
  return row;
}

// Reusable VS#1 seed for dev / CI / Playwright / demos (charter §32). Domain
// rows are written through `withTenant` — the tenant-scoped path — so the
// fail-closed RLS policies apply and the seed can never become an RLS bypass.
export async function seedVs1(deps: SeedDeps): Promise<ProvisionedTenant> {
  const tenant = await deps.provisionTenant({
    name: "Sample Retailer",
    adminEmail: "admin@example.com",
  });

  await withTenant(deps.database, tenant.tenantId, async (tx) => {
    const insertedCompany = await tx
      .insert(company)
      .values({
        tenantId: tenant.tenantId,
        name: "Sample Retailer HQ",
        createdBy: tenant.adminUserId,
      })
      .returning();
    const seededCompany = required(insertedCompany.at(0), "company");

    const insertedLocation = await tx
      .insert(location)
      .values({
        tenantId: tenant.tenantId,
        companyId: seededCompany.id,
        name: "Main Store",
        type: "store",
        createdBy: tenant.adminUserId,
      })
      .returning();
    required(insertedLocation.at(0), "location");

    await tx.insert(product).values({
      tenantId: tenant.tenantId,
      sku: "SKU-0001",
      name: "Sample Product",
      priceMinor: 1999,
      currency: "USD",
      scale: 2,
      createdBy: tenant.adminUserId,
    });
  });

  return tenant;
}
