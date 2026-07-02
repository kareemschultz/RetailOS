import { describe, expect, it } from "vitest";

import { calculateSalesTaxLines } from "./tax";

describe("sales tax calculation", () => {
  it("applies active percentage tax rates per line using the shared rounding primitive", () => {
    const result = calculateSalesTaxLines({
      lines: [
        { lineBaseMinor: 1000, productId: "p1", qty: 1, skuId: "s1" },
        { lineBaseMinor: 999, productId: "p2", qty: 3, skuId: "s2" },
      ],
      rate: {
        id: "vat-14",
        name: "VAT 14%",
        rateBps: 1400,
      },
    });

    expect(result.taxMinor).toBe(280);
    expect(result.lines).toEqual([
      {
        lineBaseMinor: 1000,
        lineTaxMinor: 140,
        productId: "p1",
        qty: 1,
        skuId: "s1",
        taxRateId: "vat-14",
      },
      {
        lineBaseMinor: 999,
        lineTaxMinor: 140,
        productId: "p2",
        qty: 3,
        skuId: "s2",
        taxRateId: "vat-14",
      },
    ]);
    expect(result.taxBreakdown).toEqual([
      {
        baseMinor: 1999,
        name: "VAT 14%",
        rateBps: 1400,
        taxMinor: 280,
        taxRateId: "vat-14",
      },
    ]);
  });

  it("keeps zero-tax tenants explicit and line-safe", () => {
    const result = calculateSalesTaxLines({
      lines: [{ lineBaseMinor: 1250, productId: "p1", qty: 1, skuId: "s1" }],
      rate: null,
    });

    expect(result.taxMinor).toBe(0);
    expect(result.lines).toEqual([
      {
        lineBaseMinor: 1250,
        lineTaxMinor: 0,
        productId: "p1",
        qty: 1,
        skuId: "s1",
        taxRateId: null,
      },
    ]);
    expect(result.taxBreakdown).toEqual([]);
  });
});
