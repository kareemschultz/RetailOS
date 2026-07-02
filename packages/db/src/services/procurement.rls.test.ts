// @vitest-environment node
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "../schema";
import {
  auditLog,
  company,
  organization,
  product,
  purchaseOrder,
  purchaseOrderLine,
  sku,
  supplier,
  unitOfMeasure,
} from "../schema";
import { withTenant } from "../tenant";
import { createPurchaseOrder, createSupplier } from "./procurement";

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
        await tx.delete(purchaseOrderLine);
        await tx.delete(purchaseOrder);
        await tx.delete(supplier);
        await tx.delete(sku);
        await tx.delete(product);
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
      return { companyId: co.id, productId: prod.id, skuId: s.id };
    });
    companyId = ids.companyId;
    productId = ids.productId;
    skuId = ids.skuId;
    otherSupplierId = await withTenant(db, OTHER_TENANT, async (tx) => {
      const row = await createSupplier(
        tx,
        { tenantId: OTHER_TENANT },
        { code: "OTHER", name: "Other Supplier" }
      );
      return row.id;
    });
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
