import { eq } from "drizzle-orm";
import { membership } from "../schema";
import type { TenantTransaction } from "../tenant";

// Minimal RBAC for VS#1 (charter §7) — approved scope; the full Entitlements
// Service (feature flags, license limits, approval rules, company/location
// access) is deferred. Cashiers get POS only; managers get operations; tenant
// admins get setup + everything in this slice.
export const ROLE_PERMISSIONS = {
  tenant_admin: [
    "company.create",
    "location.create",
    "products.create",
    "inventory.adjust",
    "inventory.count",
    "inventory.receive",
    "inventory.reorder",
    "inventory.transfer",
    "inventory.transfer_receive",
    // Bond receiving (commit 4) + release/approve (commit 5). Release is
    // RBAC-immediate: an actor holding BOTH bond.release and bond.approve_release
    // performs the clearance in one call. tenant_admin holds everything; the
    // dedicated bond_officer role below is the separation-of-duties option.
    "bond.receive",
    "bond.release",
    "bond.approve_release",
    "pos.create_sale",
    // Returns/voids (Commit 3). Sensitive (§19/§22 manager step-up): granted to
    // admin + manager, NOT the base cashier — a cashier rings sales, a manager
    // authorizes refunds/voids.
    "pos.refund",
    "pos.void_sale",
    "reports.view",
  ],
  manager: [
    "products.create",
    "inventory.adjust",
    "inventory.count",
    "inventory.receive",
    "inventory.reorder",
    "inventory.transfer",
    "inventory.transfer_receive",
    "pos.create_sale",
    "pos.refund",
    "pos.void_sale",
    "reports.view",
  ],
  // Phase 3 (commit 6) — operational separation of duties. A warehouse operator
  // moves stock (receive/transfer/count) but has NO bond clearance and NO POS
  // sale rights; a bond officer performs customs clearance (RBAC-immediate, so
  // they hold BOTH bond.release + bond.approve_release) and the transfers a
  // release composes, but NOT general POS/catalog rights.
  warehouse: [
    "inventory.receive",
    "inventory.adjust",
    "inventory.count",
    "inventory.transfer",
    "inventory.transfer_receive",
    "reports.view",
  ],
  bond_officer: [
    "bond.receive",
    "bond.release",
    "bond.approve_release",
    "inventory.transfer",
    "inventory.transfer_receive",
    "reports.view",
  ],
  cashier: ["pos.create_sale"],
} as const satisfies Record<string, readonly string[]>;

export type TenantRole = keyof typeof ROLE_PERMISSIONS;

export function roleHasPermission(
  role: string | null | undefined,
  permission: string
): boolean {
  if (!(role && role in ROLE_PERMISSIONS)) {
    return false;
  }
  const granted = ROLE_PERMISSIONS[role as TenantRole] as readonly string[];
  return granted.includes(permission);
}

// Resolves the caller's RetailOS role within the active tenant. Runs on the
// tenant-scoped tx, so RLS already restricts membership to this tenant — the
// userId filter selects the caller's row.
export async function resolveTenantRole(
  tx: TenantTransaction,
  userId: string
): Promise<string | null> {
  const rows = await tx
    .select({ role: membership.role })
    .from(membership)
    .where(eq(membership.userId, userId))
    .limit(1);
  return rows.at(0)?.role ?? null;
}
