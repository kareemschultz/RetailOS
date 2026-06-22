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
  organization,
  product,
  sku,
  stockLedger,
  unitOfMeasure,
  valuationLayer,
} from "../schema";
import { withTenant } from "../tenant";
import { applyValuation, resolveCostingMethod } from "./costing";
import { appendStockMovement } from "./stock-ledger";

const url = process.env.RLS_TEST_DATABASE_URL;
const TENANT = "costing_tenant";

function required<T>(row: T | undefined, what: string): T {
  if (!row) {
    throw new Error(`expected ${what}`);
  }
  return row;
}

describe.skipIf(!url)("Phase 2 costing services (tenant-scoped)", () => {
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let locationId: string;
  let uomId: string;

  beforeAll(async () => {
    pool = new Pool({ connectionString: url });
    db = drizzle(pool, { schema });
    await withTenant(db, TENANT, async (tx) => {
      await tx.delete(valuationLayer);
      await tx.delete(avgCost);
      await tx.delete(stockLedger);
      await tx.delete(sku);
      await tx.delete(product);
      await tx.delete(category);
      await tx.delete(unitOfMeasure);
      await tx.delete(location);
      await tx.delete(company);
    });
    await db
      .insert(organization)
      .values({ id: TENANT, name: "Costing Tenant", costingMethod: "fifo" })
      .onConflictDoUpdate({
        target: organization.id,
        set: { costingMethod: "fifo", name: "Costing Tenant" },
      });
    const ids = await withTenant(db, TENANT, async (tx) => {
      const co = required(
        (
          await tx
            .insert(company)
            .values({ tenantId: TENANT, name: "Costing Co" })
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
      const uom = required(
        (
          await tx
            .insert(unitOfMeasure)
            .values({ tenantId: TENANT, code: "EA", name: "Each" })
            .returning()
        ).at(0),
        "unit"
      );
      return { locationId: loc.id, uomId: uom.id };
    });
    locationId = ids.locationId;
    uomId = ids.uomId;
  });

  afterAll(async () => {
    await pool?.end();
  });

  it("resolves costing method product to category to tenant", async () => {
    await withTenant(db, TENANT, async (tx) => {
      const cat = required(
        (
          await tx
            .insert(category)
            .values({
              tenantId: TENANT,
              name: "AVCO Category",
              code: "AVCO-CAT",
              costingMethod: "avco",
            })
            .returning()
        ).at(0),
        "category"
      );
      const categoryProduct = required(
        (
          await tx
            .insert(product)
            .values({
              tenantId: TENANT,
              sku: "CAT-AVCO",
              name: "Category AVCO",
              categoryId: cat.id,
              baseUomId: uomId,
              priceMinor: 100,
              currency: "USD",
            })
            .returning()
        ).at(0),
        "category product"
      );
      const productProduct = required(
        (
          await tx
            .insert(product)
            .values({
              tenantId: TENANT,
              sku: "PRODUCT-FIFO",
              name: "Product FIFO",
              categoryId: cat.id,
              baseUomId: uomId,
              costingMethod: "fifo",
              priceMinor: 100,
              currency: "USD",
            })
            .returning()
        ).at(0),
        "product override"
      );
      const tenantProduct = required(
        (
          await tx
            .insert(product)
            .values({
              tenantId: TENANT,
              sku: "TENANT-FIFO",
              name: "Tenant FIFO",
              baseUomId: uomId,
              priceMinor: 100,
              currency: "USD",
            })
            .returning()
        ).at(0),
        "tenant product"
      );

      await expect(
        resolveCostingMethod(
          tx,
          { tenantId: TENANT },
          { productId: categoryProduct.id }
        )
      ).resolves.toBe("avco");
      await expect(
        resolveCostingMethod(
          tx,
          { tenantId: TENANT },
          { productId: productProduct.id }
        )
      ).resolves.toBe("fifo");
      await expect(
        resolveCostingMethod(
          tx,
          { tenantId: TENANT },
          { productId: tenantProduct.id }
        )
      ).resolves.toBe("fifo");
    });
  });

  it("AVCO carries integer-division remainder and zeroes value with quantity", async () => {
    await withTenant(db, TENANT, async (tx) => {
      const prod = required(
        (
          await tx
            .insert(product)
            .values({
              tenantId: TENANT,
              sku: "AVCO-REMAINDER",
              name: "AVCO Remainder",
              baseUomId: uomId,
              costingMethod: "avco",
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
              code: "AVCO-REMAINDER-EA",
              baseUomId: uomId,
            })
            .returning()
        ).at(0),
        "sku"
      );
      for (const unitCostMinor of [100, 101]) {
        const movement = await appendStockMovement(
          tx,
          { tenantId: TENANT },
          {
            costCurrency: "USD",
            costScale: 2,
            locationId,
            movementType: "receipt",
            productId: prod.id,
            qtyDelta: 1,
            skuId: item.id,
            unitCostMinor,
          }
        );
        await applyValuation(tx, { tenantId: TENANT }, movement);
      }
      const firstIssue = await appendStockMovement(
        tx,
        { tenantId: TENANT },
        {
          locationId,
          movementType: "sale",
          productId: prod.id,
          qtyDelta: -1,
          skuId: item.id,
        }
      );
      await expect(
        applyValuation(tx, { tenantId: TENANT }, firstIssue)
      ).resolves.toMatchObject({ cogsMinor: 100, unvaluedQty: 0 });
      const carried = required(
        (await tx.select().from(avgCost).where(eq(avgCost.skuId, item.id))).at(
          0
        ),
        "avg cost"
      );
      expect(carried.qtyOnHand).toBe(1);
      expect(carried.totalValueMinor).toBe(101);

      const zeroingIssue = await appendStockMovement(
        tx,
        { tenantId: TENANT },
        {
          locationId,
          movementType: "sale",
          productId: prod.id,
          qtyDelta: -1,
          skuId: item.id,
        }
      );
      await expect(
        applyValuation(tx, { tenantId: TENANT }, zeroingIssue)
      ).resolves.toMatchObject({ cogsMinor: 101, unvaluedQty: 0 });
      const zeroed = required(
        (await tx.select().from(avgCost).where(eq(avgCost.skuId, item.id))).at(
          0
        ),
        "avg cost"
      );
      expect(zeroed.qtyOnHand).toBe(0);
      expect(zeroed.totalValueMinor).toBe(0);
    });
  });

  it("FIFO locks and consumes oldest valuation layers without division", async () => {
    await withTenant(db, TENANT, async (tx) => {
      const prod = required(
        (
          await tx
            .insert(product)
            .values({
              tenantId: TENANT,
              sku: "FIFO-LAYERS",
              name: "FIFO Layers",
              baseUomId: uomId,
              costingMethod: "fifo",
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
              code: "FIFO-LAYERS-EA",
              baseUomId: uomId,
            })
            .returning()
        ).at(0),
        "sku"
      );
      for (const unitCostMinor of [100, 150]) {
        const movement = await appendStockMovement(
          tx,
          { tenantId: TENANT },
          {
            costCurrency: "USD",
            costScale: 2,
            locationId,
            movementType: "receipt",
            productId: prod.id,
            qtyDelta: 2,
            skuId: item.id,
            unitCostMinor,
          }
        );
        await applyValuation(tx, { tenantId: TENANT }, movement);
      }
      const issue = await appendStockMovement(
        tx,
        { tenantId: TENANT },
        {
          locationId,
          movementType: "sale",
          productId: prod.id,
          qtyDelta: -3,
          skuId: item.id,
        }
      );
      await expect(
        applyValuation(tx, { tenantId: TENANT }, issue)
      ).resolves.toMatchObject({
        cogsMinor: 350,
        unvaluedQty: 0,
      });
      const layers = await tx
        .select()
        .from(valuationLayer)
        .where(eq(valuationLayer.skuId, item.id))
        .orderBy(valuationLayer.seq);
      expect(layers.map((layer) => layer.qtyRemaining)).toEqual([0, 1]);
    });
  });
});
