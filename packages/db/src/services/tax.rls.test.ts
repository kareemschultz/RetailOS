// @vitest-environment node
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "../schema";
import {
  category,
  organization,
  product,
  taxRate,
  unitOfMeasure,
} from "../schema";
import { withTenant } from "../tenant";
import { calculateQuoteTax } from "./tax";

const url = process.env.RLS_TEST_DATABASE_URL;
const TENANT = "shopix_tax_slice_tenant";
const NO_TAX_TENANT = "shopix_tax_slice_no_tax_tenant";

function required<T>(value: T | undefined, label: string): T {
  if (value === undefined || value === null) {
    throw new Error(`shopix tax test expected ${label}`);
  }
  return value;
}

describe.skipIf(!url)("Shopix quote tax resolution", () => {
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let uomId: string;
  let noTaxUomId: string;

  beforeAll(async () => {
    pool = new Pool({ connectionString: url });
    db = drizzle(pool, { schema });
    await db
      .insert(organization)
      .values([
        { id: TENANT, name: "Shopix Tax Slice Tenant" },
        { id: NO_TAX_TENANT, name: "No Tax Configured Tenant" },
      ])
      .onConflictDoNothing();

    uomId = await withTenant(db, TENANT, async (tx) => {
      await tx.delete(product);
      await tx.delete(category);
      await tx.delete(taxRate);
      await tx.delete(unitOfMeasure);
      const uom = required(
        (
          await tx
            .insert(unitOfMeasure)
            .values({ tenantId: TENANT, code: "EA-TAX", name: "Each" })
            .returning()
        ).at(0),
        "uom"
      );
      return uom.id;
    });

    noTaxUomId = await withTenant(db, NO_TAX_TENANT, async (tx) => {
      await tx.delete(product);
      await tx.delete(unitOfMeasure);
      const uom = required(
        (
          await tx
            .insert(unitOfMeasure)
            .values({ tenantId: NO_TAX_TENANT, code: "EA-NOTAX", name: "Each" })
            .returning()
        ).at(0),
        "no-tax uom"
      );
      return uom.id;
    });
  });

  afterAll(async () => {
    await pool.end();
  });

  it("resolves product-level classification over the tenant default", async () => {
    await withTenant(db, TENANT, async (tx) => {
      const standard = required(
        (
          await tx
            .insert(taxRate)
            .values({
              tenantId: TENANT,
              code: "STD",
              name: "Standard VAT",
              kind: "standard",
              rateBps: 1400,
            })
            .returning()
        ).at(0),
        "standard rate"
      );
      const zero = required(
        (
          await tx
            .insert(taxRate)
            .values({
              tenantId: TENANT,
              code: "ZERO",
              name: "Zero-Rated",
              kind: "zero",
              rateBps: 0,
            })
            .returning()
        ).at(0),
        "zero rate"
      );
      const cat = required(
        (
          await tx
            .insert(category)
            .values({ tenantId: TENANT, name: "Groceries" })
            .returning()
        ).at(0),
        "category"
      );
      const taxedProduct = required(
        (
          await tx
            .insert(product)
            .values({
              tenantId: TENANT,
              sku: "PROD-STANDARD",
              name: "Taxed Product",
              baseUomId: uomId,
              priceMinor: 1000,
              currency: "GYD",
              categoryId: cat.id,
            })
            .returning()
        ).at(0),
        "taxed product"
      );
      const zeroRatedProduct = required(
        (
          await tx
            .insert(product)
            .values({
              tenantId: TENANT,
              sku: "PROD-ZERO",
              name: "Zero-Rated Product",
              baseUomId: uomId,
              priceMinor: 500,
              currency: "GYD",
              categoryId: cat.id,
              taxRateId: zero.id,
            })
            .returning()
        ).at(0),
        "zero-rated product"
      );

      const result = await calculateQuoteTax(tx, [
        {
          categoryTaxRateId: null,
          lineBaseMinor: taxedProduct.priceMinor,
          productTaxRateId: taxedProduct.taxRateId,
        },
        {
          categoryTaxRateId: null,
          lineBaseMinor: zeroRatedProduct.priceMinor,
          productTaxRateId: zeroRatedProduct.taxRateId,
        },
      ]);

      // taxedProduct has no product/category classification -> falls back to
      // the tenant's active standard rate. zeroRatedProduct is explicitly
      // classified zero -> zero tax regardless of the tenant default.
      expect(result.lines).toEqual([
        { lineBaseMinor: 1000, lineTaxMinor: 140 },
        { lineBaseMinor: 500, lineTaxMinor: 0 },
      ]);
      expect(result.taxMinor).toBe(140);
      expect(result.taxBreakdown).toEqual([
        { baseMinor: 1000, name: "Standard VAT", rateBps: 1400, taxMinor: 140 },
      ]);
      expect(standard.rateBps).toBe(1400);
    });
  });

  it("resolves category-level classification when the product has none", async () => {
    await withTenant(db, TENANT, async (tx) => {
      const exempt = required(
        (
          await tx
            .insert(taxRate)
            .values({
              tenantId: TENANT,
              code: "EXEMPT",
              name: "Exempt",
              kind: "exempt",
              rateBps: 0,
            })
            .returning()
        ).at(0),
        "exempt rate"
      );
      const cat = required(
        (
          await tx
            .insert(category)
            .values({
              tenantId: TENANT,
              name: "Financial Services",
              taxRateId: exempt.id,
            })
            .returning()
        ).at(0),
        "exempt category"
      );
      const exemptProduct = required(
        (
          await tx
            .insert(product)
            .values({
              tenantId: TENANT,
              sku: "PROD-EXEMPT",
              name: "Exempt Product",
              baseUomId: uomId,
              priceMinor: 750,
              currency: "GYD",
              categoryId: cat.id,
            })
            .returning()
        ).at(0),
        "exempt product"
      );

      const result = await calculateQuoteTax(tx, [
        {
          categoryTaxRateId: cat.taxRateId,
          lineBaseMinor: exemptProduct.priceMinor,
          productTaxRateId: exemptProduct.taxRateId,
        },
      ]);

      expect(result.lines).toEqual([{ lineBaseMinor: 750, lineTaxMinor: 0 }]);
      expect(result.taxMinor).toBe(0);
      // exempt lines carry zero tax and are excluded from the breakdown, same
      // convention as the existing POS taxBreakdown grouping.
      expect(result.taxBreakdown).toEqual([]);
    });
  });

  it("charges zero tax with no crash when no rate is configured at all", async () => {
    await withTenant(db, NO_TAX_TENANT, async (tx) => {
      const result = await calculateQuoteTax(tx, [
        {
          categoryTaxRateId: null,
          lineBaseMinor: 1200,
          productTaxRateId: null,
        },
      ]);
      expect(result.lines).toEqual([{ lineBaseMinor: 1200, lineTaxMinor: 0 }]);
      expect(result.taxMinor).toBe(0);
      expect(result.taxBreakdown).toEqual([]);
    });
    expect(noTaxUomId).toBeTruthy();
  });
});
