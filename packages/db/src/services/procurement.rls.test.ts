// @vitest-environment node
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "../schema";
import {
  auditLog,
  avgCost,
  company,
  goodsReceipt,
  goodsReceiptLine,
  landedCostAllocation,
  landedCostPool,
  location,
  organization,
  product,
  purchaseOrder,
  purchaseOrderLine,
  sku,
  stockLedger,
  supplier,
  supplierBill,
  supplierBillLine,
  unitOfMeasure,
  valuationLayer,
} from "../schema";
import { withTenant } from "../tenant";
import {
  createLandedCostPools,
  createPurchaseOrder,
  createSupplier,
  createSupplierBill,
  receivePurchaseOrder,
} from "./procurement";

const url = process.env.RLS_TEST_DATABASE_URL;
const TENANT = "procurement_slice_tenant";
const OTHER_TENANT = "procurement_slice_other_tenant";

function required<T>(value: T | undefined, label: string): T {
  if (value === undefined || value === null) {
    throw new Error(`procurement test expected ${label}`);
  }
  return value;
}

describe.skipIf(!url)("Phase D procurement foundation", () => {
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let companyId: string;
  let productId: string;
  let skuId: string;
  let locationId: string;
  let otherLocationId: string;
  let otherSupplierId: string;

  beforeAll(async () => {
    pool = new Pool({ connectionString: url });
    db = drizzle(pool, { schema });
    await db
      .insert(organization)
      .values([
        { id: TENANT, name: "Procurement Slice Tenant" },
        { id: OTHER_TENANT, name: "Procurement Slice Other Tenant" },
      ])
      .onConflictDoNothing();
    for (const tenant of [TENANT, OTHER_TENANT]) {
      await withTenant(db, tenant, async (tx) => {
        await tx.delete(landedCostAllocation);
        await tx.delete(landedCostPool);
        await tx.delete(supplierBillLine);
        await tx.delete(supplierBill);
        await tx.delete(goodsReceiptLine);
        await tx.delete(valuationLayer);
        await tx.delete(avgCost);
        await tx.delete(goodsReceipt);
        await tx.delete(stockLedger);
        await tx.delete(purchaseOrderLine);
        await tx.delete(purchaseOrder);
        await tx.delete(supplier);
        await tx.delete(sku);
        await tx.delete(product);
        await tx.delete(location);
        await tx.delete(company);
        await tx.delete(unitOfMeasure);
        await tx.delete(auditLog);
      });
    }
    const ids = await withTenant(db, TENANT, async (tx) => {
      const co = required(
        (
          await tx
            .insert(company)
            .values({ tenantId: TENANT, name: "Procurement Co" })
            .returning()
        ).at(0),
        "company"
      );
      const loc = required(
        (
          await tx
            .insert(location)
            .values({
              tenantId: TENANT,
              companyId: co.id,
              name: "Main Receiving",
              type: "warehouse",
            })
            .returning()
        ).at(0),
        "location"
      );
      const uom = required(
        (
          await tx
            .insert(unitOfMeasure)
            .values({ tenantId: TENANT, code: "EA-PROC", name: "Each" })
            .returning()
        ).at(0),
        "uom"
      );
      const prod = required(
        (
          await tx
            .insert(product)
            .values({
              tenantId: TENANT,
              sku: "PROC-PROD",
              name: "Procurement Product",
              baseUomId: uom.id,
              priceMinor: 1000,
              currency: "GYD",
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
              productId: prod.id,
              code: "PROC-SKU",
              baseUomId: uom.id,
            })
            .returning()
        ).at(0),
        "sku"
      );
      return {
        companyId: co.id,
        locationId: loc.id,
        productId: prod.id,
        skuId: s.id,
      };
    });
    companyId = ids.companyId;
    locationId = ids.locationId;
    productId = ids.productId;
    skuId = ids.skuId;
    const otherIds = await withTenant(db, OTHER_TENANT, async (tx) => {
      const co = required(
        (
          await tx
            .insert(company)
            .values({ tenantId: OTHER_TENANT, name: "Other Procurement Co" })
            .returning()
        ).at(0),
        "other company"
      );
      const loc = required(
        (
          await tx
            .insert(location)
            .values({
              tenantId: OTHER_TENANT,
              companyId: co.id,
              name: "Other Receiving",
              type: "warehouse",
            })
            .returning()
        ).at(0),
        "other location"
      );
      const vendor = await createSupplier(
        tx,
        { tenantId: OTHER_TENANT },
        { code: "OTHER", name: "Other Supplier" }
      );
      return { locationId: loc.id, supplierId: vendor.id };
    });
    otherLocationId = otherIds.locationId;
    otherSupplierId = otherIds.supplierId;
  });

  afterAll(async () => {
    await pool.end();
  });

  it("creates suppliers and purchase orders with audited mutations", async () => {
    await withTenant(db, TENANT, async (tx) => {
      const vendor = await createSupplier(
        tx,
        { tenantId: TENANT },
        {
          code: "SUP-001",
          name: "Acme Supplies",
          email: "orders@example.test",
        }
      );
      const po = await createPurchaseOrder(
        tx,
        { tenantId: TENANT },
        {
          companyId,
          supplierId: vendor.id,
          number: "PO-001",
          currency: "GYD",
          lines: [
            {
              productId,
              skuId,
              qtyOrdered: 12,
              unitCostMinor: 250,
              currency: "GYD",
            },
          ],
        }
      );
      expect(po.lines).toHaveLength(1);
      expect(po.lines[0]?.qtyOrdered).toBe(12);
      const audits = await tx.select().from(auditLog);
      expect(audits.map((row) => row.action)).toEqual(
        expect.arrayContaining([
          "procurement.supplier.create",
          "procurement.purchase_order.create",
        ])
      );
    });
  });

  it("rejects cross-tenant supplier references before insert", async () => {
    await withTenant(db, TENANT, async (tx) => {
      await expect(
        createPurchaseOrder(
          tx,
          { tenantId: TENANT },
          {
            companyId,
            supplierId: otherSupplierId,
            number: "PO-CROSS",
            currency: "GYD",
            lines: [
              {
                productId,
                skuId,
                qtyOrdered: 1,
                unitCostMinor: 100,
                currency: "GYD",
              },
            ],
          }
        )
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });

  it("receives purchase-order goods into stock and updates receipt status", async () => {
    await withTenant(db, TENANT, async (tx) => {
      const vendor = await createSupplier(
        tx,
        { tenantId: TENANT },
        { code: "SUP-GRN", name: "GRN Supplier" }
      );
      const po = await createPurchaseOrder(
        tx,
        { tenantId: TENANT },
        {
          companyId,
          supplierId: vendor.id,
          number: "PO-GRN",
          currency: "GYD",
          lines: [
            {
              productId,
              skuId,
              qtyOrdered: 12,
              unitCostMinor: 250,
              currency: "GYD",
            },
          ],
        }
      );

      const receipt = await receivePurchaseOrder(
        tx,
        { tenantId: TENANT },
        {
          purchaseOrderId: po.id,
          locationId,
          number: "GRN-001",
          lines: [
            {
              purchaseOrderLineId: required(po.lines[0], "po line").id,
              qtyReceived: 5,
            },
          ],
        }
      );

      expect(receipt.receipt.number).toBe("GRN-001");
      expect(receipt.lines).toHaveLength(1);
      const updatedLine = required(
        (
          await tx
            .select()
            .from(purchaseOrderLine)
            .where(
              eq(purchaseOrderLine.id, required(po.lines[0], "po line").id)
            )
        ).at(0),
        "updated purchase order line"
      );
      expect(updatedLine.qtyReceived).toBe(5);
      const updatedPo = required(
        (
          await tx
            .select()
            .from(purchaseOrder)
            .where(eq(purchaseOrder.id, po.id))
        ).at(0),
        "updated purchase order"
      );
      expect(updatedPo.status).toBe("partially_received");
      const movements = await tx
        .select()
        .from(stockLedger)
        .where(eq(stockLedger.refId, receipt.receipt.id));
      expect(movements).toHaveLength(1);
      expect(movements[0]?.movementType).toBe("receipt");
      expect(movements[0]?.qtyDelta).toBe(5);
      const audits = await tx.select().from(auditLog);
      expect(audits.map((row) => row.action)).toContain(
        "procurement.goods_receipt.create"
      );
    });
  });

  it("marks a purchase order received and rejects over-receipts", async () => {
    await withTenant(db, TENANT, async (tx) => {
      const vendor = await createSupplier(
        tx,
        { tenantId: TENANT },
        { code: "SUP-FULL", name: "Full Receipt Supplier" }
      );
      const po = await createPurchaseOrder(
        tx,
        { tenantId: TENANT },
        {
          companyId,
          supplierId: vendor.id,
          number: "PO-FULL",
          currency: "GYD",
          lines: [{ productId, skuId, qtyOrdered: 3, unitCostMinor: 400 }],
        }
      );
      await receivePurchaseOrder(
        tx,
        { tenantId: TENANT },
        {
          purchaseOrderId: po.id,
          locationId,
          number: "GRN-FULL",
          lines: [
            {
              purchaseOrderLineId: required(po.lines[0], "po line").id,
              qtyReceived: 3,
            },
          ],
        }
      );
      const updatedPo = required(
        (
          await tx
            .select()
            .from(purchaseOrder)
            .where(eq(purchaseOrder.id, po.id))
        ).at(0),
        "updated purchase order"
      );
      expect(updatedPo.status).toBe("received");
      await expect(
        receivePurchaseOrder(
          tx,
          { tenantId: TENANT },
          {
            purchaseOrderId: po.id,
            locationId,
            number: "GRN-OVER",
            lines: [
              {
                purchaseOrderLineId: required(po.lines[0], "po line").id,
                qtyReceived: 1,
              },
            ],
          }
        )
      ).rejects.toMatchObject({ code: "INVALID_STATE" });
    });
  });

  it("rejects goods receipts into a cross-tenant location", async () => {
    await withTenant(db, TENANT, async (tx) => {
      const vendor = await createSupplier(
        tx,
        { tenantId: TENANT },
        { code: "SUP-CROSS-GRN", name: "Cross GRN Supplier" }
      );
      const po = await createPurchaseOrder(
        tx,
        { tenantId: TENANT },
        {
          companyId,
          supplierId: vendor.id,
          number: "PO-CROSS-GRN",
          currency: "GYD",
          lines: [{ productId, skuId, qtyOrdered: 1, unitCostMinor: 100 }],
        }
      );
      await expect(
        receivePurchaseOrder(
          tx,
          { tenantId: TENANT },
          {
            purchaseOrderId: po.id,
            locationId: otherLocationId,
            number: "GRN-CROSS",
            lines: [
              {
                purchaseOrderLineId: required(po.lines[0], "po line").id,
                qtyReceived: 1,
              },
            ],
          }
        )
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });

  it("creates supplier bills from received goods and rejects over-billing", async () => {
    await withTenant(db, TENANT, async (tx) => {
      const vendor = await createSupplier(
        tx,
        { tenantId: TENANT },
        { code: "SUP-BILL", name: "Bill Supplier" }
      );
      const po = await createPurchaseOrder(
        tx,
        { tenantId: TENANT },
        {
          companyId,
          supplierId: vendor.id,
          number: "PO-BILL",
          currency: "GYD",
          lines: [{ productId, skuId, qtyOrdered: 6, unitCostMinor: 175 }],
        }
      );
      const receipt = await receivePurchaseOrder(
        tx,
        { tenantId: TENANT },
        {
          purchaseOrderId: po.id,
          locationId,
          number: "GRN-BILL",
          lines: [
            {
              purchaseOrderLineId: required(po.lines[0], "po line").id,
              qtyReceived: 4,
            },
          ],
        }
      );

      const bill = await createSupplierBill(
        tx,
        { tenantId: TENANT },
        {
          purchaseOrderId: po.id,
          number: "BILL-001",
          lines: [
            {
              goodsReceiptLineId: required(receipt.lines[0], "receipt line").id,
              qtyBilled: 4,
            },
          ],
        }
      );

      expect(bill.bill.totalMinor).toBe(700);
      expect(bill.lines).toHaveLength(1);
      expect(bill.lines[0]?.lineTotalMinor).toBe(700);
      const audits = await tx.select().from(auditLog);
      expect(audits.map((row) => row.action)).toContain(
        "procurement.supplier_bill.create"
      );
      await expect(
        createSupplierBill(
          tx,
          { tenantId: TENANT },
          {
            purchaseOrderId: po.id,
            number: "BILL-OVER",
            lines: [
              {
                goodsReceiptLineId: required(receipt.lines[0], "receipt line")
                  .id,
                qtyBilled: 1,
              },
            ],
          }
        )
      ).rejects.toMatchObject({ code: "INVALID_STATE" });
    });
  });

  it("rejects supplier bills against cross-tenant receipt lines", async () => {
    await withTenant(db, TENANT, async (tx) => {
      const vendor = await createSupplier(
        tx,
        { tenantId: TENANT },
        { code: "SUP-BILL-CROSS", name: "Bill Cross Supplier" }
      );
      const po = await createPurchaseOrder(
        tx,
        { tenantId: TENANT },
        {
          companyId,
          supplierId: vendor.id,
          number: "PO-BILL-CROSS",
          currency: "GYD",
          lines: [{ productId, skuId, qtyOrdered: 1, unitCostMinor: 100 }],
        }
      );
      await expect(
        createSupplierBill(
          tx,
          { tenantId: TENANT },
          {
            purchaseOrderId: po.id,
            number: "BILL-CROSS",
            lines: [{ goodsReceiptLineId: otherLocationId, qtyBilled: 1 }],
          }
        )
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });

  it("creates landed cost pools with exact largest-remainder allocations and valuation adjustments", async () => {
    await withTenant(db, TENANT, async (tx) => {
      const beforeAvg = (
        await tx.select().from(avgCost).where(eq(avgCost.skuId, skuId))
      ).at(0);
      const beforeValueMinor = beforeAvg?.totalValueMinor ?? 0;
      const beforeQty = beforeAvg?.qtyOnHand ?? 0;
      const vendor = await createSupplier(
        tx,
        { tenantId: TENANT },
        { code: "SUP-LC", name: "Landed Cost Supplier" }
      );
      const po = await createPurchaseOrder(
        tx,
        { tenantId: TENANT },
        {
          companyId,
          supplierId: vendor.id,
          number: "PO-LC",
          currency: "GYD",
          lines: [
            { productId, skuId, qtyOrdered: 3, unitCostMinor: 101 },
            { productId, skuId, qtyOrdered: 2, unitCostMinor: 101 },
          ],
        }
      );
      const receipt = await receivePurchaseOrder(
        tx,
        { tenantId: TENANT },
        {
          purchaseOrderId: po.id,
          locationId,
          number: "GRN-LC",
          lines: [
            {
              purchaseOrderLineId: required(po.lines[0], "first po line").id,
              qtyReceived: 3,
            },
            {
              purchaseOrderLineId: required(po.lines[1], "second po line").id,
              qtyReceived: 2,
            },
          ],
        }
      );
      const bill = await createSupplierBill(
        tx,
        { tenantId: TENANT },
        {
          purchaseOrderId: po.id,
          number: "BILL-LC",
          lines: receipt.lines.map((line) => ({
            goodsReceiptLineId: line.id,
            qtyBilled: line.qtyReceived,
          })),
        }
      );

      const result = await createLandedCostPools(
        tx,
        { tenantId: TENANT },
        {
          supplierBillId: bill.bill.id,
          pools: [{ kind: "freight", basis: "quantity", amountMinor: 10 }],
        }
      );

      expect(result.pools).toHaveLength(1);
      expect(result.allocations.map((row) => row.amountMinor)).toEqual([6, 4]);
      const movements = await tx
        .select()
        .from(stockLedger)
        .where(eq(stockLedger.refId, required(result.pools[0], "pool").id));
      expect(movements.map((row) => row.movementType)).toEqual([
        "valuation_adjustment",
        "valuation_adjustment",
      ]);
      expect(movements.map((row) => row.qtyDelta)).toEqual([0, 0]);
      expect(movements.map((row) => row.valueDeltaMinor)).toEqual([6, 4]);
      const avg = required(
        (await tx.select().from(avgCost).where(eq(avgCost.skuId, skuId))).at(0),
        "avg cost"
      );
      expect(avg.totalValueMinor).toBe(beforeValueMinor + 515);
      expect(avg.qtyOnHand).toBe(beforeQty + 5);
    });
  });

  it("allocates each landed cost pool independently", async () => {
    await withTenant(db, TENANT, async (tx) => {
      const vendor = await createSupplier(
        tx,
        { tenantId: TENANT },
        { code: "SUP-LC-TINY", name: "Tiny Pool Supplier" }
      );
      const po = await createPurchaseOrder(
        tx,
        { tenantId: TENANT },
        {
          companyId,
          supplierId: vendor.id,
          number: "PO-LC-TINY",
          currency: "GYD",
          lines: [
            { productId, skuId, qtyOrdered: 1, unitCostMinor: 100 },
            { productId, skuId, qtyOrdered: 1, unitCostMinor: 100 },
            { productId, skuId, qtyOrdered: 1, unitCostMinor: 100 },
          ],
        }
      );
      const receipt = await receivePurchaseOrder(
        tx,
        { tenantId: TENANT },
        {
          purchaseOrderId: po.id,
          locationId,
          number: "GRN-LC-TINY",
          lines: po.lines.map((line) => ({
            purchaseOrderLineId: line.id,
            qtyReceived: 1,
          })),
        }
      );
      const bill = await createSupplierBill(
        tx,
        { tenantId: TENANT },
        {
          purchaseOrderId: po.id,
          number: "BILL-LC-TINY",
          lines: receipt.lines.map((line) => ({
            goodsReceiptLineId: line.id,
            qtyBilled: 1,
          })),
        }
      );

      const result = await createLandedCostPools(
        tx,
        { tenantId: TENANT },
        {
          supplierBillId: bill.bill.id,
          pools: [
            { kind: "duty", basis: "quantity", amountMinor: 1 },
            { kind: "handling", basis: "quantity", amountMinor: 1 },
          ],
        }
      );

      expect(result.pools).toHaveLength(2);
      for (const pool of result.pools) {
        const allocations = result.allocations.filter(
          (allocation) => allocation.landedCostPoolId === pool.id
        );
        expect(allocations.reduce((sum, row) => sum + row.amountMinor, 0)).toBe(
          1
        );
        expect(allocations.map((row) => row.amountMinor)).toEqual([1, 0, 0]);
      }
    });
  });

  it("rejects cross-tenant landed cost supplier bills", async () => {
    let supplierBillId = "";
    await withTenant(db, TENANT, async (tx) => {
      const vendor = await createSupplier(
        tx,
        { tenantId: TENANT },
        { code: "SUP-LC-CROSS", name: "Cross LC Supplier" }
      );
      const po = await createPurchaseOrder(
        tx,
        { tenantId: TENANT },
        {
          companyId,
          supplierId: vendor.id,
          number: "PO-LC-CROSS",
          currency: "GYD",
          lines: [{ productId, skuId, qtyOrdered: 1, unitCostMinor: 100 }],
        }
      );
      const receipt = await receivePurchaseOrder(
        tx,
        { tenantId: TENANT },
        {
          purchaseOrderId: po.id,
          locationId,
          number: "GRN-LC-CROSS",
          lines: [
            {
              purchaseOrderLineId: required(po.lines[0], "po line").id,
              qtyReceived: 1,
            },
          ],
        }
      );
      const bill = await createSupplierBill(
        tx,
        { tenantId: TENANT },
        {
          purchaseOrderId: po.id,
          number: "BILL-LC-CROSS",
          lines: [
            {
              goodsReceiptLineId: required(receipt.lines[0], "receipt line").id,
              qtyBilled: 1,
            },
          ],
        }
      );
      supplierBillId = bill.bill.id;
    });
    await withTenant(db, OTHER_TENANT, async (tx) => {
      await expect(
        createLandedCostPools(
          tx,
          { tenantId: OTHER_TENANT },
          {
            supplierBillId,
            pools: [{ kind: "freight", basis: "quantity", amountMinor: 1 }],
          }
        )
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });

  it("rejects unsupported FIFO landed cost valuation adjustments", async () => {
    await withTenant(db, TENANT, async (tx) => {
      const uom = required(
        (
          await tx
            .select()
            .from(unitOfMeasure)
            .where(eq(unitOfMeasure.code, "EA-PROC"))
        ).at(0),
        "uom"
      );
      const fifoProduct = required(
        (
          await tx
            .insert(product)
            .values({
              tenantId: TENANT,
              sku: "PROC-FIFO-LC",
              name: "FIFO Landed Cost Product",
              baseUomId: uom.id,
              priceMinor: 1000,
              currency: "GYD",
              costingMethod: "fifo",
            })
            .returning()
        ).at(0),
        "fifo product"
      );
      const fifoSku = required(
        (
          await tx
            .insert(sku)
            .values({
              tenantId: TENANT,
              productId: fifoProduct.id,
              code: "PROC-FIFO-LC-SKU",
              baseUomId: uom.id,
            })
            .returning()
        ).at(0),
        "fifo sku"
      );
      const vendor = await createSupplier(
        tx,
        { tenantId: TENANT },
        { code: "SUP-LC-FIFO", name: "FIFO LC Supplier" }
      );
      const po = await createPurchaseOrder(
        tx,
        { tenantId: TENANT },
        {
          companyId,
          supplierId: vendor.id,
          number: "PO-LC-FIFO",
          currency: "GYD",
          lines: [
            {
              productId: fifoProduct.id,
              skuId: fifoSku.id,
              qtyOrdered: 1,
              unitCostMinor: 100,
            },
          ],
        }
      );
      const receipt = await receivePurchaseOrder(
        tx,
        { tenantId: TENANT },
        {
          purchaseOrderId: po.id,
          locationId,
          number: "GRN-LC-FIFO",
          lines: [
            {
              purchaseOrderLineId: required(po.lines[0], "po line").id,
              qtyReceived: 1,
            },
          ],
        }
      );
      const bill = await createSupplierBill(
        tx,
        { tenantId: TENANT },
        {
          purchaseOrderId: po.id,
          number: "BILL-LC-FIFO",
          lines: [
            {
              goodsReceiptLineId: required(receipt.lines[0], "receipt line").id,
              qtyBilled: 1,
            },
          ],
        }
      );
      await expect(
        createLandedCostPools(
          tx,
          { tenantId: TENANT },
          {
            supplierBillId: bill.bill.id,
            pools: [{ kind: "freight", basis: "quantity", amountMinor: 1 }],
          }
        )
      ).rejects.toMatchObject({ code: "INVALID_STATE" });
    });
  });

  it("rejects zero line-value landed cost allocation basis", async () => {
    await withTenant(db, TENANT, async (tx) => {
      const vendor = await createSupplier(
        tx,
        { tenantId: TENANT },
        { code: "SUP-LC-ZERO", name: "Zero Basis LC Supplier" }
      );
      const po = await createPurchaseOrder(
        tx,
        { tenantId: TENANT },
        {
          companyId,
          supplierId: vendor.id,
          number: "PO-LC-ZERO",
          currency: "GYD",
          lines: [{ productId, skuId, qtyOrdered: 1, unitCostMinor: 0 }],
        }
      );
      const receipt = await receivePurchaseOrder(
        tx,
        { tenantId: TENANT },
        {
          purchaseOrderId: po.id,
          locationId,
          number: "GRN-LC-ZERO",
          lines: [
            {
              purchaseOrderLineId: required(po.lines[0], "po line").id,
              qtyReceived: 1,
            },
          ],
        }
      );
      const bill = await createSupplierBill(
        tx,
        { tenantId: TENANT },
        {
          purchaseOrderId: po.id,
          number: "BILL-LC-ZERO",
          lines: [
            {
              goodsReceiptLineId: required(receipt.lines[0], "receipt line").id,
              qtyBilled: 1,
            },
          ],
        }
      );
      await expect(
        createLandedCostPools(
          tx,
          { tenantId: TENANT },
          {
            supplierBillId: bill.bill.id,
            pools: [{ kind: "freight", basis: "line_value", amountMinor: 1 }],
          }
        )
      ).rejects.toMatchObject({ code: "INVALID_STATE" });
    });
  });

  it("keeps suppliers tenant-isolated under RLS", async () => {
    await withTenant(db, OTHER_TENANT, async (tx) => {
      const rows = await tx
        .select()
        .from(supplier)
        .where(eq(supplier.code, "SUP-001"));
      expect(rows).toHaveLength(0);
    });
  });
});
