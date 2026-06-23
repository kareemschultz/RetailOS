import { describe, expect, it } from "vitest";
import { ROLE_PERMISSIONS, roleHasPermission } from "./entitlements";

describe("entitlements (minimal VS#1 RBAC)", () => {
  it("cashier can only sell, not set up catalog/inventory", () => {
    expect(roleHasPermission("cashier", "pos.create_sale")).toBe(true);
    expect(roleHasPermission("cashier", "products.create")).toBe(false);
    expect(roleHasPermission("cashier", "inventory.receive")).toBe(false);
    expect(roleHasPermission("cashier", "reports.view")).toBe(false);
  });

  it("manager runs operations but not company/location setup", () => {
    expect(roleHasPermission("manager", "products.create")).toBe(true);
    expect(roleHasPermission("manager", "inventory.receive")).toBe(true);
    expect(roleHasPermission("manager", "pos.create_sale")).toBe(true);
    expect(roleHasPermission("manager", "company.create")).toBe(false);
  });

  it("tenant_admin has every VS#1 permission", () => {
    for (const permission of ROLE_PERMISSIONS.tenant_admin) {
      expect(roleHasPermission("tenant_admin", permission)).toBe(true);
    }
  });

  it("unknown or missing roles are denied everything (fail-closed)", () => {
    expect(roleHasPermission(null, "pos.create_sale")).toBe(false);
    expect(roleHasPermission("ghost", "pos.create_sale")).toBe(false);
  });

  // Phase 3 (commit 6) — operational separation of duties.
  it("warehouse moves stock but has no bond clearance or POS rights", () => {
    expect(roleHasPermission("warehouse", "inventory.transfer")).toBe(true);
    expect(roleHasPermission("warehouse", "inventory.transfer_receive")).toBe(
      true
    );
    expect(roleHasPermission("warehouse", "inventory.receive")).toBe(true);
    expect(roleHasPermission("warehouse", "bond.release")).toBe(false);
    expect(roleHasPermission("warehouse", "pos.create_sale")).toBe(false);
  });

  it("bond_officer holds BOTH bond perms (RBAC-immediate) but not POS/catalog", () => {
    // RBAC-immediate release needs both in one role to clear in a single call.
    expect(roleHasPermission("bond_officer", "bond.release")).toBe(true);
    expect(roleHasPermission("bond_officer", "bond.approve_release")).toBe(
      true
    );
    expect(roleHasPermission("bond_officer", "bond.receive")).toBe(true);
    expect(roleHasPermission("bond_officer", "products.create")).toBe(false);
    expect(roleHasPermission("bond_officer", "pos.create_sale")).toBe(false);
  });
});
