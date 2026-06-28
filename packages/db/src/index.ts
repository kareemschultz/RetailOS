import { env } from "@RetailOS/env/server";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";

import * as schema from "./schema";

export function createDb() {
  return drizzle(env.DATABASE_URL, { schema });
}

export const db = createDb();

// Auth support: returns the user's organization IFF they belong to exactly one
// (else null). Used by the Better Auth session-create hook to default
// activeOrganizationId so a single-org user lands in their tenant (#41). Reads
// the Better Auth `member` table (identity-scoped, not a tenant RLS table).
export async function resolveSingleMembershipOrg(
  database: ReturnType<typeof createDb>,
  userId: string
): Promise<string | null> {
  const rows = await database
    .select({ organizationId: schema.member.organizationId })
    .from(schema.member)
    .where(eq(schema.member.userId, userId))
    .limit(2);
  return rows.length === 1 && rows[0] ? rows[0].organizationId : null;
}

// Re-export the schema namespace so consumers (e.g. the Better Auth adapter)
// get the full table set from a single import.
export * as schema from "./schema";
export * as services from "./services";
export type { TenantTransaction } from "./tenant";
// Tenant-scoped transaction primitive + core domain services.
export { withTenant } from "./tenant";
