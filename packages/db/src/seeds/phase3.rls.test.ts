// @vitest-environment node
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "../schema";
import {
  avgCost,
  bondReceipt,
  bondReceiptLine,
  bondRelease,
  bondReleaseLine,
  company,
  location,
  organization,
  product,
  sku,
  stockLedger,
  stockTransfer,
  stockTransferLine,
  unitOfMeasure,
  user,
  valuationLayer,
} from "../schema";
import { withTenant } from "../tenant";
import { type ProvisionedTenant, seedPhase3 } from "./index";

// Phase 3 commit 6 — exercises the Phase-3 seed end-to-end against real Postgres
// (as retailos_app). Proves the seed runs through the SERVICES and produces the
// documented demo state: a unified location TREE (warehouse → zone → bins with
// the capacity seam), one COMPLETED + one IN-FLIGHT transfer, and a bonded
// receipt + release with duty. Doubles as the seed's regression gate.

const url = process.env.RLS_TEST_DATABASE_URL;
const TENANT = "phase3_seed_tenant";
const ADMIN = "phase3_seed_admin";

function required<T>(v: T | undefined | null, what: string): T {
  if (v === undefined || v === null) {
    throw new Error(`phase3 seed test: expected ${what}`);
  }
  return v;
}

describe.skipIf(!url)(
  "Phase 3 seed (tree / transfers / bonded release)",
  () => {
    let pool: Pool;
    let db: ReturnType<typeof drizzle<typeof schema>>;
    let result: Awaited<ReturnType<typeof seedPhase3>>;

    beforeAll(async () => {
      pool = new Pool({ connectionString: url });
      db = drizzle(pool, { schema });

      // Clean the Phase-3 tenant (FK-safe order) so the run-once seed re-seeds.
      await withTenant(db, TENANT, async (tx) => {
        await tx.delete(bondReleaseLine);
        await tx.delete(bondRelease);
        await tx.delete(bondReceiptLine);
        await tx.delete(bondReceipt);
        await tx.delete(stockTransferLine);
        await tx.delete(stockTransfer);
        await tx.delete(valuationLayer);
        await tx.delete(avgCost);
        await tx.delete(stockLedger);
        await tx.delete(sku);
        await tx.delete(product);
        await tx.delete(location);
        await tx.delete(unitOfMeasure);
        await tx.delete(company);
      });

      // Stub provisionTenant: the real impl goes through Better Auth (deferred).
      // Identity tables are not RLS-scoped — upsert the user + organization.
      await db
        .insert(user)
        .values({
          id: ADMIN,
          name: "P3 Seed Admin",
          email: "phase3.seed@example.com",
        })
        .onConflictDoNothing();
      await db
        .insert(organization)
        .values({ id: TENANT, name: "Phase 3 Distribution Co" })
        .onConflictDoNothing();

      const provisionTenant = (): Promise<ProvisionedTenant> =>
        Promise.resolve({ adminUserId: ADMIN, tenantId: TENANT });

      result = await seedPhase3({ database: db, provisionTenant });
    });

    afterAll(async () => {
      await pool?.end();
    });

    it("builds the unified location tree (warehouse → zone → bins with capacity)", async () => {
      const locs = await withTenant(db, TENANT, (tx) =>
        tx.select().from(location)
      );
      const byId = new Map(locs.map((l) => [l.id, l]));
      const warehouse = required(byId.get(result.warehouseId), "warehouse");
      expect(warehouse.type).toBe("warehouse");
      expect(warehouse.isSellable).toBe(false);

      // Both seeded bins descend from a zone that descends from the warehouse.
      for (const binId of result.binIds) {
        const bin = required(byId.get(binId), "bin");
        expect(bin.type).toBe("bin");
        // Capacity seam populated.
        expect(bin.maxWeight).toBe(100_000);
        expect(bin.maxVolume).toBe(5000);
        const zone = required(
          byId.get(required(bin.parentLocationId, "bin parent")),
          "zone"
        );
        expect(zone.type).toBe("zone");
        expect(zone.parentLocationId).toBe(result.warehouseId);
      }

      // Bonded node flagged + non-sellable (INV-3 separation).
      const bonded = required(byId.get(result.bondedLocationId), "bonded");
      expect(bonded.isBonded).toBe(true);
      expect(bonded.isSellable).toBe(false);
    });

    it("seeds one COMPLETED and one IN-FLIGHT transfer", async () => {
      const transfers = await withTenant(db, TENANT, (tx) =>
        tx.select().from(stockTransfer)
      );
      const byId = new Map(transfers.map((t) => [t.id, t]));
      expect(
        required(byId.get(result.completedTransferId), "completed").status
      ).toBe("received");
      expect(
        required(byId.get(result.inFlightTransferId), "in-flight").status
      ).toBe("shipped");
    });

    it("releases bonded stock to the store with a released bond_release row", async () => {
      const release = await withTenant(db, TENANT, (tx) =>
        tx
          .select()
          .from(bondRelease)
          .where(eq(bondRelease.id, result.bondReleaseId))
          .limit(1)
          .then((rows) => rows.at(0))
      );
      expect(release?.status).toBe("released");
      expect(release?.transferId).toBeTruthy();

      // Bonded received 40, released 25 → 15 left at the bonded node.
      const bondedCells = await withTenant(db, TENANT, (tx) =>
        tx
          .select()
          .from(avgCost)
          .where(eq(avgCost.locationId, result.bondedLocationId))
      );
      const bondedTotal = bondedCells.reduce((s, c) => s + c.qtyOnHand, 0);
      expect(bondedTotal).toBe(15);

      // Store has stock from BOTH the completed transfer (30 widget) and the bond
      // release (25 widget) → 55 units. The gadget transfer is IN-FLIGHT (shipped,
      // not received), so no gadget has reached the store — store total is 55.
      const storeCells = await withTenant(db, TENANT, (tx) =>
        tx
          .select()
          .from(avgCost)
          .where(eq(avgCost.locationId, result.storeLocationId))
      );
      const storeTotal = storeCells.reduce((s, c) => s + c.qtyOnHand, 0);
      expect(storeTotal).toBe(55);
    });
  }
);
