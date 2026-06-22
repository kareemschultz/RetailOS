import { index, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { actor, tenantId, timestamps } from "./columns";

// VS#1 role assignment within a tenant (charter §7). Resolves the coarse slice
// role; the full Entitlements Service (feature flags / licenses / approvals) is
// deferred. Better Auth `member.role` covers org membership; this covers the
// RetailOS ERP role used for permission checks.
export const membership = pgTable(
  "membership",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId,
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // tenant_admin | manager | cashier
    role: text("role").notNull(),
    ...timestamps,
    ...actor,
  },
  (table) => [
    index("membership_tenantId_idx").on(table.tenantId),
    index("membership_userId_idx").on(table.userId),
  ]
);
