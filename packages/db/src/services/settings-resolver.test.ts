import { describe, expect, it } from "vitest";
import {
  allowedLevelsFor,
  FINANCIAL_LEVELS,
  isFinancialSetting,
  resolveSetting,
} from "./settings-resolver";

describe("settings resolver (§6)", () => {
  it("resolves most-specific-wins: product → category → location → tenant → platform", () => {
    expect(
      resolveSetting({
        product: "fefo",
        category: "fifo",
        tenant: "manual",
      }).value
    ).toBe("fefo");
    expect(resolveSetting({ category: "fifo", tenant: "manual" }).source).toBe(
      "category"
    );
    expect(resolveSetting({ tenant: "manual" }).source).toBe("tenant");
    expect(resolveSetting<string>({}).value).toBeNull();
  });

  it("skips null/undefined levels and falls through", () => {
    const r = resolveSetting<string>({
      product: null,
      category: undefined,
      location: "fefo",
      tenant: "fifo",
    });
    expect(r.value).toBe("fefo");
    expect(r.source).toBe("location");
  });

  it("financial settings resolve at category/tenant/platform only (no product/location)", () => {
    expect(isFinancialSetting("costingMethod")).toBe(true);
    expect(allowedLevelsFor("costingMethod")).toEqual(FINANCIAL_LEVELS);
    // A per-product costing override is IGNORED for financial consistency.
    const r = resolveSetting(
      { product: "fifo", category: "avco", tenant: "avco" },
      allowedLevelsFor("costingMethod")
    );
    expect(r.value).toBe("avco");
    expect(r.source).toBe("category");
  });

  it("operational settings may resolve at the deepest level", () => {
    expect(isFinancialSetting("removalStrategy")).toBe(false);
    const r = resolveSetting(
      { product: "fefo", tenant: "fifo" },
      allowedLevelsFor("removalStrategy")
    );
    expect(r.value).toBe("fefo");
    expect(r.source).toBe("product");
  });
});
