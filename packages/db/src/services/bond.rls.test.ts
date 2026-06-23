// @vitest-environment node
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "../schema";
import {
  avgCost,
  bondReceipt,
  bondReceiptLine,
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
import { createBondReceipt } from "./bond";

// Phase 3 commit 4 — bond receiving + INV-3 separation (DB-gated, real Postgres).
// Proves:
// - Bond receipt rejected if target is not a bonded location.
// - Bond receipt rejected if any SKU resolves to FIFO (§I.4 LOCKED, AVCO-only).
// - Successful bond receipt: stock_ledger + avg_cost built at bonded location;
//   bond_receipt_line carries the F5 stamp and movementId.
// - INV-3 separation: no avg_cost at the non-bonded store (stock isolated to bonded node).

const url = process.env.RLS_TEST_DATABASE_URL;
const TENANT = "bond_rls_tenant";
const RE_BONDED_LOCATION = /bonded location/;
const RE_AVCO_ONLY = /AVCO-only/i;
const RE_BND_PREFIX = /^BND-/;

function required<T>(v: T | undefined, what: string): T {
  if (v === undefined || v === null) {
    throw new Error(`bond test: expected ${what}`);
  }
  return v;
}

describe.skipIf(!url)("Phase 3 bond receiving + INV-3 separation", () => {
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let bondedLocationId: string;
  let storeLocationId: string;
  let avcoSkuId: string;
  let avcoProductId: string;
  let fifoSkuId: string;
  let fifoProductId: string;
  let companyId: string;

  const ctx = { tenantId: TENANT };

  beforeAll(async () => {
    pool = new Pool({ connectionString: url });
    db = drizzle(pool, { schema });
    await withTenant(db, TENANT, async (tx) => {
      await tx.delete(bondReceiptLine);
      await tx.delete(bondReceipt);
      await tx.delete(valuationLayer);
      await tx.delete(avgCost);
      await tx.delete(stockLedger);
      await tx.delete(sku);
      await tx.delete(product);
      await tx.delete(location);
      await tx.delete(company);
      await tx.delete(unitOfMeasure);
    });
    await db
      .insert(organization)
      .values({ id: TENANT, name: "Bond RLS Tenant", costingMethod: "avco" })
      .onConflictDoUpdate({
        target: organization.id,
        set: { costingMethod: "avco", name: "Bond RLS Tenant" },
      });
    const ids = await withTenant(db, TENANT, async (tx) => {
      const co = required(
        (
          await tx
            .insert(company)
            .values({ tenantId: TENANT, name: "Bond Co" })
            .returning()
        ).at(0),
        "company"
      );
      const uom = required(
        (
          await tx
            .insert(unitOfMeasure)
            .values({ tenantId: TENANT, code: "EA", name: "Each" })
            .returning()
        ).at(0),
        "uom"
      );
      const bondedLoc = required(
        (
          await tx
            .insert(location)
            .values({
              tenantId: TENANT,
              companyId: co.id,
              name: "Bonded WH",
              type: "bonded",
              isBonded: true,
              isSellable: false,
            })
            .returning()
        ).at(0),
        "bonded location"
      );
      const storeLoc = required(
        (
          await tx
            .insert(location)
            .values({
              tenantId: TENANT,
              companyId: co.id,
              name: "Store",
              type: "store",
              isSellable: true,
            })
            .returning()
        ).at(0),
        "store location"
      );
      const avcoP = required(
        (
          await tx
            .insert(product)
            .values({
              tenantId: TENANT,
              sku: "BND-AVCO",
              name: "Bonded AVCO Product",
              baseUomId: uom.id,
              priceMinor: 5000,
              currency: "USD",
            })
            .returning()
        ).at(0),
        "avco product"
      );
      const avcoS = required(
        (
          await tx
            .insert(sku)
            .values({
              tenantId: TENANT,
              productId: avcoP.id,
              code: "BND-AVCO-EA",
              baseUomId: uom.id,
            })
            .returning()
        ).at(0),
        "avco sku"
      );
      const fifoP = required(
        (
          await tx
            .insert(product)
            .values({
              tenantId: TENANT,
              sku: "BND-FIFO",
              name: "Bonded FIFO Product",
              baseUomId: uom.id,
              costingMethod: "fifo",
              priceMinor: 5000,
              currency: "USD",
            })
            .returning()
        ).at(0),
        "fifo product"
      );
      const fifoS = required(
        (
          await tx
            .insert(sku)
            .values({
              tenantId: TENANT,
              productId: fifoP.id,
              code: "BND-FIFO-EA",
              baseUomId: uom.id,
            })
            .returning()
        ).at(0),
        "fifo sku"
      );
      return {
        companyId: co.id,
        bondedLocationId: bondedLoc.id,
        storeLocationId: storeLoc.id,
        avcoProductId: avcoP.id,
        avcoSkuId: avcoS.id,
        fifoProductId: fifoP.id,
        fifoSkuId: fifoS.id,
      };
    });
    companyId = ids.companyId;
    bondedLocationId = ids.bondedLocationId;
    storeLocationId = ids.storeLocationId;
    avcoProductId = ids.avcoProductId;
    avcoSkuId = ids.avcoSkuId;
    fifoProductId = ids.fifoProductId;
    fifoSkuId = ids.fifoSkuId;
  });

  afterAll(async () => {
    await pool?.end();
  });

  it("rejects bond receipt into a non-bonded (store) location", async () => {
    await expect(
      withTenant(db, TENANT, (tx) =>
        createBondReceipt(tx, ctx, {
          companyId,
          locationId: storeLocationId,
          lines: [
            {
              productId: avcoProductId,
              skuId: avcoSkuId,
              qty: 10,
              unitCostMinor: 1000,
              costCurrency: "USD",
              costScale: 2,
            },
          ],
        })
      )
    ).rejects.toThrow(RE_BONDED_LOCATION);
  });

  it("rejects bond receipt for a FIFO-costed SKU (§I.4 AVCO-only LOCKED)", async () => {
    await expect(
      withTenant(db, TENANT, (tx) =>
        createBondReceipt(tx, ctx, {
          companyId,
          locationId: bondedLocationId,
          lines: [
            {
              productId: fifoProductId,
              skuId: fifoSkuId,
              qty: 5,
              unitCostMinor: 2000,
              costCurrency: "USD",
              costScale: 2,
            },
          ],
        })
      )
    ).rejects.toThrow(RE_AVCO_ONLY);
  });

  it("creates bond receipt, values AVCO at bonded location, stamps F5", async () => {
    const { receipt, lines } = await withTenant(db, TENANT, (tx) =>
      createBondReceipt(tx, ctx, {
        companyId,
        locationId: bondedLocationId,
        supplierRef: "INV-2026-001",
        customsReference: "CUST-REF-001",
        lines: [
          {
            productId: avcoProductId,
            skuId: avcoSkuId,
            qty: 10,
            unitCostMinor: 1500,
            costCurrency: "USD",
            costScale: 2,
            customsReference: "LINE-CUST-001",
            landedCostReference: "LCR-001",
          },
        ],
      })
    );

    expect(receipt.number).toMatch(RE_BND_PREFIX);
    expect(receipt.status).toBe("open");
    expect(receipt.supplierRef).toBe("INV-2026-001");

    expect(lines).toHaveLength(1);
    const line = required(lines[0], "line");
    // F5 stamp: costing method applied stamped at receipt time
    expect(line.costingMethodApplied).toBe("avco");
    expect(line.movementId).toBeTruthy();
    expect(line.customsReference).toBe("LINE-CUST-001");
    expect(line.landedCostReference).toBe("LCR-001");

    // INV-3: avg_cost populated at the BONDED location
    const avcoCell = await withTenant(db, TENANT, async (tx) =>
      tx
        .select()
        .from(avgCost)
        .where(
          and(
            eq(avgCost.skuId, avcoSkuId),
            eq(avgCost.locationId, bondedLocationId)
          )
        )
        .limit(1)
        .then((rows) => rows.at(0))
    );
    expect(avcoCell?.qtyOnHand).toBe(10);
    expect(avcoCell?.totalValueMinor).toBe(15_000); // 10 × 1500

    // INV-3 separation: no avg_cost at the store (stock isolated to bonded node)
    const storeCell = await withTenant(db, TENANT, async (tx) =>
      tx
        .select()
        .from(avgCost)
        .where(
          and(
            eq(avgCost.skuId, avcoSkuId),
            eq(avgCost.locationId, storeLocationId)
          )
        )
        .limit(1)
        .then((rows) => rows.at(0))
    );
    expect(storeCell).toBeUndefined();
  });
});
