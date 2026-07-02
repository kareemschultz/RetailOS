import { describe, expect, it } from "vitest";
import {
  amountToMinor,
  autoMapColumns,
  buildImportRows,
  parseCsv,
  quantityToInt,
} from "./product-import";

describe("parseCsv", () => {
  it("parses headers and rows", () => {
    const parsed = parseCsv("sku,name,price\nA1,Apple,1.50\nB2,Bread,2.00\n");
    expect(parsed.headers).toEqual(["sku", "name", "price"]);
    expect(parsed.rows).toEqual([
      ["A1", "Apple", "1.50"],
      ["B2", "Bread", "2.00"],
    ]);
  });

  it("handles quoted fields with embedded commas and escaped quotes", () => {
    const parsed = parseCsv(
      'sku,name\nA1,"Rice, 5lb bag"\nB2,"He said ""hi"""\n'
    );
    expect(parsed.rows[0]?.[1]).toBe("Rice, 5lb bag");
    expect(parsed.rows[1]?.[1]).toBe('He said "hi"');
  });

  it("handles CRLF newlines, BOM, and skips empty lines", () => {
    const parsed = parseCsv("﻿sku,name\r\nA1,Apple\r\n\r\n  ,  \r\n");
    expect(parsed.headers).toEqual(["sku", "name"]);
    expect(parsed.rows).toEqual([["A1", "Apple"]]);
  });

  it("handles newlines inside quoted fields", () => {
    const parsed = parseCsv('sku,name\nA1,"Two\nlines"\n');
    expect(parsed.rows).toEqual([["A1", "Two\nlines"]]);
  });
});

describe("autoMapColumns", () => {
  it("maps RetailOS canonical headers", () => {
    const mapping = autoMapColumns([
      "productSku",
      "productName",
      "price",
      "cost",
      "openingQty",
      "baseUomCode",
    ]);
    expect(mapping.productSku).toBe(0);
    expect(mapping.productName).toBe(1);
    expect(mapping.price).toBe(2);
    expect(mapping.cost).toBe(3);
    expect(mapping.openingQty).toBe(4);
    expect(mapping.baseUomCode).toBe(5);
  });

  it("maps QuickBooks item-list export headers", () => {
    const mapping = autoMapColumns([
      "Item",
      "Description",
      "Type",
      "Cost",
      "Price",
      "Quantity On Hand",
      "U/M",
    ]);
    expect(mapping.productSku).toBe(0);
    expect(mapping.productName).toBe(1);
    expect(mapping.cost).toBe(3);
    expect(mapping.price).toBe(4);
    expect(mapping.openingQty).toBe(5);
    expect(mapping.baseUomCode).toBe(6);
  });

  it("never assigns one column to two fields", () => {
    const mapping = autoMapColumns(["SKU", "Sales Price"]);
    expect(mapping.productSku).toBe(0);
    expect(mapping.price).toBe(1);
    expect(mapping.productName).toBeUndefined();
  });
});

describe("amountToMinor", () => {
  it("converts exactly without float drift", () => {
    expect(amountToMinor("12.99", 2)).toBe(1299);
    expect(amountToMinor("0.1", 2)).toBe(10);
    expect(amountToMinor("100", 2)).toBe(10_000);
    expect(amountToMinor("0", 2)).toBe(0);
  });

  it("handles thousands separators and currency noise", () => {
    expect(amountToMinor("1,299.50", 2)).toBe(129_950);
    expect(amountToMinor("$ 45.00", 2)).toBe(4500);
  });

  it("rejects too many decimals, negatives, and junk", () => {
    expect(amountToMinor("12.999", 2)).toBeNull();
    expect(amountToMinor("-5.00", 2)).toBeNull();
    expect(amountToMinor("abc", 2)).toBeNull();
    expect(amountToMinor("", 2)).toBeNull();
  });

  it("respects non-2 scales", () => {
    expect(amountToMinor("5.5", 0)).toBeNull();
    expect(amountToMinor("5", 0)).toBe(5);
    expect(amountToMinor("1.234", 3)).toBe(1234);
  });
});

describe("quantityToInt", () => {
  it("parses whole numbers with separators and zero fractions", () => {
    expect(quantityToInt("42")).toBe(42);
    expect(quantityToInt("1,000")).toBe(1000);
    expect(quantityToInt("15.00")).toBe(15);
  });

  it("rejects fractional and negative quantities", () => {
    expect(quantityToInt("1.5")).toBeNull();
    expect(quantityToInt("-3")).toBeNull();
  });
});

describe("buildImportRows", () => {
  const defaults = {
    autoSku: true,
    currency: "USD",
    scale: 2,
    trackingMode: "none" as const,
  };

  it("builds rows with auto SKU, cost, and opening stock", () => {
    const parsed = parseCsv(
      "Item,Description,Cost,Price,Quantity On Hand\nAPPLE,Red Apple,0.50,1.00,25\n"
    );
    const mapping = autoMapColumns(parsed.headers);
    const result = buildImportRows(parsed, mapping, defaults);
    expect(result.issues).toEqual([]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      currency: "USD",
      openingQtyBase: 25,
      priceMinor: 100,
      productName: "Red Apple",
      productSku: "APPLE",
      rowNumber: 1,
      skuCode: "APPLE",
      unitCostMinor: 50,
    });
  });

  it("falls back productName to the SKU and price to zero", () => {
    const parsed = parseCsv("Item\nBARE-ITEM\n");
    const result = buildImportRows(parsed, autoMapColumns(parsed.headers), {
      ...defaults,
      autoSku: false,
    });
    expect(result.rows[0]).toMatchObject({
      priceMinor: 0,
      productName: "BARE-ITEM",
      productSku: "BARE-ITEM",
    });
    expect(result.rows[0]?.skuCode).toBeUndefined();
  });

  it("reports unreadable values as issues instead of guessing", () => {
    const parsed = parseCsv(
      "Item,Price,Quantity On Hand\nGOOD,1.00,5\nBAD,abc,5\nWORSE,1.00,1.5\n"
    );
    const result = buildImportRows(
      parsed,
      autoMapColumns(parsed.headers),
      defaults
    );
    expect(result.rows).toHaveLength(1);
    expect(result.issues).toHaveLength(2);
    expect(result.issues[0]).toContain("row 2");
    expect(result.issues[1]).toContain("row 3");
  });

  it("skips zero quantities and validates expiry format", () => {
    const parsed = parseCsv(
      "Item,Quantity On Hand,Expiry Date\nZERO,0,\nDATED,3,2030-01-31\nBADDATE,3,31/01/2030\n"
    );
    const result = buildImportRows(
      parsed,
      autoMapColumns(parsed.headers),
      defaults
    );
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]?.openingQtyBase).toBeUndefined();
    expect(result.rows[1]?.expiryDate).toBe("2030-01-31");
    expect(result.issues[0]).toContain("YYYY-MM-DD");
  });
});
