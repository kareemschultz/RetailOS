import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "../schema";
import {
  avgCost,
  category,
  company,
  location,
  lot,
  product,
  reorderRule,
  sku,
  stockCount,
  stockCountLine,
  stockLedger,
  unitOfMeasure,
  uomConversion,
} from "../schema";
import { withTenant } from "../tenant";
import { applyValuation } from "./costing";
import {
  allocateFefoLots,
  convertUom,
  decideOversell,
  evaluateReorder,
  postStockCount,
} from "./inventory";
import { appendStockMovement } from "./stock-ledger";

const url = process.env.RLS_TEST_DATABASE_URL;
const TENANT = "inventory_svc_tenant";

function required<T>(row: T | undefined, what: string): T {
  if (!row) {
    throw new Error(`expected ${what}`);
  }
  return row;
}

describe.skipIf(!url)("Phase 2 inventory services (tenant-scoped)", () => {
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let eachId: string;
  let cartonId: string;
  let fractionalId: string;
  let locationId: string;
  let productId: string;
  let skuId: string;

  beforeAll(async () => {
    pool = new Pool({ connectionString: url });
    db = drizzle(pool, { schema });
    await withTenant(db, TENANT, async (tx) => {
      await tx.delete(stockCountLine);
      await tx.delete(stockCount);
      await tx.delete(avgCost);
      await tx.delete(stockLedger);
      await tx.delete(reorderRule);
      await tx.delete(lot);
      await tx.delete(uomConversion);
      await tx.delete(sku);
      await tx.delete(product);
      await tx.delete(category);
      await tx.delete(unitOfMeasure);
      await tx.delete(location);
      await tx.delete(company);
    });
    const ids = await withTenant(db, TENANT, async (tx) => {
      const co = required(
        (
          await tx
            .insert(company)
            .values({ tenantId: TENANT, name: "Inventory Co" })
            .returning()
        ).at(0),
        "company"
      );
      const loc = required(
        (
          await tx
            .insert(location)
            .values({ tenantId: TENANT, companyId: co.id, name: "Main" })
            .returning()
        ).at(0),
        "location"
      );
      const [each, carton, fractional] = await tx
        .insert(unitOfMeasure)
        .values([
          { tenantId: TENANT, code: "EA", name: "Each" },
          { tenantId: TENANT, code: "CTN24", name: "Carton 24" },
          { tenantId: TENANT, code: "FRAC", name: "Fractional" },
        ])
        .returning();
      const cat = required(
        (
          await tx
            .insert(category)
            .values({ tenantId: TENANT, name: "Grocery", code: "GROCERY" })
            .returning()
        ).at(0),
        "category"
      );
      const prod = required(
        (
          await tx
            .insert(product)
            .values({
              tenantId: TENANT,
              sku: "FEFO-RICE",
              name: "FEFO Rice",
              categoryId: cat.id,
              baseUomId: required(each, "each").id,
              priceMinor: 100,
              currency: "USD",
            })
            .returning()
        ).at(0),
        "product"
      );
      const item = required(
        (
          await tx
            .insert(sku)
            .values({
              tenantId: TENANT,
              productId: prod.id,
              code: "FEFO-RICE-EA",
              baseUomId: required(each, "each").id,
            })
            .returning()
        ).at(0),
        "sku"
      );
      await tx.insert(uomConversion).values([
        {
          tenantId: TENANT,
          skuId: item.id,
          fromUomId: required(carton, "carton").id,
          toUomId: required(each, "each").id,
          role: "purchase",
          factor: 24,
          factorScale: 0,
        },
        {
          tenantId: TENANT,
          skuId: item.id,
          fromUomId: required(fractional, "fractional").id,
          toUomId: required(each, "each").id,
          role: "purchase",
          factor: 1,
          factorScale: 1,
        },
      ]);
      const [nearLot, farLot] = await tx
        .insert(lot)
        .values([
          {
            tenantId: TENANT,
            skuId: item.id,
            lotNumber: "NEAR",
            expiryDate: "2026-07-01",
          },
          {
            tenantId: TENANT,
            skuId: item.id,
            lotNumber: "FAR",
            expiryDate: "2027-01-01",
          },
        ])
        .returning();
      await appendStockMovement(
        tx,
        { tenantId: TENANT },
        {
          locationId: loc.id,
          lotId: required(farLot, "far lot").id,
          movementType: "receipt",
          productId: prod.id,
          qtyDelta: 5,
          skuId: item.id,
        }
      );
      await appendStockMovement(
        tx,
        { tenantId: TENANT },
        {
          locationId: loc.id,
          lotId: required(nearLot, "near lot").id,
          movementType: "receipt",
          productId: prod.id,
          qtyDelta: 3,
          skuId: item.id,
        }
      );
      await tx.insert(reorderRule).values({
        tenantId: TENANT,
        skuId: item.id,
        locationId: loc.id,
        minQty: 5,
        maxQty: 10,
      });
      return {
        cartonId: required(carton, "carton").id,
        eachId: required(each, "each").id,
        fractionalId: required(fractional, "fractional").id,
        locationId: loc.id,
        productId: prod.id,
        skuId: item.id,
      };
    });
    eachId = ids.eachId;
    cartonId = ids.cartonId;
    fractionalId = ids.fractionalId;
    locationId = ids.locationId;
    productId = ids.productId;
    skuId = ids.skuId;
  });

  afterAll(async () => {
    await pool?.end();
  });

  it("converts exact UoM quantities and rejects non-exact discrete conversions", async () => {
    await withTenant(db, TENANT, async (tx) => {
      await expect(
        convertUom(tx, {
          fromUomId: cartonId,
          productId,
          qty: 2,
          role: "purchase",
          skuId,
          toUomId: eachId,
        })
      ).resolves.toBe(48);
      await expect(
        convertUom(tx, {
          fromUomId: fractionalId,
          productId,
          qty: 1,
          role: "purchase",
          skuId,
          toUomId: eachId,
        })
      ).rejects.toThrow("non-exact");
    });
  });

  it("allocates available lots by FEFO from ledger balances", async () => {
    await withTenant(db, TENANT, async (tx) => {
      const result = await allocateFefoLots(tx, { locationId, qty: 6, skuId });
      expect(result.unallocatedQty).toBe(0);
      expect(result.allocations.map((row) => row.lotNumber)).toEqual([
        "NEAR",
        "FAR",
      ]);
      expect(result.allocations.map((row) => row.allocatedQty)).toEqual([3, 3]);
    });
  });

  it("decides oversell policy and evaluates reorder suggestions", async () => {
    expect(
      decideOversell({ onHand: 2, policy: "allow_with_flag", requestedQty: 5 })
    ).toEqual({
      allowed: true,
      discrepancyQty: 3,
      policy: "allow_with_flag",
    });
    expect(
      decideOversell({ onHand: 2, policy: "hard_block", requestedQty: 5 })
    ).toEqual({ allowed: false, discrepancyQty: 3, policy: "hard_block" });

    await withTenant(db, TENANT, async (tx) => {
      await expect(
        evaluateReorder(tx, { locationId, onHand: 4, skuId })
      ).resolves.toEqual({
        isBelowMin: true,
        maxQty: 10,
        minQty: 5,
        onHand: 4,
        suggestedQty: 6,
      });
    });
  });

  it("posts stock counts as valued adjustment movements", async () => {
    await withTenant(db, TENANT, async (tx) => {
      const prod = required(
        (
          await tx
            .insert(product)
            .values({
              tenantId: TENANT,
              sku: "COUNT-AVCO",
              name: "Counted AVCO",
              baseUomId: eachId,
              costingMethod: "avco",
              priceMinor: 100,
              currency: "USD",
            })
            .returning()
        ).at(0),
        "count product"
      );
      const item = required(
        (
          await tx
            .insert(sku)
            .values({
              tenantId: TENANT,
              productId: prod.id,
              code: "COUNT-AVCO-EA",
              baseUomId: eachId,
            })
            .returning()
        ).at(0),
        "count sku"
      );
      const receipt = await appendStockMovement(
        tx,
        { tenantId: TENANT },
        {
          costCurrency: "USD",
          costScale: 2,
          locationId,
          movementType: "receipt",
          productId: prod.id,
          qtyDelta: 5,
          skuId: item.id,
          unitCostMinor: 100,
        }
      );
      await applyValuation(tx, { tenantId: TENANT }, receipt);

      const shrinkCount = required(
        (
          await tx
            .insert(stockCount)
            .values({
              tenantId: TENANT,
              locationId,
              scope: "cycle",
              status: "started",
            })
            .returning()
        ).at(0),
        "shrink count"
      );
      await tx.insert(stockCountLine).values({
        tenantId: TENANT,
        stockCountId: shrinkCount.id,
        skuId: item.id,
        countedQty: 3,
      });
      const shrinkResult = await postStockCount(
        tx,
        { tenantId: TENANT },
        {
          stockCountId: shrinkCount.id,
        }
      );
      expect(shrinkResult.adjustments).toMatchObject([
        { countedQty: 3, systemQty: 5, valuationMinor: -200, varianceQty: -2 },
      ]);
      let projection = required(
        (await tx.select().from(avgCost).where(eq(avgCost.skuId, item.id))).at(
          0
        ),
        "avg cost"
      );
      expect(projection.qtyOnHand).toBe(3);
      expect(projection.totalValueMinor).toBe(300);

      const overageCount = required(
        (
          await tx
            .insert(stockCount)
            .values({
              tenantId: TENANT,
              locationId,
              scope: "cycle",
              status: "started",
            })
            .returning()
        ).at(0),
        "overage count"
      );
      await tx.insert(stockCountLine).values({
        tenantId: TENANT,
        stockCountId: overageCount.id,
        skuId: item.id,
        countedQty: 6,
        varianceValueMinor: 360,
        currency: "USD",
        scale: 2,
      });
      const overageResult = await postStockCount(
        tx,
        { tenantId: TENANT },
        {
          stockCountId: overageCount.id,
        }
      );
      expect(overageResult.adjustments).toMatchObject([
        { countedQty: 6, systemQty: 3, valuationMinor: 360, varianceQty: 3 },
      ]);
      projection = required(
        (await tx.select().from(avgCost).where(eq(avgCost.skuId, item.id))).at(
          0
        ),
        "avg cost"
      );
      expect(projection.qtyOnHand).toBe(6);
      expect(projection.totalValueMinor).toBe(660);
    });
  });
});
