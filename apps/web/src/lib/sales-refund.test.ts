import { describe, expect, it } from "vitest";

import { buildFullRefundInput, getRefundableLines } from "./sales-refund";

const detail = {
  receipt: {
    currency: "GYD",
    lines: [
      { lineTotalMinor: 1500, qty: 3, saleLineId: "line-a" },
      { lineTotalMinor: 900, qty: 2, saleLineId: "line-b" },
      { lineTotalMinor: 500, qty: 1, saleLineId: "line-c" },
    ],
    sale: { id: "sale-1" },
    scale: 2,
  },
  refundState: {
    lines: [
      { refundedQty: 1, saleLineId: "line-a" },
      { refundedQty: 2, saleLineId: "line-b" },
    ],
  },
};

describe("sales refund helpers", () => {
  it("returns only lines with remaining refundable quantity", () => {
    expect(getRefundableLines(detail)).toEqual([
      {
        lineTotalMinor: 1000,
        originalSaleLineId: "line-a",
        qty: 2,
        unitPriceMinor: 500,
      },
      {
        lineTotalMinor: 500,
        originalSaleLineId: "line-c",
        qty: 1,
        unitPriceMinor: 500,
      },
    ]);
  });

  it("builds a full-refund payload whose tender equals remaining refundable value", () => {
    expect(
      buildFullRefundInput({
        detail,
        doNotRestock: true,
        idempotencyKey: "refund-key",
        method: "cash",
        refundReason: "Customer return",
        terminalId: "terminal-1",
      })
    ).toEqual({
      doNotRestock: true,
      idempotencyKey: "refund-key",
      lines: [
        { originalSaleLineId: "line-a", qty: 2 },
        { originalSaleLineId: "line-c", qty: 1 },
      ],
      originalSaleId: "sale-1",
      refundReason: "Customer return",
      terminalId: "terminal-1",
      tenders: [{ amountMinor: 1500, currency: "GYD", method: "cash" }],
    });
  });
});
