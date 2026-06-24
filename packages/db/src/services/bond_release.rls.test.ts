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
  bondRelease,
  bondReleaseLine,
  company,
  location,
  lot,
  organization,
  product,
  sku,
  stockLedger,
  unitOfMeasure,
  valuationLayer,
} from "../schema";
import { withTenant } from "../tenant";
import { createBondReceipt } from "./bond";
import { executeBondRelease } from "./bond_release";

// Phase 3 commit 5 — bond release + duty (INV-4/5) (DB-gated, real Postgres).
// Proves the LOADED-BEARING design questions for the release path:
//  - The bonded→released transfer CONSERVES value (INV-2): exactly what leaves
//    the bonded cell lands at the destination, before duty.
//  - The duty/tax value-only adjustment is an INTENTIONAL value-ADD (INV-5):
//    destination total_value == releasedValue + duty + tax; qty unchanged.
//  - The qty=0⟺value=0 invariant holds across a full release.
//  - The F5 stamp protects the path: a post-receipt costing-method flip does NOT
//    break release (it reads the receipt-line stamp), and a non-'avco' stamp is
//    REJECTED rather than silently mis-valued.
//  - Bonded on-hand cannot be over-released; cross-company / bonded-dest blocked
//    (service guard) and the dest composite FK kills cross-company at the DB
//    layer for ANY caller (F4 class).

const url = process.env.RLS_TEST_DATABASE_URL;
const TENANT = "bond_release_rls_tenant";
const RE_EXCEEDS = /exceeds bonded on-hand/i;
const RE_AVCO_ONLY = /only 'avco' is supported/i;
const RE_CROSS_COMPANY = /does not belong to the receipt's company/i;
const RE_DEST_BONDED = /non-bonded \(sellable\) location/i;
const RE_DEST_COMPOSITE_FK = /bond_release_dest_composite_fk/;
const RE_LIVE_DRIFT = /now resolves to 'fifo'/i;

function required<T>(v: T | undefined | null, what: string): T {
  if (v === undefined || v === null) {
    throw new Error(`bond_release test: expected ${what}`);
  }
  return v;
}

describe.skipIf(!url)("Phase 3 bond release + duty (INV-4/5)", () => {
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let companyId: string;
  let bondedLocationId: string;
  let storeLocationId: string;
  let companyBStoreLocationId: string;
  let uomId: string;
  let skuSeq = 0;

  const ctx = { tenantId: TENANT, actorUserId: null };

  // Create a fresh AVCO product+sku so each test's avg_cost cell is isolated
  // (avg_cost is keyed by (sku, location); reusing one sku would accumulate).
  async function makeAvcoSku(): Promise<{ productId: string; skuId: string }> {
    skuSeq += 1;
    const code = `BRL-${skuSeq}`;
    return await withTenant(db, TENANT, async (tx) => {
      const p = required(
        (
          await tx
            .insert(product)
            .values({
              tenantId: TENANT,
              sku: code,
              name: `Release Product ${skuSeq}`,
              baseUomId: uomId,
              priceMinor: 5000,
              currency: "USD",
            })
            .returning()
        ).at(0),
        "product"
      );
      const s = required(
        (
          await tx
            .insert(sku)
            .values({
              tenantId: TENANT,
              productId: p.id,
              code: `${code}-EA`,
              baseUomId: uomId,
            })
            .returning()
        ).at(0),
        "sku"
      );
      return { productId: p.id, skuId: s.id };
    });
  }

  // Receive `qty` @ `unitCostMinor` into the bonded location, returning the
  // receipt + its single line id.
  async function receiveBonded(args: {
    productId: string;
    skuId: string;
    qty: number;
    unitCostMinor: number;
  }): Promise<{ receiptId: string; receiptLineId: string }> {
    return await withTenant(db, TENANT, async (tx) => {
      const { receipt, lines } = await createBondReceipt(tx, ctx, {
        companyId,
        locationId: bondedLocationId,
        lines: [
          {
            productId: args.productId,
            skuId: args.skuId,
            qty: args.qty,
            unitCostMinor: args.unitCostMinor,
            costCurrency: "USD",
            costScale: 2,
          },
        ],
      });
      return {
        receiptId: receipt.id,
        receiptLineId: required(lines[0], "receipt line").id,
      };
    });
  }

  function avgCell(skuId: string, locationId: string) {
    return withTenant(db, TENANT, (tx) =>
      tx
        .select()
        .from(avgCost)
        .where(
          and(eq(avgCost.skuId, skuId), eq(avgCost.locationId, locationId))
        )
        .limit(1)
        .then((rows) => rows.at(0))
    );
  }

  beforeAll(async () => {
    pool = new Pool({ connectionString: url });
    db = drizzle(pool, { schema });
    await withTenant(db, TENANT, async (tx) => {
      await tx.delete(bondReleaseLine);
      await tx.delete(bondRelease);
      await tx.delete(bondReceiptLine);
      await tx.delete(bondReceipt);
      await tx.delete(schema.stockTransferLine);
      await tx.delete(schema.stockTransfer);
      await tx.delete(valuationLayer);
      await tx.delete(avgCost);
      await tx.delete(stockLedger);
      await tx.delete(lot);
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
        name: "Bond Release Tenant",
        costingMethod: "avco",
      })
      .onConflictDoUpdate({
        target: organization.id,
        set: { costingMethod: "avco", name: "Bond Release Tenant" },
      });
    const ids = await withTenant(db, TENANT, async (tx) => {
      const co = required(
        (
          await tx
            .insert(company)
            .values({ tenantId: TENANT, name: "Release Co" })
            .returning()
        ).at(0),
        "company"
      );
      const coB = required(
        (
          await tx
            .insert(company)
            .values({ tenantId: TENANT, name: "Release Co B" })
            .returning()
        ).at(0),
        "company B"
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
      const storeLocB = required(
        (
          await tx
            .insert(location)
            .values({
              tenantId: TENANT,
              companyId: coB.id,
              name: "Store B",
              type: "store",
              isSellable: true,
            })
            .returning()
        ).at(0),
        "company B store location"
      );
      return {
        companyId: co.id,
        bondedLocationId: bondedLoc.id,
        storeLocationId: storeLoc.id,
        companyBStoreLocationId: storeLocB.id,
        uomId: uom.id,
      };
    });
    companyId = ids.companyId;
    bondedLocationId = ids.bondedLocationId;
    storeLocationId = ids.storeLocationId;
    companyBStoreLocationId = ids.companyBStoreLocationId;
    uomId = ids.uomId;
  });

  afterAll(async () => {
    await pool?.end();
  });

  it("releases bonded→store conserving value, then ADDS duty+tax to the released cost basis (INV-4/5)", async () => {
    const { skuId, productId } = await makeAvcoSku();
    const { receiptId, receiptLineId } = await receiveBonded({
      productId,
      skuId,
      qty: 10,
      unitCostMinor: 1500, // avg cost 1500/unit → bonded value 15000
    });

    const result = await withTenant(db, TENANT, (tx) =>
      executeBondRelease(tx, ctx, {
        bondReceiptId: receiptId,
        destLocationId: storeLocationId,
        lines: [
          {
            bondReceiptLineId: receiptLineId,
            qty: 4,
            dutyMinor: 300,
            taxMinor: 100,
          },
        ],
      })
    );

    expect(result.release.status).toBe("released");
    expect(result.release.transferId).toBeTruthy();
    expect(result.transferId).toBe(result.release.transferId);

    // INV-2: exactly 4 × 1500 = 6000 conserved out of the bonded cell.
    const releaseLineValue = required(
      result.eventLines[0],
      "event line"
    ).releasedValueMinor;
    expect(releaseLineValue).toBe(6000);

    // Bonded cell after issuing 4: qty 6, value 9000 (15000 − 6000).
    const bonded = await avgCell(skuId, bondedLocationId);
    expect(bonded?.qtyOnHand).toBe(6);
    expect(bonded?.totalValueMinor).toBe(9000);

    // Released (store) cell: qty 4, value = 6000 released + 300 duty + 100 tax.
    const store = await avgCell(skuId, storeLocationId);
    expect(store?.qtyOnHand).toBe(4); // qty UNCHANGED by the duty value-only add
    expect(store?.totalValueMinor).toBe(6400);
  });

  it("preserves qty=0 ⟺ value=0 when the full bonded balance is released", async () => {
    const { skuId, productId } = await makeAvcoSku();
    const { receiptId, receiptLineId } = await receiveBonded({
      productId,
      skuId,
      qty: 8,
      unitCostMinor: 2000,
    });

    await withTenant(db, TENANT, (tx) =>
      executeBondRelease(tx, ctx, {
        bondReceiptId: receiptId,
        destLocationId: storeLocationId,
        lines: [{ bondReceiptLineId: receiptLineId, qty: 8 }],
      })
    );

    // Bonded cell fully drained: qty 0 ⇒ value MUST be 0 (the invariant).
    const bonded = await avgCell(skuId, bondedLocationId);
    expect(bonded?.qtyOnHand).toBe(0);
    expect(bonded?.totalValueMinor).toBe(0);

    // Store received the full conserved value (no duty this time): 8 × 2000.
    const store = await avgCell(skuId, storeLocationId);
    expect(store?.qtyOnHand).toBe(8);
    expect(store?.totalValueMinor).toBe(16_000);
  });

  it("rejects releasing more than the bonded on-hand (aggregated per SKU)", async () => {
    const { skuId, productId } = await makeAvcoSku();
    const { receiptId, receiptLineId } = await receiveBonded({
      productId,
      skuId,
      qty: 5,
      unitCostMinor: 1000,
    });

    await expect(
      withTenant(db, TENANT, (tx) =>
        executeBondRelease(tx, ctx, {
          bondReceiptId: receiptId,
          destLocationId: storeLocationId,
          // Two lines on the SAME sku that individually fit but sum to 6 > 5.
          lines: [
            { bondReceiptLineId: receiptLineId, qty: 3 },
            { bondReceiptLineId: receiptLineId, qty: 3 },
          ],
        })
      )
    ).rejects.toThrow(RE_EXCEEDS);
  });

  it("F5: release resolves costing from the receipt-line STAMP, and rejects a non-'avco' stamp", async () => {
    const { skuId, productId } = await makeAvcoSku();
    const { receiptId, receiptLineId } = await receiveBonded({
      productId,
      skuId,
      qty: 6,
      unitCostMinor: 1000,
    });

    // The release reads the receipt-line stamp ('avco'), NOT the live
    // product/category/tenant costing setting — that is the F5 decoupling. (We
    // cannot simulate a product-level flip: the #7 set-once DB trigger blocks
    // changing product.costing_method once stock_ledger movements exist — proven
    // separately. The stamp still matters for category/tenant resolution changes,
    // which the trigger does not guard.) A correctly-stamped release succeeds:
    const ok = await withTenant(db, TENANT, (tx) =>
      executeBondRelease(tx, ctx, {
        bondReceiptId: receiptId,
        destLocationId: storeLocationId,
        lines: [{ bondReceiptLineId: receiptLineId, qty: 2 }],
      })
    );
    expect(ok.release.status).toBe("released");

    // Now corrupt the STAMP itself to 'fifo' and prove release REJECTS it rather
    // than running the AVCO value-only path under a FIFO stamp (the F5 guard).
    await withTenant(db, TENANT, (tx) =>
      tx
        .update(bondReceiptLine)
        .set({ costingMethodApplied: "fifo" })
        .where(eq(bondReceiptLine.id, receiptLineId))
    );
    await expect(
      withTenant(db, TENANT, (tx) =>
        executeBondRelease(tx, ctx, {
          bondReceiptId: receiptId,
          destLocationId: storeLocationId,
          lines: [{ bondReceiptLineId: receiptLineId, qty: 1 }],
        })
      )
    ).rejects.toThrow(RE_AVCO_ONLY);
  });

  it("rejects a release into another company's location (service guard)", async () => {
    const { skuId, productId } = await makeAvcoSku();
    const { receiptId, receiptLineId } = await receiveBonded({
      productId,
      skuId,
      qty: 4,
      unitCostMinor: 1000,
    });

    await expect(
      withTenant(db, TENANT, (tx) =>
        executeBondRelease(tx, ctx, {
          bondReceiptId: receiptId,
          destLocationId: companyBStoreLocationId, // company B
          lines: [{ bondReceiptLineId: receiptLineId, qty: 1 }],
        })
      )
    ).rejects.toThrow(RE_CROSS_COMPANY);
  });

  it("rejects a release into another bonded location (must be sellable)", async () => {
    const { skuId, productId } = await makeAvcoSku();
    const { receiptId, receiptLineId } = await receiveBonded({
      productId,
      skuId,
      qty: 4,
      unitCostMinor: 1000,
    });

    await expect(
      withTenant(db, TENANT, (tx) =>
        executeBondRelease(tx, ctx, {
          bondReceiptId: receiptId,
          destLocationId: bondedLocationId, // still bonded
          lines: [{ bondReceiptLineId: receiptLineId, qty: 1 }],
        })
      )
    ).rejects.toThrow(RE_DEST_BONDED);
  });

  it("F4 (DB): the dest composite FK blocks a cross-company release even via a raw insert that bypasses the service guard", async () => {
    const { skuId, productId } = await makeAvcoSku();
    const { receiptId } = await receiveBonded({
      productId,
      skuId,
      qty: 4,
      unitCostMinor: 1000,
    });

    // Raw bond_release: companyId = A, destLocationId = company B's store. The
    // dest composite FK (tenant, companyA, companyB_store) matches no location
    // row → 23503. Proves the cross-company hole is closed at the DB layer for
    // ANY caller, not just the guarded service.
    let caught: unknown;
    try {
      await withTenant(db, TENANT, (tx) =>
        tx.insert(bondRelease).values({
          tenantId: TENANT,
          companyId, // company A
          number: "BRL-RAW-001",
          bondReceiptId: receiptId,
          sourceLocationId: bondedLocationId,
          destLocationId: companyBStoreLocationId, // company B's store
          status: "pending",
        })
      );
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeDefined();
    const cause = (caught as { cause?: { code?: string; constraint?: string } })
      .cause;
    expect(cause?.code).toBe("23503");
    expect(cause?.constraint).toMatch(RE_DEST_COMPOSITE_FK);
  });

  // ── Codex commit-5 review regressions (F1/F2/F3) ────────────────────────────

  // F1 (HIGH): the F5 stamp is only the GATE; applyValuation re-resolves costing
  // LIVE. A tenant-level flip avco→fifo after receipt (NOT blocked by the #7
  // set-once trigger, which only guards product/sku) would make the gate pass on
  // the 'avco' stamp while valuation resolved 'fifo' → throw or silent
  // zero-value move. The release now re-resolves LIVE and rejects the drift.
  it("F1: rejects a release when the SKU's LIVE costing has drifted to fifo (stamp/valuation consistency)", async () => {
    const { skuId, productId } = await makeAvcoSku();
    const { receiptId, receiptLineId } = await receiveBonded({
      productId, // product.costing_method is NULL → resolves via the tenant
      skuId,
      qty: 5,
      unitCostMinor: 1000,
    });
    // Flip the TENANT costing to fifo (organization has no set-once trigger).
    await db
      .update(organization)
      .set({ costingMethod: "fifo" })
      .where(eq(organization.id, TENANT));
    try {
      await expect(
        withTenant(db, TENANT, (tx) =>
          executeBondRelease(tx, ctx, {
            bondReceiptId: receiptId,
            destLocationId: storeLocationId,
            lines: [{ bondReceiptLineId: receiptLineId, qty: 1 }],
          })
        )
      ).rejects.toThrow(RE_LIVE_DRIFT);
    } finally {
      // Restore so subsequent tests' AVCO resolution is unaffected.
      await db
        .update(organization)
        .set({ costingMethod: "avco" })
        .where(eq(organization.id, TENANT));
    }
  });

  // F2 (HIGH): TOCTOU over-release. Two concurrent releases of the SAME bonded
  // cell, each requesting the full on-hand, must NOT both succeed — the per-cell
  // advisory lock (acquired before the on-hand read) serializes them; the second
  // re-reads the drained balance and rejects. Bonded must never go negative.
  it("F2: serializes concurrent releases of the same bonded cell — only one wins, no over-release", async () => {
    const { skuId, productId } = await makeAvcoSku();
    const { receiptId, receiptLineId } = await receiveBonded({
      productId,
      skuId,
      qty: 5,
      unitCostMinor: 1000,
    });
    const releaseFull = () =>
      withTenant(db, TENANT, (tx) =>
        executeBondRelease(tx, ctx, {
          bondReceiptId: receiptId,
          destLocationId: storeLocationId,
          lines: [{ bondReceiptLineId: receiptLineId, qty: 5 }],
        })
      );
    const results = await Promise.allSettled([releaseFull(), releaseFull()]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    // Bonded cell drained to exactly 0 (released 5 of 5), never negative.
    const bonded = await avgCell(skuId, bondedLocationId);
    expect(bonded?.qtyOnHand).toBe(0);
    expect(bonded?.totalValueMinor).toBe(0);
  });

  // F3 (MEDIUM): two release lines on the SAME SKU must each get their conserved
  // value attributed deterministically (proportional-by-qty), independent of
  // transfer-line row order — and the per-line values must sum to the conserved
  // total.
  it("F3: attributes conserved value per release line deterministically for duplicate-SKU lines", async () => {
    const { skuId, productId } = await makeAvcoSku();
    const { receiptId, receiptLineId } = await receiveBonded({
      productId,
      skuId,
      qty: 10,
      unitCostMinor: 1500, // bonded value 15000; avg 1500/unit
    });
    const result = await withTenant(db, TENANT, (tx) =>
      executeBondRelease(tx, ctx, {
        bondReceiptId: receiptId,
        destLocationId: storeLocationId,
        // Two lines, SAME SKU/receipt line, qty 4 then 6 (sum 10 = full bonded).
        lines: [
          { bondReceiptLineId: receiptLineId, qty: 4 },
          { bondReceiptLineId: receiptLineId, qty: 6 },
        ],
      })
    );
    const v0 = result.eventLines[0]?.releasedValueMinor;
    const v1 = result.eventLines[1]?.releasedValueMinor;
    // Proportional by qty: 4/10·15000 = 6000, 6/10·15000 = 9000; sum conserved.
    expect(v0).toBe(6000);
    expect(v1).toBe(9000);
    expect((v0 ?? 0) + (v1 ?? 0)).toBe(15_000);
  });
});
