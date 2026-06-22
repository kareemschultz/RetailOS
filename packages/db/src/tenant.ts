import { sql } from "drizzle-orm";
import type { createDb } from "./index";

type Database = ReturnType<typeof createDb>;
export type TenantTransaction = Parameters<
  Parameters<Database["transaction"]>[0]
>[0];

// Runs `fn` inside a transaction with the `app.tenant_id` GUC set, so the
// fail-closed RLS policies scope every statement to this tenant (charter §8).
// This is the ONLY sanctioned path to tenant-owned data — seeds, request
// middleware, and services all route through it; never bypass RLS by issuing
// tenant queries outside this wrapper. `set_config(..., true)` is
// transaction-local, so the GUC is cleared automatically when the tx ends.
export function withTenant<T>(
  database: Database,
  tenant: string,
  fn: (tx: TenantTransaction) => Promise<T>
): Promise<T> {
  // Cannot be called without a tenant id: an empty/blank id would set the RLS
  // GUC to '' and silently scope to "no tenant". Reject (rather than throw
  // synchronously) so callers always get a promise.
  if (!tenant.trim()) {
    return Promise.reject(
      new Error("withTenant: a non-empty tenant id is required")
    );
  }
  return database.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.tenant_id', ${tenant}, true)`);
    return fn(tx);
  });
}
