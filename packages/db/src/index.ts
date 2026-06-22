import { env } from "@RetailOS/env/server";
import { drizzle } from "drizzle-orm/node-postgres";

import * as schema from "./schema";

export function createDb() {
  return drizzle(env.DATABASE_URL, { schema });
}

export const db = createDb();

// Re-export the schema namespace so consumers (e.g. the Better Auth adapter)
// get the full table set from a single import.
export * as schema from "./schema";
export * as services from "./services";
export type { TenantTransaction } from "./tenant";
// Tenant-scoped transaction primitive + core domain services.
export { withTenant } from "./tenant";
