// @vitest-environment node
import { count, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "../schema";
import {
  avgCost,
  barcode,
  bondReceipt,
  bondReceiptLine,
  bondRelease,
  bondReleaseLine,
  brand,
  category,
  company,
  invoice,
  location,
  lot,
  organization,
  product,
  reorderRule,
  sale,
  saleLine,
  sku,
  stockLedger,
  stockTransfer,
  stockTransferLine,
  tender,
  unitOfMeasure,
  user,
  valuationLayer,
} from "../schema";
import { withTenant } from "../tenant";
import { type ProvisionedTenant, seedDemo } from "./index";

// Exercises the marketing/demo seed end-to-end against real Postgres (as
// retailos_app). Proves it builds the documented multi-scenario state THROUGH
// the services, and that it is re-runnable (a second run adds nothing).

const url = process.env.RLS_TEST_DATABASE_URL;
const TENANT = "demo_seed_tenant";
const ADMIN = "demo_seed_admin";

function required<T>(v: T | undefined | null, what: string): T {
  if (v === undefined || v === null) {
    throw new Error(`demo seed test: expected ${what}`);
  }
  return v;
}

describe.skipIf(!url)(
  "Demo seed (catalog / stock / sales / transfers / bond)",
  () => {
    let pool: Pool;
    let db: ReturnType<typeof drizzle<typeof schema>>;
    let result: Awaited<ReturnType<typeof seedDemo>>;

    const countRows = (
      table:
        | typeof product
        | typeof sale
        | typeof stockTransfer
        | typeof bondReceipt
    ) =>
      withTenant(db, TENANT, async (tx) => {
        const rows = await tx.select({ c: count() }).from(table);
        return Number(rows.at(0)?.c ?? 0);
      });

    beforeAll(async () => {
      pool = new Pool({ connectionString: url });
      db = drizzle(pool, { schema });

      // Clean the demo tenant (FK-safe order) so the run-once seed re-seeds.
      await withTenant(db, TENANT, async (tx) => {
        await tx.delete(bondReleaseLine);
        await tx.delete(bondRelease);
        await tx.delete(bondReceiptLine);
        await tx.delete(bondReceipt);
        await tx.delete(tender);
        await tx.delete(saleLine);
        await tx.delete(invoice);
        await tx.delete(sale);
        await tx.delete(stockTransferLine);
        await tx.delete(stockTransfer);
        await tx.delete(valuationLayer);
        await tx.delete(avgCost);
        await tx.delete(stockLedger);
        await tx.delete(reorderRule);
        await tx.delete(lot);
        await tx.delete(barcode);
        await tx.delete(sku);
        await tx.delete(product);
        await tx.delete(category);
        await tx.delete(brand);
        await tx.delete(location);
        await tx.delete(unitOfMeasure);
        await tx.delete(company);
      });

      // Stub provisionTenant (real impl goes through Better Auth, deferred).
      await db
        .insert(user)
        .values({
          id: ADMIN,
          name: "Demo Seed Admin",
          email: "demo.seed@example.com",
        })
        .onConflictDoNothing();
      await db
        .insert(organization)
        .values({ id: TENANT, name: "RetailOS Demo Co" })
        .onConflictDoNothing();

      const provisionTenant = (): Promise<ProvisionedTenant> =>
        Promise.resolve({ adminUserId: ADMIN, tenantId: TENANT });

      result = await seedDemo({ database: db, provisionTenant });
    });

    afterAll(async () => {
      await pool?.end();
    });

    it("builds the company, 4-location set, and full catalog through the services", async () => {
      const locs = await withTenant(db, TENANT, (tx) =>
        tx.select().from(location)
      );
      const byId = new Map(locs.map((l) => [l.id, l]));
      expect(required(byId.get(result.mainStoreId), "main").type).toBe("store");
      expect(required(byId.get(result.secondStoreId), "city").type).toBe(
        "store"
      );
      expect(required(byId.get(result.warehouseId), "wh").type).toBe(
        "warehouse"
      );
      const bonded = required(byId.get(result.bondedLocationId), "bonded");
      expect(bonded.isBonded).toBe(true);
      expect(bonded.isSellable).toBe(false);

      const products = await withTenant(db, TENANT, (tx) =>
        tx.select().from(product)
      );
      expect(products.length).toBe(24);
      const skus = await withTenant(db, TENANT, (tx) => tx.select().from(sku));
      expect(skus.length).toBe(24);
      // A couple of FIFO/lot-tracked products with lots.
      const fifoProducts = products.filter((p) => p.costingMethod === "fifo");
      expect(fifoProducts.length).toBe(2);
      const lots = await withTenant(db, TENANT, (tx) => tx.select().from(lot));
      expect(lots.length).toBe(2);
    });

    it("seeds opening stock (valuation cells) and completed sales with stamped COGS", async () => {
      // Warehouse holds AVCO + FIFO valuation cells.
      const avco = await withTenant(db, TENANT, (tx) =>
        tx
          .select()
          .from(avgCost)
          .where(eq(avgCost.locationId, result.warehouseId))
      );
      expect(avco.length).toBeGreaterThan(0);
      expect(avco.some((c) => c.qtyOnHand > 0)).toBe(true);

      // Completed sales exist across both stores with stamped COGS on lines.
      const sales = await withTenant(db, TENANT, (tx) =>
        tx.select().from(sale).where(eq(sale.status, "completed"))
      );
      expect(sales.length).toBeGreaterThanOrEqual(6);
      expect(sales.some((s) => s.locationId === result.mainStoreId)).toBe(true);
      expect(sales.some((s) => s.locationId === result.secondStoreId)).toBe(
        true
      );
      const lines = await withTenant(db, TENANT, (tx) =>
        tx.select().from(saleLine)
      );
      expect(lines.length).toBeGreaterThan(0);
      expect(lines.some((l) => l.cogsMinor != null && l.cogsMinor > 0)).toBe(
        true
      );
    });

    it("completes two inter-store transfers and one bond receipt + release", async () => {
      expect(result.transferIds.length).toBe(2);
      const transfers = await withTenant(db, TENANT, (tx) =>
        tx.select().from(stockTransfer)
      );
      const byId = new Map(transfers.map((t) => [t.id, t]));
      // The two inter-store transfers completed (a 3rd transfer is created
      // internally by the bond release: a bonded→released move).
      for (const id of result.transferIds) {
        expect(required(byId.get(id), "transfer").status).toBe("received");
      }

      expect(result.bondReceiptId).toBeTruthy();
      const releases = await withTenant(db, TENANT, (tx) =>
        tx.select().from(bondRelease)
      );
      expect(releases.length).toBe(1);
      expect(releases[0]?.status).toBe("released");
    });

    it("is re-runnable — a second seedDemo adds no duplicate rows", async () => {
      const before = {
        products: await countRows(product),
        sales: await countRows(sale),
        transfers: await countRows(stockTransfer),
        receipts: await countRows(bondReceipt),
      };
      const provisionTenant = (): Promise<ProvisionedTenant> =>
        Promise.resolve({ adminUserId: ADMIN, tenantId: TENANT });
      await seedDemo({ database: db, provisionTenant });
      const after = {
        products: await countRows(product),
        sales: await countRows(sale),
        transfers: await countRows(stockTransfer),
        receipts: await countRows(bondReceipt),
      };
      expect(after).toEqual(before);
    });
  }
);
