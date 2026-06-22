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

  it("costing resolves at ALL levels by default (D1); FINANCIAL_LEVELS is an opt-in cap", () => {
    expect(isFinancialSetting("costingMethod")).toBe(true);
    // Default honors D1 — a per-product costing override wins.
    const def = resolveSetting(
      { product: "fifo", category: "avco", tenant: "avco" },
      allowedLevelsFor("costingMethod")
    );
    expect(def.value).toBe("fifo");
    expect(def.source).toBe("product");
    // Opt-in shallow cap: passing FINANCIAL_LEVELS explicitly ignores product/location.
    const capped = resolveSetting(
      { product: "fifo", category: "avco", tenant: "avco" },
      FINANCIAL_LEVELS
    );
    expect(capped.value).toBe("avco");
    expect(capped.source).toBe("category");
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
