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
});
