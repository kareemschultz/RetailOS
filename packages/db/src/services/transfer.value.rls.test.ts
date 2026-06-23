import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "../schema";
import {
  avgCost,
  company,
  location,
  organization,
  product,
  sku,
  stockLedger,
  stockTransfer,
  stockTransferLine,
  unitOfMeasure,
  valuationLayer,
} from "../schema";
import type { TenantTransaction } from "../tenant";
import { withTenant } from "../tenant";
import { applyValuation } from "./costing";
import { appendStockMovement } from "./stock-ledger";
import { createTransfer, receiveTransfer, shipTransfer } from "./transfer";

// Phase 3 commit 3 — transfer VALUE conservation (DB-gated, real Postgres).
// Proves: value released at source == value received at destination == V, and
// Σ value over {source, per-transfer in-transit node, destination} is unchanged
// at EACH step (dispatch AND receive), for AVCO and FIFO; the FIFO F1 penny case
// (V=201, q=2 recovers exactly 201 on full consumption); and two overlapping
// same-SKU transfers do not blend value (F2, per-transfer node isolation).
//
// These tests drive the transfer SERVICE directly; the #8-class write-path proof
// (the transfer ROUTER invokes valuation on both legs) lives in the api package's
// vs1.integration.test.ts. The frozen Phase-2 costing suite (costing.rls.test.ts)
// is intentionally NOT touched — its passing UNCHANGED is the additivity proof.

const url = process.env.RLS_TEST_DATABASE_URL;
const TENANT = "transfer_value_tenant";

function required<T>(row: T | undefined, what: string): T {
  if (!row) {
    throw new Error(`expected ${what}`);
  }
  return row;
}

describe.skipIf(!url)(
  "Phase 3 transfer value conservation (tenant-scoped)",
  () => {
    let pool: Pool;
    let db: ReturnType<typeof drizzle<typeof schema>>;
    let sourceId: string;
    let destId: string;
    let uomId: string;

    const ctx = { tenantId: TENANT };

    async function avcoValue(
      tx: TenantTransaction,
      skuId: string,
      locationId: string
    ): Promise<number> {
      const rows = await tx.execute(sql`
      SELECT COALESCE(total_value_minor, 0)::bigint AS v
      FROM avg_cost
      WHERE tenant_id = ${TENANT} AND sku_id = ${skuId}
        AND location_id = ${locationId}
    `);
      return Number((rows.rows.at(0) as { v?: number } | undefined)?.v ?? 0);
    }

    async function fifoValue(
      tx: TenantTransaction,
      skuId: string,
      locationId: string
    ): Promise<number> {
      const rows = await tx.execute(sql`
      SELECT COALESCE(SUM(qty_remaining * unit_cost_minor), 0)::bigint AS v
      FROM valuation_layer
      WHERE tenant_id = ${TENANT} AND sku_id = ${skuId}
        AND location_id = ${locationId}
    `);
      return Number((rows.rows.at(0) as { v?: number } | undefined)?.v ?? 0);
    }

    async function makeSku(
      tx: TenantTransaction,
      code: string,
      method: "avco" | "fifo"
    ): Promise<{ productId: string; skuId: string }> {
      const prod = required(
        (
          await tx
            .insert(product)
            .values({
              tenantId: TENANT,
              sku: code,
              name: `${code} product`,
              baseUomId: uomId,
              costingMethod: method,
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
              code: `${code}-EA`,
              baseUomId: uomId,
            })
            .returning()
        ).at(0),
        "sku"
      );
      return { productId: prod.id, skuId: item.id };
    }

    async function receive(
      tx: TenantTransaction,
      opts: {
        locationId: string;
        productId: string;
        skuId: string;
        qty: number;
        unitCostMinor: number;
      }
    ): Promise<void> {
      const movement = await appendStockMovement(tx, ctx, {
        costCurrency: "USD",
        costScale: 2,
        locationId: opts.locationId,
        movementType: "receipt",
        productId: opts.productId,
        qtyDelta: opts.qty,
        skuId: opts.skuId,
        unitCostMinor: opts.unitCostMinor,
      });
      await applyValuation(tx, ctx, movement);
    }

    beforeAll(async () => {
      pool = new Pool({ connectionString: url });
      db = drizzle(pool, { schema });
      await withTenant(db, TENANT, async (tx) => {
        await tx.delete(valuationLayer);
        await tx.delete(avgCost);
        await tx.delete(stockTransferLine);
        await tx.delete(stockTransfer);
        await tx.delete(stockLedger);
        await tx.delete(sku);
        await tx.delete(product);
        await tx.delete(location);
        await tx.delete(company);
        await tx.delete(unitOfMeasure);
      });
      await db
        .insert(organization)
        .values({
          id: TENANT,
          name: "Transfer Value Tenant",
          costingMethod: "avco",
        })
        .onConflictDoUpdate({
          target: organization.id,
          set: { costingMethod: "avco", name: "Transfer Value Tenant" },
        });
      const ids = await withTenant(db, TENANT, async (tx) => {
        const co = required(
          (
            await tx
              .insert(company)
              .values({ tenantId: TENANT, name: "Transfer Co" })
              .returning()
          ).at(0),
          "company"
        );
        const src = required(
          (
            await tx
              .insert(location)
              .values({
                tenantId: TENANT,
                companyId: co.id,
                name: "Source WH",
                type: "warehouse",
              })
              .returning()
          ).at(0),
          "source"
        );
        const dst = required(
          (
            await tx
              .insert(location)
              .values({
                tenantId: TENANT,
                companyId: co.id,
                name: "Dest Store",
                type: "store",
              })
              .returning()
          ).at(0),
          "dest"
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
        return {
          sourceId: src.id,
          destId: dst.id,
          uomId: uom.id,
        };
      });
      sourceId = ids.sourceId;
      destId = ids.destId;
      uomId = ids.uomId;
    });

    afterAll(async () => {
      await pool?.end();
    });

    it("AVCO: value released == received == V; Σ value conserved at each step", async () => {
      await withTenant(db, TENANT, async (tx) => {
        const { productId, skuId } = await makeSku(tx, "AVCO-XFER", "avco");
        // Two receipts → total 1002 over qty 4 (non-divisible by the transfer qty,
        // so the destination exercises the floor + value-only remainder path).
        await receive(tx, {
          locationId: sourceId,
          productId,
          skuId,
          qty: 2,
          unitCostMinor: 250,
        });
        await receive(tx, {
          locationId: sourceId,
          productId,
          skuId,
          qty: 2,
          unitCostMinor: 251,
        });
        expect(await avcoValue(tx, skuId, sourceId)).toBe(1002);

        const { transfer } = await createTransfer(tx, ctx, {
          sourceLocationId: sourceId,
          destLocationId: destId,
          lines: [{ productId, skuId, qty: 3 }],
        });
        const transitId = transfer.inTransitLocationId;

        // Ship: V = AVCO cogs of 3 of 4 units = trunc(1002*3/4) = 751.
        const ship = await shipTransfer(tx, ctx, transfer.id);
        expect(ship.lineValues[0]?.valueMinor).toBe(751);
        const srcAfterShip = await avcoValue(tx, skuId, sourceId);
        const transitAfterShip = await avcoValue(tx, skuId, transitId);
        const destAfterShip = await avcoValue(tx, skuId, destId);
        expect(srcAfterShip).toBe(251); // 1002 - 751
        expect(transitAfterShip).toBe(751); // floor(751/3)*3=750 + remainder 1
        expect(destAfterShip).toBe(0);
        expect(srcAfterShip + transitAfterShip + destAfterShip).toBe(1002);

        // Receive: value flows transit → dest, exactly V (== released).
        const recv = await receiveTransfer(tx, ctx, transfer.id);
        expect(recv.lineValues[0]?.valueMinor).toBe(751);
        const srcAfterRecv = await avcoValue(tx, skuId, sourceId);
        const transitAfterRecv = await avcoValue(tx, skuId, transitId);
        const destAfterRecv = await avcoValue(tx, skuId, destId);
        expect(srcAfterRecv).toBe(251);
        expect(transitAfterRecv).toBe(0);
        expect(destAfterRecv).toBe(751);
        expect(srcAfterRecv + transitAfterRecv + destAfterRecv).toBe(1002);
      });
    });

    it("FIFO: value-exact layer set conserves V and recovers the F1 penny", async () => {
      await withTenant(db, TENANT, async (tx) => {
        const { productId, skuId } = await makeSku(tx, "FIFO-XFER", "fifo");
        // Layers [100, 101] → total 201 over qty 2. Transferring both makes V=201,
        // q=2 — the F1 penny case a single layer (unit_cost=100) would lose.
        await receive(tx, {
          locationId: sourceId,
          productId,
          skuId,
          qty: 1,
          unitCostMinor: 100,
        });
        await receive(tx, {
          locationId: sourceId,
          productId,
          skuId,
          qty: 1,
          unitCostMinor: 101,
        });
        expect(await fifoValue(tx, skuId, sourceId)).toBe(201);

        const { transfer } = await createTransfer(tx, ctx, {
          sourceLocationId: sourceId,
          destLocationId: destId,
          lines: [{ productId, skuId, qty: 2 }],
        });
        const transitId = transfer.inTransitLocationId;

        const ship = await shipTransfer(tx, ctx, transfer.id);
        expect(ship.lineValues[0]?.valueMinor).toBe(201);
        expect(await fifoValue(tx, skuId, sourceId)).toBe(0);
        expect(await fifoValue(tx, skuId, transitId)).toBe(201);
        expect(await fifoValue(tx, skuId, destId)).toBe(0);

        const recv = await receiveTransfer(tx, ctx, transfer.id);
        expect(recv.lineValues[0]?.valueMinor).toBe(201);
        expect(await fifoValue(tx, skuId, sourceId)).toBe(0);
        expect(await fifoValue(tx, skuId, transitId)).toBe(0);
        expect(await fifoValue(tx, skuId, destId)).toBe(201);

        // F1 PENNY PROOF: consuming all 2 units at the destination recovers EXACTLY
        // 201 (100 + 101) — a single lossy layer at floor(201/2)=100 would yield 200.
        const sale = await appendStockMovement(tx, ctx, {
          locationId: destId,
          movementType: "sale",
          productId,
          qtyDelta: -2,
          skuId,
        });
        const cogs = await applyValuation(tx, ctx, sale);
        expect(cogs.cogsMinor).toBe(201);
        expect(cogs.unvaluedQty).toBe(0);
      });
    });

    it("F2: two overlapping same-SKU transfers do not blend value", async () => {
      await withTenant(db, TENANT, async (tx) => {
        const { productId, skuId } = await makeSku(tx, "FIFO-F2", "fifo");
        // Layers [100×2, 300×2]. Transfer A (qty 2) consumes the 100 layer (V=200);
        // transfer B (qty 2) consumes the 300 layer (V=600). A shared in-transit
        // cell would blend these; per-transfer nodes keep them isolated.
        await receive(tx, {
          locationId: sourceId,
          productId,
          skuId,
          qty: 2,
          unitCostMinor: 100,
        });
        await receive(tx, {
          locationId: sourceId,
          productId,
          skuId,
          qty: 2,
          unitCostMinor: 300,
        });

        const a = await createTransfer(tx, ctx, {
          sourceLocationId: sourceId,
          destLocationId: destId,
          lines: [{ productId, skuId, qty: 2 }],
        });
        const b = await createTransfer(tx, ctx, {
          sourceLocationId: sourceId,
          destLocationId: destId,
          lines: [{ productId, skuId, qty: 2 }],
        });

        const shipA = await shipTransfer(tx, ctx, a.transfer.id);
        const shipB = await shipTransfer(tx, ctx, b.transfer.id);
        // Each transfer carries its own FIFO-consumed value, not a blended average.
        expect(shipA.lineValues[0]?.valueMinor).toBe(200);
        expect(shipB.lineValues[0]?.valueMinor).toBe(600);
        // Per-transfer in-transit nodes hold separate values (no blending).
        expect(await fifoValue(tx, skuId, a.transfer.inTransitLocationId)).toBe(
          200
        );
        expect(await fifoValue(tx, skuId, b.transfer.inTransitLocationId)).toBe(
          600
        );
        expect(await fifoValue(tx, skuId, sourceId)).toBe(0);

        const recvA = await receiveTransfer(tx, ctx, a.transfer.id);
        const recvB = await receiveTransfer(tx, ctx, b.transfer.id);
        // Received value equals each transfer's OWN released value (no cross-leak).
        expect(recvA.lineValues[0]?.valueMinor).toBe(200);
        expect(recvB.lineValues[0]?.valueMinor).toBe(600);
        expect(await fifoValue(tx, skuId, destId)).toBe(800);
      });
    });
  }
);
