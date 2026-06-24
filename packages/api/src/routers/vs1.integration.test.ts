// @vitest-environment node
// Node env (not happy-dom): @t3-oss/env-core blocks server env vars when a
// `window` global is present, which happy-dom provides.
import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Context } from "../context";

// Full §32 flow exercised through the oRPC routers against a real Postgres
// reached as retailos_app. Skipped unless RLS_TEST_DATABASE_URL is set; the
// env-bound modules (auth/db) are imported lazily inside beforeAll so the default
// `bun run test` (no DB, no auth env) neither runs NOR loads this suite.
const url = process.env.RLS_TEST_DATABASE_URL;
const ORG = "org_e2e";
const ADMIN = "u_admin_e2e";
const CASHIER = "u_cashier_e2e";
// A second tenant, for the cross-tenant FK-bypass regression test.
const ORG_B = "org_e2e_b";
const ADMIN_B = "u_admin_e2e_b";

function makeCtx(userId: string, organizationId: string | null): Context {
  return {
    auth: null,
    session: {
      user: { id: userId },
      session: { id: `sess_${userId}`, activeOrganizationId: organizationId },
    },
    meta: {
      requestId: "req",
      correlationId: "corr",
      source: "test",
      deploymentMode: "saas",
    },
    headers: new Headers(),
  } as unknown as Context;
}

describe.skipIf(!url)("VS#1 §32 flow end-to-end (routers)", () => {
  let call: typeof import("@orpc/server")["call"];
  let appRouter: typeof import("./index")["appRouter"];
  let db: typeof import("@RetailOS/db")["db"];
  let schema: typeof import("@RetailOS/db")["schema"];
  let services: typeof import("@RetailOS/db")["services"];
  let withTenant: typeof import("@RetailOS/db")["withTenant"];

  beforeAll(async () => {
    ({ call } = await import("@orpc/server"));
    ({ appRouter } = await import("./index"));
    const dbmod = await import("@RetailOS/db");
    db = dbmod.db;
    schema = dbmod.schema;
    services = dbmod.services;
    withTenant = dbmod.withTenant;

    // Clean both tenants (hermetic). FK-safe order; RLS scopes the deletes.
    const cleanTenant = (tenant: string) =>
      withTenant(db, tenant, async (tx) => {
        await tx.delete(schema.idempotencyKey);
        await tx.delete(schema.outboxEvent);
        await tx.delete(schema.auditLog);
        // Bond release/receipt FIRST — they reference transfers, ledger rows,
        // locations, companies, products, SKUs and lots (FK-safe order).
        await tx.delete(schema.bondReleaseLine);
        await tx.delete(schema.bondRelease);
        await tx.delete(schema.bondReceiptLine);
        await tx.delete(schema.bondReceipt);
        await tx.delete(schema.tender);
        await tx.delete(schema.saleLine);
        await tx.delete(schema.invoice);
        await tx.delete(schema.sale);
        await tx.delete(schema.stockCountLine);
        await tx.delete(schema.stockCount);
        await tx.delete(schema.avgCost);
        await tx.delete(schema.valuationLayer);
        await tx.delete(schema.stockTransferLine);
        await tx.delete(schema.stockTransfer);
        await tx.delete(schema.stockLedger);
        await tx.delete(schema.reorderRule);
        await tx.delete(schema.bomLine);
        await tx.delete(schema.bom);
        await tx.delete(schema.bundle);
        await tx.delete(schema.serial);
        await tx.delete(schema.lot);
        await tx.delete(schema.barcode);
        await tx.delete(schema.uomConversion);
        await tx.delete(schema.sku);
        await tx.delete(schema.variant);
        await tx.delete(schema.membership);
        await tx.delete(schema.product);
        await tx.delete(schema.category);
        await tx.delete(schema.brand);
        await tx.delete(schema.unitOfMeasure);
        await tx.delete(schema.location);
        await tx.delete(schema.company);
      });
    await cleanTenant(ORG);
    await cleanTenant(ORG_B);
    // Identity tables are not RLS-scoped (managed by Better Auth) — upsert.
    await db
      .insert(schema.user)
      .values([
        { id: ADMIN, name: "Admin", email: "admin_e2e@example.com" },
        { id: CASHIER, name: "Cashier", email: "cashier_e2e@example.com" },
        { id: ADMIN_B, name: "Admin B", email: "admin_e2e_b@example.com" },
      ])
      .onConflictDoNothing();
    await db
      .insert(schema.organization)
      .values([
        { id: ORG, name: "E2E Tenant" },
        { id: ORG_B, name: "E2E Tenant B" },
      ])
      .onConflictDoNothing();
    await withTenant(db, ORG, (tx) =>
      tx.insert(schema.membership).values([
        { tenantId: ORG, userId: ADMIN, role: "tenant_admin" },
        { tenantId: ORG, userId: CASHIER, role: "cashier" },
      ])
    );
    await withTenant(db, ORG_B, (tx) =>
      tx
        .insert(schema.membership)
        .values([{ tenantId: ORG_B, userId: ADMIN_B, role: "tenant_admin" }])
    );
  });

  afterAll(async () => {
    await db?.$client?.end?.();
  });

  it("runs Org→Company→Location→Product→Receipt→Sale→Invoice→Report, idempotently", async () => {
    const admin = { context: makeCtx(ADMIN, ORG) };
    const company = await call(appRouter.company.create, { name: "Co" }, admin);
    const location = await call(
      appRouter.location.create,
      { companyId: company.id, name: "Store", type: "store" },
      admin
    );
    const product = await call(
      appRouter.product.create,
      { sku: "P1", name: "Prod", priceMinor: 1000, currency: "USD" },
      admin
    );
    // skuId is required on every sale line (#8): give P1 a sku and key the
    // receipt + sale to it so valuation has a cell.
    const p1Sku = await call(
      appRouter.catalog.skuCreate,
      { code: "P1-EA", productId: product.id },
      admin
    );
    await call(
      appRouter.inventory.receive,
      {
        costCurrency: "USD",
        costScale: 2,
        locationId: location.id,
        productId: product.id,
        qty: 10,
        skuId: p1Sku.id,
        unitCostMinor: 500,
      },
      admin
    );

    const sale1 = await call(
      appRouter.pos.createSale,
      {
        locationId: location.id,
        idempotencyKey: "e2e-key",
        lines: [{ productId: product.id, qty: 3, skuId: p1Sku.id }],
        tenders: [{ method: "cash", currency: "USD", amountMinor: 3000 }],
      },
      admin
    );
    expect(sale1.totalMinor).toBe(3000);

    // Idempotent replay: same key ⇒ the same sale, one ledger effect.
    const sale2 = await call(
      appRouter.pos.createSale,
      {
        locationId: location.id,
        idempotencyKey: "e2e-key",
        lines: [{ productId: product.id, qty: 3, skuId: p1Sku.id }],
        tenders: [{ method: "cash", currency: "USD", amountMinor: 3000 }],
      },
      admin
    );
    expect(sale2.saleId).toBe(sale1.saleId);

    // Stock on hand from the ledger: 10 received − 3 sold = 7 (one deduction).
    const onHand = await withTenant(db, ORG, (tx) =>
      services.stockOnHand(tx, location.id, product.id)
    );
    expect(onHand).toBe(7);

    // Basic sales report totals match the committed sale.
    const report = await call(appRouter.reports.salesBasic, {}, admin);
    const usd = report.byCurrency.find((c) => c.currency === "USD");
    expect(usd?.saleCount).toBe(1);
    expect(usd?.totalMinor).toBe(3000);
  });

  it("enforces permissions — a cashier cannot create products", async () => {
    const cashier = { context: makeCtx(CASHIER, ORG) };
    await expect(
      call(
        appRouter.product.create,
        { sku: "X", name: "X", priceMinor: 1, currency: "USD" },
        cashier
      )
    ).rejects.toThrow();
  });

  it("blocks cross-tenant FK references (Postgres FK checks bypass RLS)", async () => {
    // Postgres FK existence checks ignore RLS, so a tenant-scoped insert that
    // references ANOTHER tenant's row would otherwise create a cross-tenant
    // dangling reference. The routers guard this with an RLS-scoped existence
    // read before insert; this proves it.
    const admin = { context: makeCtx(ADMIN, ORG) };
    const adminB = { context: makeCtx(ADMIN_B, ORG_B) };

    // Tenant B owns a company + location.
    const companyB = await call(
      appRouter.company.create,
      { name: "Co B" },
      adminB
    );
    const locationB = await call(
      appRouter.location.create,
      { companyId: companyB.id, name: "Store B", type: "store" },
      adminB
    );

    // Tenant A must NOT be able to attach a location to Tenant B's company.
    await expect(
      call(
        appRouter.location.create,
        { companyId: companyB.id, name: "Hijack", type: "store" },
        admin
      )
    ).rejects.toThrow();

    // Nor receive stock against Tenant B's location (cross-tenant locationId).
    const productA = await call(
      appRouter.product.create,
      { sku: "FK-A", name: "FK Prod A", priceMinor: 100, currency: "USD" },
      admin
    );
    await expect(
      call(
        appRouter.inventory.receive,
        { locationId: locationB.id, productId: productA.id, qty: 1 },
        admin
      )
    ).rejects.toThrow();
  });

  it("blocks cross-tenant catalog references in SKU and UoM conversion routes", async () => {
    const admin = { context: makeCtx(ADMIN, ORG) };
    const adminB = { context: makeCtx(ADMIN_B, ORG_B) };

    const productA = await call(
      appRouter.product.create,
      {
        currency: "USD",
        name: "Catalog Product A",
        priceMinor: 100,
        sku: "CAT-A",
      },
      admin
    );
    const productB = await call(
      appRouter.product.create,
      {
        currency: "USD",
        name: "Catalog Product B",
        priceMinor: 100,
        sku: "CAT-B",
      },
      adminB
    );
    const categoryB = await call(
      appRouter.catalog.categoryCreate,
      { name: "Tenant B Category" },
      adminB
    );
    const uomA = await call(
      appRouter.catalog.uomCreate,
      { code: "EA-A", name: "Each A" },
      admin
    );
    const cartonA = await call(
      appRouter.catalog.uomCreate,
      { code: "CTN-A", name: "Carton A" },
      admin
    );
    const uomB = await call(
      appRouter.catalog.uomCreate,
      { code: "EA-B", name: "Each B" },
      adminB
    );
    const skuA = await call(
      appRouter.catalog.skuCreate,
      { baseUomId: uomA.id, code: "CAT-A-EA", productId: productA.id },
      admin
    );

    await expect(
      call(
        appRouter.catalog.skuCreate,
        { baseUomId: uomA.id, code: "HIJACK", productId: productB.id },
        admin
      )
    ).rejects.toThrow();

    await expect(
      call(
        appRouter.catalog.uomConversionCreate,
        {
          factor: 24,
          fromUomId: cartonA.id,
          role: "purchase",
          toUomId: uomB.id,
        },
        admin
      )
    ).rejects.toThrow();

    await expect(
      call(
        appRouter.catalog.uomConversionCreate,
        {
          categoryId: categoryB.id,
          factor: 24,
          fromUomId: cartonA.id,
          role: "purchase",
          skuId: skuA.id,
          toUomId: uomA.id,
        },
        admin
      )
    ).rejects.toThrow();
  });

  it("routes a mixed AVCO+FIFO catalog through valued receipts and valuation reports", async () => {
    const admin = { context: makeCtx(ADMIN, ORG) };

    const company = await call(
      appRouter.company.create,
      { name: "Mixed Catalog Co" },
      admin
    );
    const location = await call(
      appRouter.location.create,
      { companyId: company.id, name: "Mixed Store", type: "store" },
      admin
    );
    const fifoCategory = await call(
      appRouter.catalog.categoryCreate,
      { costingMethod: "fifo", name: "Mixed Pharmacy" },
      admin
    );
    const each = await call(
      appRouter.catalog.uomCreate,
      { code: "MIX-EA", name: "Mixed Each" },
      admin
    );
    const carton = await call(
      appRouter.catalog.uomCreate,
      { code: "MIX-CTN", name: "Mixed Carton" },
      admin
    );
    const avcoProduct = await call(
      appRouter.product.create,
      {
        baseUomId: each.id,
        currency: "USD",
        name: "Mixed Grocery AVCO",
        priceMinor: 100,
        sku: "MIX-AVCO",
      },
      admin
    );
    const fifoProduct = await call(
      appRouter.product.create,
      {
        baseUomId: each.id,
        categoryId: fifoCategory.id,
        currency: "USD",
        name: "Mixed Pharmacy FIFO",
        priceMinor: 100,
        sku: "MIX-FIFO",
      },
      admin
    );
    const avcoSku = await call(
      appRouter.catalog.skuCreate,
      { baseUomId: each.id, code: "MIX-AVCO-EA", productId: avcoProduct.id },
      admin
    );
    const fifoSku = await call(
      appRouter.catalog.skuCreate,
      { baseUomId: each.id, code: "MIX-FIFO-EA", productId: fifoProduct.id },
      admin
    );
    const barcode = await call(
      appRouter.catalog.barcodeCreate,
      { skuId: avcoSku.id, value: "0000000000001" },
      admin
    );
    const conversion = await call(
      appRouter.catalog.uomConversionCreate,
      {
        factor: 12,
        fromUomId: carton.id,
        role: "purchase",
        skuId: avcoSku.id,
        toUomId: each.id,
      },
      admin
    );

    const fifoProducts = await call(
      appRouter.product.list,
      { categoryId: fifoCategory.id },
      admin
    );
    const categories = await call(appRouter.catalog.categoryList, {}, admin);
    const skus = await call(
      appRouter.catalog.skuList,
      { productId: avcoProduct.id },
      admin
    );
    const barcodes = await call(
      appRouter.catalog.barcodeList,
      { skuId: avcoSku.id },
      admin
    );
    const conversions = await call(
      appRouter.catalog.uomConversionList,
      { skuId: avcoSku.id },
      admin
    );
    expect(fifoProducts.map((row) => row.id)).toContain(fifoProduct.id);
    expect(categories.map((row) => row.id)).toContain(fifoCategory.id);
    expect(skus.map((row) => row.id)).toContain(avcoSku.id);
    expect(barcodes.map((row) => row.id)).toContain(barcode.id);
    expect(conversions.map((row) => row.id)).toContain(conversion.id);

    const brand = await call(
      appRouter.catalog.brandCreate,
      { code: "MIX-BRAND", name: "Mixed Brand" },
      admin
    );
    const updatedBrand = await call(
      appRouter.catalog.brandUpdate,
      { id: brand.id, name: "Mixed Brand Updated" },
      admin
    );
    expect(updatedBrand.name).toBe("Mixed Brand Updated");
    const archivedBrand = await call(
      appRouter.catalog.brandArchive,
      { id: brand.id },
      admin
    );
    expect(archivedBrand.deletedAt).toBeTruthy();

    const tempCategory = await call(
      appRouter.catalog.categoryCreate,
      { name: "Temporary Category" },
      admin
    );
    const updatedCategory = await call(
      appRouter.catalog.categoryUpdate,
      { costingMethod: "fifo", id: tempCategory.id },
      admin
    );
    expect(updatedCategory.costingMethod).toBe("fifo");
    const archivedCategory = await call(
      appRouter.catalog.categoryArchive,
      { id: tempCategory.id },
      admin
    );
    expect(archivedCategory.deletedAt).toBeTruthy();

    const tempUom = await call(
      appRouter.catalog.uomCreate,
      { code: "MIX-TEMP", name: "Mixed Temp UoM" },
      admin
    );
    const updatedUom = await call(
      appRouter.catalog.uomUpdate,
      { decimalScale: 1, id: tempUom.id },
      admin
    );
    expect(updatedUom.decimalScale).toBe(1);
    const archivedUom = await call(
      appRouter.catalog.uomArchive,
      { id: tempUom.id },
      admin
    );
    expect(archivedUom.deletedAt).toBeTruthy();

    const updatedSku = await call(
      appRouter.catalog.skuUpdate,
      { id: avcoSku.id, name: "AVCO SKU Updated" },
      admin
    );
    expect(updatedSku.name).toBe("AVCO SKU Updated");
    const archiveSku = await call(
      appRouter.catalog.skuCreate,
      { code: "MIX-SKU-ARCHIVE", productId: avcoProduct.id },
      admin
    );
    const archivedSku = await call(
      appRouter.catalog.skuArchive,
      { id: archiveSku.id },
      admin
    );
    expect(archivedSku.deletedAt).toBeTruthy();

    const updatedBarcode = await call(
      appRouter.catalog.barcodeUpdate,
      { id: barcode.id, isPrimary: true },
      admin
    );
    expect(updatedBarcode.isPrimary).toBe(true);
    const archivedBarcode = await call(
      appRouter.catalog.barcodeArchive,
      { id: barcode.id },
      admin
    );
    expect(archivedBarcode.deletedAt).toBeTruthy();

    const updatedConversion = await call(
      appRouter.catalog.uomConversionUpdate,
      { factor: 24, id: conversion.id },
      admin
    );
    expect(updatedConversion.factor).toBe(24);
    const archivedConversion = await call(
      appRouter.catalog.uomConversionArchive,
      { id: conversion.id },
      admin
    );
    expect(archivedConversion.deletedAt).toBeTruthy();
    const importPreview = await call(
      appRouter.catalog.importPreview,
      {
        rows: [
          {
            baseUomCode: "MIX-EA",
            currency: "USD",
            priceMinor: 100,
            productName: "Existing Product",
            productSku: avcoProduct.sku,
            rowNumber: 1,
            skuCode: "IMPORT-EXISTING",
          },
          {
            baseUomCode: "MIX-EA",
            currency: "USD",
            priceMinor: 100,
            productName: "Import Product",
            productSku: "IMPORT-NEW",
            rowNumber: 2,
            skuCode: "IMPORT-NEW-EA",
          },
        ],
      },
      admin
    );
    expect(importPreview.errorCount).toBe(1);
    expect(importPreview.validCount).toBe(1);

    const updatedProduct = await call(
      appRouter.product.update,
      { id: avcoProduct.id, name: "Mixed Grocery AVCO Updated" },
      admin
    );
    expect(updatedProduct.name).toBe("Mixed Grocery AVCO Updated");
    const archiveProduct = await call(
      appRouter.product.create,
      {
        baseUomId: each.id,
        currency: "USD",
        name: "Archive Product",
        priceMinor: 100,
        sku: "MIX-ARCHIVE",
      },
      admin
    );
    const archivedProduct = await call(
      appRouter.product.archive,
      { id: archiveProduct.id },
      admin
    );
    expect(archivedProduct.deletedAt).toBeTruthy();

    const variant = await call(
      appRouter.catalog.variantCreate,
      {
        name: "Pack",
        productId: avcoProduct.id,
        value: "Single",
      },
      admin
    );
    const updatedVariant = await call(
      appRouter.catalog.variantUpdate,
      { id: variant.id, value: "Each" },
      admin
    );
    const variants = await call(
      appRouter.catalog.variantList,
      { productId: avcoProduct.id },
      admin
    );
    expect(updatedVariant.value).toBe("Each");
    expect(variants.map((row) => row.id)).toContain(variant.id);
    const archivedVariant = await call(
      appRouter.catalog.variantArchive,
      { id: variant.id },
      admin
    );
    expect(archivedVariant.deletedAt).toBeTruthy();

    const lot = await call(
      appRouter.inventory.lotCreate,
      {
        expiryDate: "2027-01-01",
        lotNumber: "MIX-FIFO-LOT",
        skuId: fifoSku.id,
      },
      admin
    );
    const updatedLot = await call(
      appRouter.inventory.lotUpdate,
      { id: lot.id, status: "quarantined" },
      admin
    );
    const lots = await call(
      appRouter.inventory.lotList,
      { skuId: fifoSku.id, status: "quarantined" },
      admin
    );
    expect(updatedLot.status).toBe("quarantined");
    expect(lots.map((row) => row.id)).toContain(lot.id);

    const rule = await call(
      appRouter.inventory.reorderRuleUpsert,
      {
        locationId: location.id,
        maxQty: 20,
        minQty: 10,
        skuId: avcoSku.id,
      },
      admin
    );
    const rules = await call(
      appRouter.inventory.reorderRuleList,
      { locationId: location.id, skuId: avcoSku.id },
      admin
    );
    expect(rules.map((row) => row.id)).toContain(rule.id);

    await call(
      appRouter.inventory.receive,
      {
        costCurrency: "USD",
        costScale: 2,
        locationId: location.id,
        productId: avcoProduct.id,
        qty: 3,
        skuId: avcoSku.id,
        unitCostMinor: 101,
      },
      admin
    );
    await call(
      appRouter.inventory.receive,
      {
        costCurrency: "USD",
        costScale: 2,
        locationId: location.id,
        productId: fifoProduct.id,
        qty: 4,
        skuId: fifoSku.id,
        unitCostMinor: 200,
      },
      admin
    );

    const report = await call(
      appRouter.reports.valuation,
      { locationId: location.id },
      admin
    );
    const avco = report.avco.find((row) => row.skuId === avcoSku.id);
    const fifo = report.fifo.find((row) => row.skuId === fifoSku.id);
    expect(avco?.qtyOnHand).toBe(3);
    expect(avco?.totalValueMinor).toBe(303);
    expect(fifo?.qtyOnHand).toBe(4);
    expect(fifo?.totalValueMinor).toBe(800);
    const avcoRevalue = await call(
      appRouter.inventory.revalue,
      {
        currency: "USD",
        locationId: location.id,
        reasonCode: "count-value-correction",
        scale: 2,
        skuId: avcoSku.id,
        totalValueMinor: 306,
      },
      admin
    );
    expect(avcoRevalue.method).toBe("avco");
    const fifoLayer = await withTenant(db, ORG, (tx) =>
      tx
        .select()
        .from(schema.valuationLayer)
        .where(eq(schema.valuationLayer.skuId, fifoSku.id))
        .limit(1)
    );
    const fifoLayerRow = fifoLayer.at(0);
    expect(fifoLayerRow).toBeTruthy();
    const fifoRevalue = await call(
      appRouter.inventory.revalue,
      {
        fifoLayerId: fifoLayerRow?.id ?? "",
        locationId: location.id,
        reasonCode: "vendor-cost-correction",
        skuId: fifoSku.id,
        unitCostMinor: 250,
      },
      admin
    );
    expect(fifoRevalue.method).toBe("fifo");
    const revaluedReport = await call(
      appRouter.reports.valuation,
      { locationId: location.id },
      admin
    );
    expect(
      revaluedReport.avco.find((row) => row.skuId === avcoSku.id)
        ?.totalValueMinor
    ).toBe(306);
    expect(
      revaluedReport.fifo.find((row) => row.skuId === fifoSku.id)
        ?.totalValueMinor
    ).toBe(1000);

    await call(
      appRouter.inventory.adjust,
      {
        locationId: location.id,
        productId: avcoProduct.id,
        qtyDelta: -10,
        reasonCode: "oversell-test",
        skuId: avcoSku.id,
      },
      admin
    );
    const discrepancies = await call(
      appRouter.inventory.stockDiscrepancyList,
      { locationId: location.id },
      admin
    );
    expect(discrepancies.some((row) => row.skuId === avcoSku.id)).toBe(true);
    const reviewed = await call(
      appRouter.inventory.stockDiscrepancyReview,
      {
        locationId: location.id,
        notes: "Cycle count requested by test",
        resolution: "count_requested",
        skuId: avcoSku.id,
      },
      admin
    );
    expect(reviewed.reviewed).toBe(true);
    const reorder = await call(
      appRouter.inventory.reorderEvaluate,
      { locationId: location.id, skuId: avcoSku.id },
      admin
    );
    expect(reorder?.suggestedQty).toBe(27);
    const archivedRule = await call(
      appRouter.inventory.reorderRuleArchive,
      { id: rule.id },
      admin
    );
    expect(archivedRule.deletedAt).toBeTruthy();
    const archivedLot = await call(
      appRouter.inventory.lotArchive,
      { id: lot.id },
      admin
    );
    expect(archivedLot.deletedAt).toBeTruthy();

    const valuationEvents = await withTenant(db, ORG, (tx) =>
      tx
        .select()
        .from(schema.outboxEvent)
        .where(eq(schema.outboxEvent.type, "inventory.valuation_updated"))
    );
    expect(valuationEvents.length).toBeGreaterThanOrEqual(2);
    // Reserved-field contract (event-map-phase2.md): valuation_updated reserves
    // the qty==0 ⟺ value==0 integrity fields as PRESENT-but-null today (bound
    // in Phase 5). Asserting presence — not absence — locks the shape so a
    // later Phase-5 consumer never sees a missing key.
    for (const ev of valuationEvents) {
      const payload = ev.payload as Record<string, unknown>;
      expect(payload).toHaveProperty("totalValueMinor");
      expect(payload).toHaveProperty("qtyOnHandBase");
      expect(typeof payload.occurredAt).toBe("string");
    }
    // inventory.adjusted reserves approvedBy (present-but-null until the §22
    // approval workflow lands).
    const adjustedEvents = await withTenant(db, ORG, (tx) =>
      tx
        .select()
        .from(schema.outboxEvent)
        .where(eq(schema.outboxEvent.type, "inventory.adjusted"))
    );
    expect(adjustedEvents.length).toBeGreaterThanOrEqual(1);
    for (const ev of adjustedEvents) {
      expect(ev.payload as Record<string, unknown>).toHaveProperty(
        "approvedBy"
      );
    }
  });

  // H1 regression — ONE parameterized harness over every guarded FK-bearing
  // input. Add a row to `cases` when a new FK input lands; it auto-asserts the
  // cross-tenant reference is rejected.
  it("rejects cross-tenant FK references on every guarded FK input (H1)", async () => {
    const admin = { context: makeCtx(ADMIN, ORG) };
    const adminB = { context: makeCtx(ADMIN_B, ORG_B) };

    // Build a minimal company→location→product→sku(lot-tracked)→lot graph in a
    // tenant, plus an in-tenant stock count, entirely through the routers.
    const buildGraph = async (
      ctxWrap: { context: Context },
      prefix: string
    ) => {
      const company = await call(
        appRouter.company.create,
        { name: `${prefix}Co` },
        ctxWrap
      );
      const location = await call(
        appRouter.location.create,
        { companyId: company.id, name: `${prefix}Loc`, type: "store" },
        ctxWrap
      );
      const product = await call(
        appRouter.product.create,
        {
          sku: `${prefix}-P`,
          name: `${prefix} Prod`,
          priceMinor: 100,
          currency: "USD",
        },
        ctxWrap
      );
      const sku = await call(
        appRouter.catalog.skuCreate,
        { productId: product.id, code: `${prefix}-SKU`, trackingMode: "lot" },
        ctxWrap
      );
      const lot = await call(
        appRouter.inventory.lotCreate,
        { skuId: sku.id, lotNumber: `${prefix}-L1` },
        ctxWrap
      );
      const count = await call(
        appRouter.inventory.countStart,
        { locationId: location.id, scope: "cycle" },
        ctxWrap
      );
      return {
        locationId: location.id,
        productId: product.id,
        skuId: sku.id,
        lotId: lot.id,
        stockCountId: count.id,
      };
    };

    const a = await buildGraph(admin, "FKGA");
    const b = await buildGraph(adminB, "FKGB");

    // Each case: tenant A references a tenant-B-owned id → must be rejected.
    const cases: { fk: string; attempt: () => Promise<unknown> }[] = [
      {
        fk: "countStart.locationId",
        attempt: () =>
          call(
            appRouter.inventory.countStart,
            { locationId: b.locationId, scope: "cycle" },
            admin
          ),
      },
      {
        fk: "adjust.locationId",
        attempt: () =>
          call(
            appRouter.inventory.adjust,
            {
              locationId: b.locationId,
              productId: a.productId,
              skuId: a.skuId,
              qtyDelta: -1,
              reasonCode: "test",
            },
            admin
          ),
      },
      {
        fk: "adjust.lotId",
        attempt: () =>
          call(
            appRouter.inventory.adjust,
            {
              locationId: a.locationId,
              productId: a.productId,
              skuId: a.skuId,
              lotId: b.lotId,
              qtyDelta: -1,
              reasonCode: "test",
            },
            admin
          ),
      },
      {
        fk: "countLineUpsert.skuId",
        attempt: () =>
          call(
            appRouter.inventory.countLineUpsert,
            { stockCountId: a.stockCountId, skuId: b.skuId, countedQty: 1 },
            admin
          ),
      },
      {
        fk: "countLineUpsert.lotId",
        attempt: () =>
          call(
            appRouter.inventory.countLineUpsert,
            {
              stockCountId: a.stockCountId,
              skuId: a.skuId,
              lotId: b.lotId,
              countedQty: 1,
            },
            admin
          ),
      },
      {
        fk: "reorderEvaluate.locationId",
        attempt: () =>
          call(
            appRouter.inventory.reorderEvaluate,
            { locationId: b.locationId, skuId: a.skuId },
            admin
          ),
      },
      {
        fk: "reorderEvaluate.skuId",
        attempt: () =>
          call(
            appRouter.inventory.reorderEvaluate,
            { locationId: a.locationId, skuId: b.skuId },
            admin
          ),
      },
    ];

    for (const c of cases) {
      await expect(c.attempt()).rejects.toThrow();
    }

    // Positive control: an in-tenant reference still succeeds.
    const ok = await call(
      appRouter.inventory.countStart,
      { locationId: a.locationId, scope: "cycle" },
      admin
    );
    expect(ok.id).toBeTruthy();
  });

  // Phase-3 commit 0 / #5 — the composite FK makes a cross-tenant
  // location→company reference impossible at the DB LAYER, not just the router.
  // This is the durable kill of the H1 class: even a raw insert that bypasses
  // the router's assertCompanyVisible guard is rejected by Postgres.
  it("composite FK rejects a cross-tenant location→company reference at the DB layer (#5)", async () => {
    const admin = { context: makeCtx(ADMIN, ORG) };
    const adminB = { context: makeCtx(ADMIN_B, ORG_B) };
    const coA = await call(appRouter.company.create, { name: "C0-CoA" }, admin);
    const coB = await call(
      appRouter.company.create,
      { name: "C0-CoB" },
      adminB
    );

    // RAW insert in tenant A referencing tenant B's company → DB rejects it
    // (location_company_composite_fk), with no router guard in the path.
    await expect(
      withTenant(db, ORG, (tx) =>
        tx.insert(schema.location).values({
          tenantId: ORG,
          companyId: coB.id,
          name: "cross-tenant",
          type: "store",
        })
      )
    ).rejects.toThrow();

    // Positive control: same-tenant raw insert succeeds.
    const okLoc = await withTenant(db, ORG, (tx) =>
      tx
        .insert(schema.location)
        .values({
          tenantId: ORG,
          companyId: coA.id,
          name: "in-tenant",
          type: "store",
        })
        .returning()
    );
    expect(okLoc.at(0)?.id).toBeTruthy();
  });

  // Phase-3 commit 0 / #7 (F4) — the set-once DB trigger rejects a RAW
  // costing_method UPDATE once movements exist, even when the app-layer guard
  // (assertCostingMethodSetOnce) is bypassed. F4: a PRODUCT-LEVEL movement
  // (sku_id NULL) also locks the SKU's method.
  it("set-once DB-trigger rejects a raw costing_method UPDATE after movements (#7, F4)", async () => {
    const admin = { context: makeCtx(ADMIN, ORG) };
    const company = await call(
      appRouter.company.create,
      { name: "C0-SO-Co" },
      admin
    );
    const location = await call(
      appRouter.location.create,
      { companyId: company.id, name: "C0-SO-Loc", type: "store" },
      admin
    );
    const product = await call(
      appRouter.product.create,
      { sku: "C0-SO-P", name: "SO Prod", priceMinor: 100, currency: "USD" },
      admin
    );

    // Before any movement: a raw method change is allowed (NULL → fifo).
    await withTenant(db, ORG, (tx) =>
      tx.execute(
        sql`UPDATE product SET costing_method = 'fifo' WHERE id = ${product.id} AND tenant_id = ${ORG}`
      )
    );

    // Product-level receipt (no skuId → sku_id NULL): a movement now exists.
    await call(
      appRouter.inventory.receive,
      { locationId: location.id, productId: product.id, qty: 5 },
      admin
    );

    // After a movement: a RAW UPDATE (bypassing the app guard) is rejected.
    await expect(
      withTenant(db, ORG, (tx) =>
        tx.execute(
          sql`UPDATE product SET costing_method = 'avco' WHERE id = ${product.id} AND tenant_id = ${ORG}`
        )
      )
    ).rejects.toThrow();

    // F4: a SKU of that product is also locked by the product-level movement.
    const sku = await call(
      appRouter.catalog.skuCreate,
      { productId: product.id, code: "C0-SO-SKU" },
      admin
    );
    await expect(
      withTenant(db, ORG, (tx) =>
        tx.execute(
          sql`UPDATE sku SET costing_method = 'fifo' WHERE id = ${sku.id} AND tenant_id = ${ORG}`
        )
      )
    ).rejects.toThrow();
  });

  // Phase-3 commit 1 — the self-referential location tree. The parent FK is
  // composite on (tenant_id, company_id, parent_location_id) → the
  // (tenant_id, company_id, id) target from commit 0, so the DB enforces that a
  // child node shares BOTH tenant AND company with its parent (a CHECK can't
  // read the parent row — the Codex-F3 lesson). The write path here is location
  // creation; the invariant's owner is the DB constraint, proven by raw insert.
  it("parent composite FK enforces same-tenant + same-company nesting (commit 1)", async () => {
    const admin = { context: makeCtx(ADMIN, ORG) };
    const adminB = { context: makeCtx(ADMIN_B, ORG_B) };
    const coA = await call(appRouter.company.create, { name: "C1-CoA" }, admin);
    const coA2 = await call(
      appRouter.company.create,
      { name: "C1-CoA2" },
      admin
    );
    const coB = await call(
      appRouter.company.create,
      { name: "C1-CoB" },
      adminB
    );

    // Top-level warehouse under coA.
    const wh = await call(
      appRouter.location.create,
      { companyId: coA.id, name: "C1-WH", type: "warehouse" },
      admin
    );
    // A top-level location in tenant B (for the cross-tenant parent attempt).
    const whB = await call(
      appRouter.location.create,
      { companyId: coB.id, name: "C1-WH-B", type: "warehouse" },
      adminB
    );

    const insertChild = (
      tenant: string,
      companyId: string,
      parentId: string,
      name: string
    ) =>
      withTenant(db, tenant, (tx) =>
        tx
          .insert(schema.location)
          .values({
            tenantId: tenant,
            companyId,
            parentLocationId: parentId,
            name,
            type: "zone",
          })
          .returning()
      );

    // Valid child (same tenant + same company as parent) → succeeds.
    const zone = await insertChild(ORG, coA.id, wh.id, "C1-Zone");
    expect(zone.at(0)?.id).toBeTruthy();

    // Same tenant, DIFFERENT company than the parent → rejected (composite FK:
    // parent must have company=coA2, but wh has company=coA).
    await expect(
      insertChild(ORG, coA2.id, wh.id, "C1-BadCompany")
    ).rejects.toThrow();

    // Cross-tenant parent (parent lives in tenant B) → rejected.
    await expect(
      insertChild(ORG, coA.id, whB.id, "C1-BadTenant")
    ).rejects.toThrow();

    // New columns carry their defaults on an existing-style insert.
    const top = await withTenant(db, ORG, (tx) =>
      tx
        .select({
          isSellable: schema.location.isSellable,
          isQuarantine: schema.location.isQuarantine,
          isBonded: schema.location.isBonded,
          isTransit: schema.location.isTransit,
        })
        .from(schema.location)
        .where(eq(schema.location.id, wh.id))
    );
    expect(top.at(0)).toEqual({
      isSellable: true,
      isQuarantine: false,
      isBonded: false,
      isTransit: false,
    });
  });

  // Phase-3 commit 2 — two-step transfer, QUANTITY conservation. The write path
  // (transfer router) invokes transfer.ts, which moves every leg through the
  // sole ledger mutator → qty conserved across {source, in-transit, dest} at
  // each step (the standing #8 write-path discipline).
  it("two-step transfer conserves quantity through a per-transfer in-transit node (commit 2)", async () => {
    const admin = { context: makeCtx(ADMIN, ORG) };
    const company = await call(
      appRouter.company.create,
      { name: "C2-Co" },
      admin
    );
    const source = await call(
      appRouter.location.create,
      { companyId: company.id, name: "C2-WH", type: "warehouse" },
      admin
    );
    const dest = await call(
      appRouter.location.create,
      { companyId: company.id, name: "C2-Store", type: "store" },
      admin
    );
    const product = await call(
      appRouter.product.create,
      { sku: "C2-P", name: "C2 Prod", priceMinor: 100, currency: "USD" },
      admin
    );
    await call(
      appRouter.inventory.receive,
      { locationId: source.id, productId: product.id, qty: 10 },
      admin
    );

    const created = await call(
      appRouter.transfer.create,
      {
        sourceLocationId: source.id,
        destLocationId: dest.id,
        lines: [{ productId: product.id, qty: 4 }],
      },
      admin
    );
    const transferId = created.transfer.id;
    const transitId = created.transfer.inTransitLocationId;
    expect(created.transfer.status).toBe("draft");

    const onHand = (loc: string) =>
      withTenant(db, ORG, (tx) => services.stockOnHand(tx, loc, product.id));
    const transit = () =>
      withTenant(db, ORG, (tx) =>
        services.transitBalance(tx, transitId, product.id)
      );

    // Before ship: all 10 at source.
    expect(await onHand(source.id)).toBe(10);

    await call(appRouter.transfer.ship, { transferId }, admin);
    // After ship: source 6, in-transit 4, dest 0 → Σ = 10 (conserved).
    expect(await onHand(source.id)).toBe(6);
    expect(await transit()).toBe(4);
    expect(await onHand(dest.id)).toBe(0);

    await call(appRouter.transfer.receive, { transferId }, admin);
    // After receive: source 6, in-transit 0, dest 4 → Σ = 10 (conserved).
    expect(await onHand(source.id)).toBe(6);
    expect(await transit()).toBe(0);
    expect(await onHand(dest.id)).toBe(4);

    // Cannot receive again (already received) — no over-receive.
    await expect(
      call(appRouter.transfer.receive, { transferId }, admin)
    ).rejects.toThrow();
    // Cannot cancel after received.
    await expect(
      call(appRouter.transfer.cancel, { transferId }, admin)
    ).rejects.toThrow();
  });

  // Phase-3 commit 3 — VALUE conservation through the PRIMARY WRITE PATH. The
  // transfer ROUTER (create → ship → receive) must invoke valuation on BOTH legs
  // so avg_cost/valuation_layer actually MOVE source → in-transit → dest — the
  // #8-class "does the write path invoke the service?" gate — for an AVCO and a
  // FIFO SKU. Also asserts the dispatched/received events carry the value fields.
  it("transfer router conserves VALUE on both legs for AVCO + FIFO SKUs (commit 3)", async () => {
    const admin = { context: makeCtx(ADMIN, ORG) };
    const company = await call(
      appRouter.company.create,
      { name: "C3-Co" },
      admin
    );
    const source = await call(
      appRouter.location.create,
      { companyId: company.id, name: "C3-WH", type: "warehouse" },
      admin
    );
    const dest = await call(
      appRouter.location.create,
      { companyId: company.id, name: "C3-Store", type: "store" },
      admin
    );
    const each = await call(
      appRouter.catalog.uomCreate,
      { code: "C3-EA", name: "C3 Each" },
      admin
    );
    const fifoCategory = await call(
      appRouter.catalog.categoryCreate,
      { costingMethod: "fifo", name: "C3-Pharma" },
      admin
    );
    const avcoProduct = await call(
      appRouter.product.create,
      {
        baseUomId: each.id,
        currency: "USD",
        name: "C3 AVCO",
        priceMinor: 100,
        sku: "C3-AVCO",
      },
      admin
    );
    const fifoProduct = await call(
      appRouter.product.create,
      {
        baseUomId: each.id,
        categoryId: fifoCategory.id,
        currency: "USD",
        name: "C3 FIFO",
        priceMinor: 100,
        sku: "C3-FIFO",
      },
      admin
    );
    const avcoSku = await call(
      appRouter.catalog.skuCreate,
      { baseUomId: each.id, code: "C3-AVCO-EA", productId: avcoProduct.id },
      admin
    );
    const fifoSku = await call(
      appRouter.catalog.skuCreate,
      { baseUomId: each.id, code: "C3-FIFO-EA", productId: fifoProduct.id },
      admin
    );

    // Valued receipts at source: AVCO 5 @ 200 = 1000; FIFO 1@100 + 1@101 = 201.
    await call(
      appRouter.inventory.receive,
      {
        costCurrency: "USD",
        costScale: 2,
        locationId: source.id,
        productId: avcoProduct.id,
        qty: 5,
        skuId: avcoSku.id,
        unitCostMinor: 200,
      },
      admin
    );
    for (const unitCostMinor of [100, 101]) {
      await call(
        appRouter.inventory.receive,
        {
          costCurrency: "USD",
          costScale: 2,
          locationId: source.id,
          productId: fifoProduct.id,
          qty: 1,
          skuId: fifoSku.id,
          unitCostMinor,
        },
        admin
      );
    }

    const avcoVal = (loc: string) =>
      withTenant(db, ORG, async (tx) => {
        const r = await tx.execute(
          sql`SELECT COALESCE(total_value_minor, 0)::bigint AS v FROM avg_cost WHERE sku_id = ${avcoSku.id} AND location_id = ${loc}`
        );
        return Number((r.rows.at(0) as { v?: number } | undefined)?.v ?? 0);
      });
    const fifoVal = (loc: string) =>
      withTenant(db, ORG, async (tx) => {
        const r = await tx.execute(
          sql`SELECT COALESCE(SUM(qty_remaining * unit_cost_minor), 0)::bigint AS v FROM valuation_layer WHERE sku_id = ${fifoSku.id} AND location_id = ${loc}`
        );
        return Number((r.rows.at(0) as { v?: number } | undefined)?.v ?? 0);
      });

    expect(await avcoVal(source.id)).toBe(1000);
    expect(await fifoVal(source.id)).toBe(201);

    const created = await call(
      appRouter.transfer.create,
      {
        sourceLocationId: source.id,
        destLocationId: dest.id,
        lines: [
          { productId: avcoProduct.id, skuId: avcoSku.id, qty: 3 },
          { productId: fifoProduct.id, skuId: fifoSku.id, qty: 2 },
        ],
      },
      admin
    );
    const transitId = created.transfer.inTransitLocationId;

    await call(
      appRouter.transfer.ship,
      { transferId: created.transfer.id },
      admin
    );
    // Both legs valued: source DOWN, in-transit UP (the #8 write-path proof —
    // were valuation not invoked, the in-transit cells would stay empty).
    expect(await avcoVal(source.id)).toBe(400); // 1000 − 600
    expect(await avcoVal(transitId)).toBe(600);
    expect(await fifoVal(source.id)).toBe(0);
    expect(await fifoVal(transitId)).toBe(201);
    expect(await avcoVal(dest.id)).toBe(0);
    expect(await fifoVal(dest.id)).toBe(0);

    await call(
      appRouter.transfer.receive,
      { transferId: created.transfer.id },
      admin
    );
    expect(await avcoVal(transitId)).toBe(0);
    expect(await fifoVal(transitId)).toBe(0);
    expect(await avcoVal(dest.id)).toBe(600);
    expect(await fifoVal(dest.id)).toBe(201);

    // Dispatched event carries per-line + top-level released value (event-map
    // INV-2). Filter by transferId — other tests emit transfer events too.
    const dispatched = await withTenant(db, ORG, (tx) =>
      tx
        .select()
        .from(schema.outboxEvent)
        .where(eq(schema.outboxEvent.type, "inventory.transfer_dispatched"))
    );
    const dispatchPayload = dispatched
      .map((ev) => ev.payload as Record<string, unknown>)
      .find((p) => p.transferId === created.transfer.id);
    expect(dispatchPayload?.releasedValueMinor).toBe(801); // 600 + 201
    expect(dispatchPayload?.currency).toBe("USD");
    expect(typeof dispatchPayload?.occurredAt).toBe("string");
    const dispatchLines = (dispatchPayload?.lines ?? []) as Record<
      string,
      unknown
    >[];
    expect(
      dispatchLines.find((l) => l.skuId === avcoSku.id)?.releasedValueMinor
    ).toBe(600);
    expect(
      dispatchLines.find((l) => l.skuId === fifoSku.id)?.releasedValueMinor
    ).toBe(201);

    // Received value MUST equal released value, per line (value conservation).
    const receivedEv = await withTenant(db, ORG, (tx) =>
      tx
        .select()
        .from(schema.outboxEvent)
        .where(eq(schema.outboxEvent.type, "inventory.transfer_received"))
    );
    const recvPayload = receivedEv
      .map((ev) => ev.payload as Record<string, unknown>)
      .find((p) => p.transferId === created.transfer.id);
    expect(recvPayload?.receivedValueMinor).toBe(801);
    const recvLines = (recvPayload?.lines ?? []) as Record<string, unknown>[];
    expect(
      recvLines.find((l) => l.skuId === avcoSku.id)?.receivedValueMinor
    ).toBe(600);
    expect(
      recvLines.find((l) => l.skuId === fifoSku.id)?.receivedValueMinor
    ).toBe(201);
  });

  // Codex HIGH-1 regression — transfer-row serialization. Two concurrent ships
  // on the same draft must NOT both pass the stale status guard; `loadTransfer`'s
  // FOR UPDATE serializes them so exactly one wins (the other re-reads 'shipped'
  // and is rejected), and the source is debited exactly once.
  it("serializes concurrent transfer transitions — only one ship wins", async () => {
    const admin = { context: makeCtx(ADMIN, ORG) };
    const company = await call(
      appRouter.company.create,
      { name: "C3R-Co" },
      admin
    );
    const source = await call(
      appRouter.location.create,
      { companyId: company.id, name: "C3R-WH", type: "warehouse" },
      admin
    );
    const dest = await call(
      appRouter.location.create,
      { companyId: company.id, name: "C3R-Store", type: "store" },
      admin
    );
    const product = await call(
      appRouter.product.create,
      { sku: "C3R-P", name: "C3R", priceMinor: 100, currency: "USD" },
      admin
    );
    await call(
      appRouter.inventory.receive,
      { locationId: source.id, productId: product.id, qty: 10 },
      admin
    );
    const created = await call(
      appRouter.transfer.create,
      {
        sourceLocationId: source.id,
        destLocationId: dest.id,
        lines: [{ productId: product.id, qty: 4 }],
      },
      admin
    );
    const transferId = created.transfer.id;

    const results = await Promise.allSettled([
      call(appRouter.transfer.ship, { transferId }, admin),
      call(appRouter.transfer.ship, { transferId }, admin),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);

    // Source debited exactly ONCE (10 − 4 = 6), not twice (= 2).
    const onHand = await withTenant(db, ORG, (tx) =>
      services.stockOnHand(tx, source.id, product.id)
    );
    expect(onHand).toBe(6);
  });

  // Codex MEDIUM regression — a transfer line's SKU must belong to its product,
  // else the ledger stores productId=A while costing resolves from SKU=B's cell.
  it("rejects a transfer line whose SKU does not belong to its product", async () => {
    const admin = { context: makeCtx(ADMIN, ORG) };
    const company = await call(
      appRouter.company.create,
      { name: "C3X-Co" },
      admin
    );
    const source = await call(
      appRouter.location.create,
      { companyId: company.id, name: "C3X-WH", type: "warehouse" },
      admin
    );
    const dest = await call(
      appRouter.location.create,
      { companyId: company.id, name: "C3X-Store", type: "store" },
      admin
    );
    const each = await call(
      appRouter.catalog.uomCreate,
      { code: "C3X-EA", name: "C3X Each" },
      admin
    );
    const prodA = await call(
      appRouter.product.create,
      {
        baseUomId: each.id,
        currency: "USD",
        name: "A",
        priceMinor: 100,
        sku: "C3X-A",
      },
      admin
    );
    const prodB = await call(
      appRouter.product.create,
      {
        baseUomId: each.id,
        currency: "USD",
        name: "B",
        priceMinor: 100,
        sku: "C3X-B",
      },
      admin
    );
    const skuB = await call(
      appRouter.catalog.skuCreate,
      { baseUomId: each.id, code: "C3X-B-EA", productId: prodB.id },
      admin
    );
    // productId=A but skuId belongs to B → rejected.
    await expect(
      call(
        appRouter.transfer.create,
        {
          sourceLocationId: source.id,
          destLocationId: dest.id,
          lines: [{ productId: prodA.id, skuId: skuB.id, qty: 1 }],
        },
        admin
      )
    ).rejects.toThrow();
  });

  // Phase-3 commit 2 — INTRA-COMPANY only + cross-tenant rejection.
  it("rejects inter-company and cross-tenant transfers (commit 2)", async () => {
    const admin = { context: makeCtx(ADMIN, ORG) };
    const adminB = { context: makeCtx(ADMIN_B, ORG_B) };
    const coA = await call(appRouter.company.create, { name: "C2-CoA" }, admin);
    const coA2 = await call(
      appRouter.company.create,
      { name: "C2-CoA2" },
      admin
    );
    const locA = await call(
      appRouter.location.create,
      { companyId: coA.id, name: "C2-LocA", type: "warehouse" },
      admin
    );
    const locA2 = await call(
      appRouter.location.create,
      { companyId: coA2.id, name: "C2-LocA2", type: "store" },
      admin
    );
    const prod = await call(
      appRouter.product.create,
      { sku: "C2-IP", name: "IC", priceMinor: 1, currency: "USD" },
      admin
    );

    // Inter-company (locA in coA, locA2 in coA2, same tenant) → service rejects.
    await expect(
      call(
        appRouter.transfer.create,
        {
          sourceLocationId: locA.id,
          destLocationId: locA2.id,
          lines: [{ productId: prod.id, qty: 1 }],
        },
        admin
      )
    ).rejects.toThrow();

    // Cross-tenant: tenant B location as dest → router assertLocationVisible.
    const coB = await call(
      appRouter.company.create,
      { name: "C2-CoB" },
      adminB
    );
    const locB = await call(
      appRouter.location.create,
      { companyId: coB.id, name: "C2-LocB", type: "store" },
      adminB
    );
    await expect(
      call(
        appRouter.transfer.create,
        {
          sourceLocationId: locA.id,
          destLocationId: locB.id,
          lines: [{ productId: prod.id, qty: 1 }],
        },
        admin
      )
    ).rejects.toThrow();

    // DB-layer backstop: a RAW stock_transfer in tenant A referencing tenant B's
    // location (bypassing the router) is rejected by the dest composite FK.
    await expect(
      withTenant(db, ORG, (tx) =>
        tx.insert(schema.stockTransfer).values({
          tenantId: ORG,
          companyId: coA.id,
          number: "C2-RAW-1",
          sourceLocationId: locA.id,
          destLocationId: locB.id,
          inTransitLocationId: locA.id,
          status: "draft",
        })
      )
    ).rejects.toThrow();
  });

  // H2 regression — D5 allow-oversell-with-flagging: the ledger is NOT
  // hard-blocked, but an oversell emits inventory.stock_discrepancy for review.
  it("emits inventory.stock_discrepancy only on oversell, correlated to the sale (H2)", async () => {
    const admin = { context: makeCtx(ADMIN, ORG) };
    const company = await call(
      appRouter.company.create,
      { name: "H2OCo" },
      admin
    );
    const location = await call(
      appRouter.location.create,
      { companyId: company.id, name: "H2OLoc", type: "store" },
      admin
    );
    const product = await call(
      appRouter.product.create,
      { sku: "H2O-P", name: "H2O Prod", priceMinor: 500, currency: "USD" },
      admin
    );
    const h2Sku = await call(
      appRouter.catalog.skuCreate,
      { code: "H2O-EA", productId: product.id },
      admin
    );
    // Opening balance of 5 into the (location, SKU) cell via a valued receipt, so
    // the sku-keyed sale deduction (skuId is required) values against a real
    // avg_cost cell — the oversell still drives on-hand negative.
    await call(
      appRouter.inventory.receive,
      {
        costCurrency: "USD",
        costScale: 2,
        locationId: location.id,
        productId: product.id,
        qty: 5,
        skuId: h2Sku.id,
        unitCostMinor: 400,
      },
      admin
    );

    const discrepancies = () =>
      withTenant(db, ORG, (tx) =>
        tx
          .select()
          .from(schema.outboxEvent)
          .where(eq(schema.outboxEvent.type, "inventory.stock_discrepancy"))
      );
    const before = await discrepancies();

    // 1) Normal sale within stock (3 of 5) → NO discrepancy.
    await call(
      appRouter.pos.createSale,
      {
        locationId: location.id,
        idempotencyKey: "h2-ok",
        lines: [{ productId: product.id, qty: 3, skuId: h2Sku.id }],
        tenders: [{ method: "cash", currency: "USD", amountMinor: 1500 }],
      },
      admin
    );
    expect((await discrepancies()).length).toBe(before.length);

    // 2) Oversell (2 left, sell 10) → discrepancy emitted, tenant-scoped + sale-correlated.
    const oversell = await call(
      appRouter.pos.createSale,
      {
        locationId: location.id,
        idempotencyKey: "h2-oversell",
        lines: [{ productId: product.id, qty: 10, skuId: h2Sku.id }],
        tenders: [{ method: "cash", currency: "USD", amountMinor: 5000 }],
      },
      admin
    );
    const after = await discrepancies();
    expect(after.length).toBe(before.length + 1);
    const event = after.at(-1) as {
      tenantId: string;
      payload: { saleId?: string; source?: string; resultingOnHand?: number };
    };
    expect(event.tenantId).toBe(ORG);
    expect(event.payload.saleId).toBe(oversell.saleId);
    expect(event.payload.source).toBe("oversell");
    expect(event.payload.resultingOnHand).toBeLessThan(0);
  });

  // PART 2 — costing_method is set-once: changeable on a fresh item, immutable
  // after the item has any stock_ledger movement (re-valuing history is the
  // hazard; a mixed AVCO/FIFO catalog is fine).
  it("enforces costing_method set-once after first movement (D1/ADR-0008)", async () => {
    const admin = { context: makeCtx(ADMIN, ORG) };
    const company = await call(
      appRouter.company.create,
      { name: "SetOnceCo" },
      admin
    );
    const location = await call(
      appRouter.location.create,
      { companyId: company.id, name: "SetOnceLoc", type: "store" },
      admin
    );
    const product = await call(
      appRouter.product.create,
      {
        sku: "SETONCE-P",
        name: "SetOnce",
        priceMinor: 100,
        currency: "USD",
        costingMethod: "avco",
      },
      admin
    );

    // Fresh item (no movements) → changing costing_method SUCCEEDS.
    const changed = await call(
      appRouter.product.update,
      { id: product.id, costingMethod: "fifo" },
      admin
    );
    expect(changed.costingMethod).toBe("fifo");

    // Create a ledger movement for the product (product-keyed, no skuId).
    await withTenant(db, ORG, (tx) =>
      services.appendStockMovement(
        tx,
        { tenantId: ORG },
        {
          locationId: location.id,
          productId: product.id,
          movementType: "receipt",
          qtyDelta: 1,
        }
      )
    );

    // Now CHANGING the method is REJECTED (history exists).
    await expect(
      call(
        appRouter.product.update,
        { id: product.id, costingMethod: "avco" },
        admin
      )
    ).rejects.toThrow();

    // Re-supplying the SAME value is a no-op, not a change → still allowed.
    const noop = await call(
      appRouter.product.update,
      { id: product.id, costingMethod: "fifo" },
      admin
    );
    expect(noop.costingMethod).toBe("fifo");
  });

  // Phase-3 commit 5 — bond release write-path proof (#8 class). The bond.release
  // ROUTER must INVOKE valuation on both transfer legs (value conserved out of
  // the bonded cell into the store) AND apply the duty/tax value-only ADD, then
  // emit inventory.bond_released (full per-line contract) and audit. A green
  // service suite is not evidence the router path uses the service — this drives
  // the router end-to-end and asserts the avg_cost cells actually moved.
  it("bond.release ROUTER conserves value bonded→store, ADDS duty+tax, emits bond_released + audits (commit 5)", async () => {
    const admin = { context: makeCtx(ADMIN, ORG) };
    const company = await call(
      appRouter.company.create,
      { name: "BondRelCo" },
      admin
    );
    const bonded = await call(
      appRouter.location.create,
      { companyId: company.id, name: "BondWH", type: "bonded" },
      admin
    );
    // location.create does not expose the bonded flag; set it directly (fixture).
    await withTenant(db, ORG, (tx) =>
      tx
        .update(schema.location)
        .set({ isBonded: true, isSellable: false })
        .where(eq(schema.location.id, bonded.id))
    );
    const store = await call(
      appRouter.location.create,
      { companyId: company.id, name: "RelStore", type: "store" },
      admin
    );
    const product = await call(
      appRouter.product.create,
      {
        sku: "BR-ROUTER-P",
        name: "Bond Release Router Prod",
        priceMinor: 5000,
        currency: "USD",
        costingMethod: "avco",
      },
      admin
    );
    const sku = await call(
      appRouter.catalog.skuCreate,
      { productId: product.id, code: "BR-ROUTER-SKU" },
      admin
    );

    // Receive 10 @ 1500 into the bonded location (avg 1500/unit → value 15000).
    const received = await call(
      appRouter.bond.receive,
      {
        companyId: company.id,
        locationId: bonded.id,
        lines: [
          {
            productId: product.id,
            skuId: sku.id,
            qty: 10,
            unitCostMinor: 1500,
            costCurrency: "USD",
            costScale: 2,
          },
        ],
      },
      admin
    );
    const receiptLineId = received.lines[0]?.id as string;

    // Release 4 with duty 300 + tax 100.
    const releaseResult = await call(
      appRouter.bond.release,
      {
        bondReceiptId: received.receipt.id,
        destLocationId: store.id,
        lines: [
          {
            bondReceiptLineId: receiptLineId,
            qty: 4,
            dutyMinor: 300,
            taxMinor: 100,
          },
        ],
      },
      admin
    );
    expect(releaseResult.release.status).toBe("released");
    expect(releaseResult.transferId).toBeTruthy();

    // The router INVOKED valuation: bonded cell lost exactly 4×1500=6000.
    const cellValue = (skuId: string, locationId: string) =>
      withTenant(db, ORG, (tx) =>
        tx
          .select()
          .from(schema.avgCost)
          .where(
            and(
              eq(schema.avgCost.skuId, skuId),
              eq(schema.avgCost.locationId, locationId)
            )
          )
          .limit(1)
          .then((rows) => rows.at(0))
      );
    const bondedCell = await cellValue(sku.id, bonded.id);
    expect(bondedCell?.qtyOnHand).toBe(6);
    expect(bondedCell?.totalValueMinor).toBe(9000);
    // Store: 6000 conserved + 300 duty + 100 tax = 6400; qty unchanged by the add.
    const storeCell = await cellValue(sku.id, store.id);
    expect(storeCell?.qtyOnHand).toBe(4);
    expect(storeCell?.totalValueMinor).toBe(6400);

    // inventory.bond_released emitted with the full per-line contract.
    const releaseEvent = (
      await withTenant(db, ORG, (tx) =>
        tx
          .select()
          .from(schema.outboxEvent)
          .where(eq(schema.outboxEvent.type, "inventory.bond_released"))
      )
    ).at(-1) as {
      payload: {
        bondReleaseId: string;
        transferId: string;
        lines: {
          skuId: string;
          qtyBase: number;
          releasedValueMinor: number | null;
          dutyMinor: number;
          taxMinor: number;
          currency: string;
          scale: number;
        }[];
        releasedBy: string | null;
        requestedBy: string | null;
        approvedBy: string | null;
      };
    };
    expect(releaseEvent.payload.bondReleaseId).toBe(releaseResult.release.id);
    const evLine = releaseEvent.payload.lines[0];
    expect(evLine?.skuId).toBe(sku.id);
    expect(evLine?.qtyBase).toBe(4);
    expect(evLine?.releasedValueMinor).toBe(6000);
    expect(evLine?.dutyMinor).toBe(300);
    expect(evLine?.taxMinor).toBe(100);
    expect(evLine?.currency).toBe("USD");
    // RBAC-immediate: requested/approved default to the actor.
    expect(releaseEvent.payload.requestedBy).toBe(ADMIN);
    expect(releaseEvent.payload.approvedBy).toBe(ADMIN);

    // The release is audited.
    const auditRow = (
      await withTenant(db, ORG, (tx) =>
        tx
          .select()
          .from(schema.auditLog)
          .where(eq(schema.auditLog.entityId, releaseResult.release.id))
      )
    ).at(0) as { action: string } | undefined;
    expect(auditRow?.action).toBe("bond.release");
  });

  // RBAC: a cashier holds neither bond.release nor bond.approve_release.
  it("rejects bond.release for an actor without the bond permissions", async () => {
    const cashier = { context: makeCtx(CASHIER, ORG) };
    await expect(
      call(
        appRouter.bond.release,
        {
          bondReceiptId: "00000000-0000-0000-0000-000000000000",
          destLocationId: "00000000-0000-0000-0000-000000000000",
          lines: [
            {
              bondReceiptLineId: "00000000-0000-0000-0000-000000000000",
              qty: 1,
            },
          ],
        },
        cashier
      )
    ).rejects.toThrow();
  });

  // ── Phase 4 Commit 2 — Minimum Sellable POS ───────────────────────────────
  // THE #8 write-path gate: prove the ROUTER (not just the service) invokes
  // applyValuation per line — avg_cost / valuation_layer must actually MOVE and
  // the sale_line must carry stamped COGS. A green costing service suite is NOT
  // evidence the POS write path uses it (engineering-principles §B5).
  it("MSP: pos.createSale wires applyValuation per line (#8) — COGS stamped, valuation moves (AVCO+FIFO), tenders + change recorded, idempotent", async () => {
    const admin = { context: makeCtx(ADMIN, ORG) };
    const company = await call(
      appRouter.company.create,
      { name: "MSPCo" },
      admin
    );
    const location = await call(
      appRouter.location.create,
      { companyId: company.id, name: "MSPStore", type: "store" },
      admin
    );
    const each = await call(
      appRouter.catalog.uomCreate,
      { code: "MSP-EA", name: "Each" },
      admin
    );
    const fifoCat = await call(
      appRouter.catalog.categoryCreate,
      { costingMethod: "fifo", name: "MSP FIFO" },
      admin
    );
    const avcoProduct = await call(
      appRouter.product.create,
      {
        baseUomId: each.id,
        costingMethod: "avco",
        currency: "USD",
        name: "AVCO",
        priceMinor: 1000,
        sku: "MSP-AVCO",
      },
      admin
    );
    const fifoProduct = await call(
      appRouter.product.create,
      {
        baseUomId: each.id,
        categoryId: fifoCat.id,
        currency: "USD",
        name: "FIFO",
        priceMinor: 2000,
        sku: "MSP-FIFO",
      },
      admin
    );
    const avcoSku = await call(
      appRouter.catalog.skuCreate,
      { baseUomId: each.id, code: "MSP-AVCO-EA", productId: avcoProduct.id },
      admin
    );
    const fifoSku = await call(
      appRouter.catalog.skuCreate,
      { baseUomId: each.id, code: "MSP-FIFO-EA", productId: fifoProduct.id },
      admin
    );
    // Receive valued stock: AVCO 5 @ 100; FIFO 5 @ 300.
    await call(
      appRouter.inventory.receive,
      {
        costCurrency: "USD",
        costScale: 2,
        locationId: location.id,
        productId: avcoProduct.id,
        qty: 5,
        skuId: avcoSku.id,
        unitCostMinor: 100,
      },
      admin
    );
    await call(
      appRouter.inventory.receive,
      {
        costCurrency: "USD",
        costScale: 2,
        locationId: location.id,
        productId: fifoProduct.id,
        qty: 5,
        skuId: fifoSku.id,
        unitCostMinor: 300,
      },
      admin
    );

    // Sell 2 AVCO @1000 + 1 FIFO @2000 = 4000; pay 5000 cash → change 1000.
    const sale = await call(
      appRouter.pos.createSale,
      {
        idempotencyKey: "msp-1",
        lines: [
          { productId: avcoProduct.id, qty: 2, skuId: avcoSku.id },
          { productId: fifoProduct.id, qty: 1, skuId: fifoSku.id },
        ],
        locationId: location.id,
        tenders: [{ amountMinor: 5000, currency: "USD", method: "cash" }],
      },
      admin
    );
    expect(sale.totalMinor).toBe(4000);
    expect(sale.changeMinor).toBe(1000);

    // #8 — valuation MOVED: AVCO qty 5→3 @ 100; FIFO layer remaining 5→4.
    const avco = await withTenant(db, ORG, (tx) =>
      tx
        .select()
        .from(schema.avgCost)
        .where(
          and(
            eq(schema.avgCost.skuId, avcoSku.id),
            eq(schema.avgCost.locationId, location.id)
          )
        )
    );
    expect(avco.at(0)?.qtyOnHand).toBe(3);
    expect(avco.at(0)?.totalValueMinor).toBe(300);
    const fifoLayers = await withTenant(db, ORG, (tx) =>
      tx
        .select()
        .from(schema.valuationLayer)
        .where(eq(schema.valuationLayer.skuId, fifoSku.id))
    );
    const remaining = fifoLayers.reduce(
      (sum, layer) => sum + Number(layer.qtyRemaining),
      0
    );
    expect(remaining).toBe(4);

    // #8 — COGS STAMPED on every tracked sale line.
    const lines = await withTenant(db, ORG, (tx) =>
      tx
        .select()
        .from(schema.saleLine)
        .where(eq(schema.saleLine.saleId, sale.saleId))
    );
    for (const line of lines) {
      expect(line.cogsMinor).not.toBeNull();
      expect(line.costingMethodApplied).not.toBeNull();
    }
    const avcoLine = lines.find((line) => line.skuId === avcoSku.id);
    expect(avcoLine?.cogsMinor).toBe(200);
    expect(avcoLine?.costingMethodApplied).toBe("avco");
    const fifoLine = lines.find((line) => line.skuId === fifoSku.id);
    expect(fifoLine?.cogsMinor).toBe(300);
    expect(fifoLine?.costingMethodApplied).toBe("fifo");

    // Tender row recorded with the computed change.
    const tenders = await withTenant(db, ORG, (tx) =>
      tx
        .select()
        .from(schema.tender)
        .where(eq(schema.tender.saleId, sale.saleId))
    );
    expect(tenders.length).toBe(1);
    expect(tenders.at(0)?.changeMinor).toBe(1000);
    expect(tenders.at(0)?.settledAmountMinor).toBe(4000);

    // sale.created carries the reserved-nullable functional/commission keys
    // PRESENT (toHaveProperty — so a refactor can't silently drop them); a
    // payment.received was emitted per tender.
    const saleEvents = await withTenant(db, ORG, (tx) =>
      tx
        .select()
        .from(schema.outboxEvent)
        .where(
          and(
            eq(schema.outboxEvent.type, "sale.created"),
            eq(schema.outboxEvent.tenantId, ORG)
          )
        )
    );
    const evt = saleEvents.at(-1)?.payload as Record<string, unknown>;
    for (const key of [
      "functionalCurrency",
      "fxRateToFunctional",
      "commissionAccrualPolicy",
      "commissionMinor",
      "taxBreakdown",
      "tenders",
      "lines",
      "offline",
    ]) {
      expect(evt).toHaveProperty(key);
    }
    const payEvents = await withTenant(db, ORG, (tx) =>
      tx
        .select()
        .from(schema.outboxEvent)
        .where(
          and(
            eq(schema.outboxEvent.type, "payment.received"),
            eq(schema.outboxEvent.tenantId, ORG)
          )
        )
    );
    expect(payEvents.length).toBeGreaterThan(0);

    // Idempotent replay: same key ⇒ same sale, valuation NOT applied twice.
    const replay = await call(
      appRouter.pos.createSale,
      {
        idempotencyKey: "msp-1",
        lines: [
          { productId: avcoProduct.id, qty: 2, skuId: avcoSku.id },
          { productId: fifoProduct.id, qty: 1, skuId: fifoSku.id },
        ],
        locationId: location.id,
        tenders: [{ amountMinor: 5000, currency: "USD", method: "cash" }],
      },
      admin
    );
    expect(replay.saleId).toBe(sale.saleId);
    const avcoAfter = await withTenant(db, ORG, (tx) =>
      tx
        .select()
        .from(schema.avgCost)
        .where(eq(schema.avgCost.skuId, avcoSku.id))
    );
    expect(avcoAfter.at(0)?.qtyOnHand).toBe(3);
  });

  it("MSP: rejects a line with no skuId (#8/INV-P4-8), underpayment, card-overpay-tiny-cash change, and non-sellable location (INV-P4-7)", async () => {
    const admin = { context: makeCtx(ADMIN, ORG) };
    const company = await call(
      appRouter.company.create,
      { name: "MSPGuards" },
      admin
    );
    const location = await call(
      appRouter.location.create,
      { companyId: company.id, name: "GuardStore", type: "store" },
      admin
    );
    const product = await call(
      appRouter.product.create,
      { currency: "USD", name: "G", priceMinor: 500, sku: "MSP-G" },
      admin
    );
    const sku = await call(
      appRouter.catalog.skuCreate,
      { code: "MSP-G-EA", productId: product.id },
      admin
    );

    // (a) A sale line with NO skuId is rejected (skuId is universally required —
    // the #8 fix; a product-only line has no valuation cell). Cast past the type
    // to exercise the runtime (Zod) rejection.
    await expect(
      call(
        appRouter.pos.createSale,
        {
          idempotencyKey: "g-nosku",
          lines: [
            { productId: product.id, qty: 1 } as unknown as {
              productId: string;
              qty: number;
              skuId: string;
            },
          ],
          locationId: location.id,
          tenders: [{ amountMinor: 500, currency: "USD", method: "cash" }],
        },
        admin
      )
    ).rejects.toThrow();

    // (b) Underpayment: tender 100 < total 500 → reject.
    await expect(
      call(
        appRouter.pos.createSale,
        {
          idempotencyKey: "g-under",
          lines: [{ productId: product.id, qty: 1, skuId: sku.id }],
          locationId: location.id,
          tenders: [{ amountMinor: 100, currency: "USD", method: "cash" }],
        },
        admin
      )
    ).rejects.toThrow();

    // (c) Change exceeds cash tendered (card 2000 + cash 1, total 500 → change
    // 1501 > cash 1) → reject; impossible negative settled can never be written.
    await expect(
      call(
        appRouter.pos.createSale,
        {
          idempotencyKey: "g-overcard",
          lines: [{ productId: product.id, qty: 1, skuId: sku.id }],
          locationId: location.id,
          tenders: [
            { amountMinor: 2000, currency: "USD", method: "card" },
            { amountMinor: 1, currency: "USD", method: "cash" },
          ],
        },
        admin
      )
    ).rejects.toThrow();

    // (d) Non-sellable location → reject. Flip isSellable (the location.create
    // router doesn't expose it; sellability is set by location type/flags).
    await withTenant(db, ORG, (tx) =>
      tx
        .update(schema.location)
        .set({ isSellable: false })
        .where(eq(schema.location.id, location.id))
    );
    await expect(
      call(
        appRouter.pos.createSale,
        {
          idempotencyKey: "g-sellable",
          lines: [{ productId: product.id, qty: 1, skuId: sku.id }],
          locationId: location.id,
          tenders: [{ amountMinor: 500, currency: "USD", method: "cash" }],
        },
        admin
      )
    ).rejects.toThrow();
  });

  it("MSP: a sale line referencing another tenant's SKU is rejected (H1 — FK checks bypass RLS)", async () => {
    const admin = { context: makeCtx(ADMIN, ORG) };
    const adminB = { context: makeCtx(ADMIN_B, ORG_B) };
    // Tenant B owns a product+sku.
    const productB = await call(
      appRouter.product.create,
      { currency: "USD", name: "BProd", priceMinor: 100, sku: "B-XT" },
      adminB
    );
    const skuB = await call(
      appRouter.catalog.skuCreate,
      { code: "B-XT-EA", productId: productB.id },
      adminB
    );
    // Tenant A: own location + product, but the line points at tenant B's sku.
    const companyA = await call(
      appRouter.company.create,
      { name: "ACo" },
      admin
    );
    const locationA = await call(
      appRouter.location.create,
      { companyId: companyA.id, name: "AStore", type: "store" },
      admin
    );
    const productA = await call(
      appRouter.product.create,
      { currency: "USD", name: "AProd", priceMinor: 100, sku: "A-XT" },
      admin
    );
    await expect(
      call(
        appRouter.pos.createSale,
        {
          idempotencyKey: "xt-sku",
          lines: [{ productId: productA.id, qty: 1, skuId: skuB.id }],
          locationId: locationA.id,
          tenders: [{ amountMinor: 100, currency: "USD", method: "cash" }],
        },
        admin
      )
    ).rejects.toThrow();
  });

  // ── Phase-4 Commit 3 — Returns / Refunds / Voids / Exchanges ────────────────
  // The #8 write-path gate for returns: drive the ROUTER (createSale → refund/
  // void) and assert valuation actually MOVES — the restock lands EXACTLY the
  // value the sale removed back into the cell — not just that a service works.
  it("refund restocks EXACTLY the value the sale removed (AVCO + FIFO, #8)", async () => {
    const admin = { context: makeCtx(ADMIN, ORG) };
    const company = await call(
      appRouter.company.create,
      { name: "Ret-Co" },
      admin
    );
    const location = await call(
      appRouter.location.create,
      { companyId: company.id, name: "Ret-Store", type: "store" },
      admin
    );
    const fifoCategory = await call(
      appRouter.catalog.categoryCreate,
      { costingMethod: "fifo", name: "Ret-FIFO-Cat" },
      admin
    );
    const avcoProduct = await call(
      appRouter.product.create,
      { currency: "USD", name: "Ret-AVCO", priceMinor: 500, sku: "RET-AVCO" },
      admin
    );
    const fifoProduct = await call(
      appRouter.product.create,
      {
        categoryId: fifoCategory.id,
        currency: "USD",
        name: "Ret-FIFO",
        priceMinor: 500,
        sku: "RET-FIFO",
      },
      admin
    );
    const avcoSku = await call(
      appRouter.catalog.skuCreate,
      { code: "RET-AVCO-EA", productId: avcoProduct.id },
      admin
    );
    const fifoSku = await call(
      appRouter.catalog.skuCreate,
      { code: "RET-FIFO-EA", productId: fifoProduct.id },
      admin
    );
    // AVCO: 5 @ 100 = 500. FIFO: two layers 1 @ 33 + 2 @ 34 = 101 (a multi-layer
    // odd value that forces the refund's value-EXACT remainder split).
    await call(
      appRouter.inventory.receive,
      {
        costCurrency: "USD",
        costScale: 2,
        locationId: location.id,
        productId: avcoProduct.id,
        qty: 5,
        skuId: avcoSku.id,
        unitCostMinor: 100,
      },
      admin
    );
    await call(
      appRouter.inventory.receive,
      {
        costCurrency: "USD",
        costScale: 2,
        locationId: location.id,
        productId: fifoProduct.id,
        qty: 1,
        skuId: fifoSku.id,
        unitCostMinor: 33,
      },
      admin
    );
    await call(
      appRouter.inventory.receive,
      {
        costCurrency: "USD",
        costScale: 2,
        locationId: location.id,
        productId: fifoProduct.id,
        qty: 2,
        skuId: fifoSku.id,
        unitCostMinor: 34,
      },
      admin
    );
    // Sell 3 of each. AVCO cogs = 300; FIFO cogs = 33 + 2·34 = 101.
    const sale = await call(
      appRouter.pos.createSale,
      {
        idempotencyKey: "ret-sale-1",
        lines: [
          { productId: avcoProduct.id, qty: 3, skuId: avcoSku.id },
          { productId: fifoProduct.id, qty: 3, skuId: fifoSku.id },
        ],
        locationId: location.id,
        tenders: [{ amountMinor: 3000, currency: "USD", method: "cash" }],
      },
      admin
    );
    // After the sale: AVCO qty 2 / value 200; FIFO qty 0 / value 0.
    const avcoAfterSale = await withTenant(db, ORG, (tx) =>
      tx
        .select()
        .from(schema.avgCost)
        .where(eq(schema.avgCost.skuId, avcoSku.id))
        .limit(1)
    );
    expect(avcoAfterSale.at(0)?.qtyOnHand).toBe(2);
    expect(avcoAfterSale.at(0)?.totalValueMinor).toBe(200);

    // Find the original sale lines (to reference originalSaleLineId).
    const origLines = await withTenant(db, ORG, (tx) =>
      tx
        .select()
        .from(schema.saleLine)
        .where(eq(schema.saleLine.saleId, sale.saleId))
    );
    const avcoLine = origLines.find((l) => l.skuId === avcoSku.id);
    const fifoLine = origLines.find((l) => l.skuId === fifoSku.id);
    expect(avcoLine?.cogsMinor).toBe(300);
    expect(fifoLine?.cogsMinor).toBe(101);

    // Refund 2 of 3 on each. restockedValue = mulDivRound(cogs, 2, 3, half_even):
    // AVCO → round(600/3)=200; FIFO → round(202/3)=67 (odd ⇒ remainder split).
    const refund = await call(
      appRouter.pos.refund,
      {
        idempotencyKey: "ret-refund-1",
        lines: [
          { originalSaleLineId: avcoLine?.id ?? "", qty: 2 },
          { originalSaleLineId: fifoLine?.id ?? "", qty: 2 },
        ],
        originalSaleId: sale.saleId,
        refundReason: "customer changed mind",
        tenders: [{ amountMinor: 2000, currency: "USD", method: "cash" }],
      },
      admin
    );
    expect(refund.totalMinor).toBe(-2000);

    // #8: valuation MOVED via the router. AVCO regains 200 (qty 2→4, value 200→400).
    const avcoAfterRefund = await withTenant(db, ORG, (tx) =>
      tx
        .select()
        .from(schema.avgCost)
        .where(eq(schema.avgCost.skuId, avcoSku.id))
        .limit(1)
    );
    expect(avcoAfterRefund.at(0)?.qtyOnHand).toBe(4);
    expect(avcoAfterRefund.at(0)?.totalValueMinor).toBe(400);

    // FIFO: the restock landed EXACTLY 67 across a 2-layer split (1@33 + 1@34),
    // qty 0→2, value 0→67 — value-exact, anchor path exercised.
    const fifoLayers = await withTenant(db, ORG, (tx) =>
      tx
        .select()
        .from(schema.valuationLayer)
        .where(eq(schema.valuationLayer.skuId, fifoSku.id))
    );
    const fifoQty = fifoLayers.reduce((s, l) => s + Number(l.qtyRemaining), 0);
    const fifoValue = fifoLayers.reduce(
      (s, l) => s + Number(l.qtyRemaining) * Number(l.unitCostMinor),
      0
    );
    expect(fifoQty).toBe(2);
    expect(fifoValue).toBe(67);

    // The return line stamps the derived restock value (event-map HIGH-4).
    const retLines = await withTenant(db, ORG, (tx) =>
      tx
        .select()
        .from(schema.saleLine)
        .where(eq(schema.saleLine.saleId, refund.saleId))
    );
    expect(retLines.find((l) => l.skuId === avcoSku.id)?.cogsMinor).toBe(200);
    expect(retLines.find((l) => l.skuId === fifoSku.id)?.cogsMinor).toBe(67);
    for (const l of retLines) {
      expect(l.originalSaleLineId).toBeTruthy();
    }

    // sale.refunded event carries the locked contract shape.
    const refundEvents = await withTenant(db, ORG, (tx) =>
      tx
        .select()
        .from(schema.outboxEvent)
        .where(eq(schema.outboxEvent.type, "sale.refunded"))
    );
    const payload = refundEvents.at(-1)?.payload as Record<string, unknown>;
    expect(payload).toHaveProperty("originalSaleId", sale.saleId);
    expect(payload).toHaveProperty("exchangeGroupId", null);
    expect(payload).toHaveProperty("commissionClawbackMinor", null);
    expect(payload).toHaveProperty("functionalCurrency", null);
    const evLines = payload.lines as Record<string, unknown>[];
    expect(evLines[0]).toHaveProperty("restockedValueMinor");
    expect(evLines[0]).toHaveProperty("originalSaleLineId");

    // Over-refund the remaining 1 + 1 more (2 > 1 left) → rejected (TOCTOU guard).
    await expect(
      call(
        appRouter.pos.refund,
        {
          idempotencyKey: "ret-overrefund",
          lines: [{ originalSaleLineId: avcoLine?.id ?? "", qty: 2 }],
          originalSaleId: sale.saleId,
          tenders: [{ amountMinor: 1000, currency: "USD", method: "cash" }],
        },
        admin
      )
    ).rejects.toThrow();
  });

  it("voids a fresh sale — full restock, status void, single winner under a race", async () => {
    const admin = { context: makeCtx(ADMIN, ORG) };
    const company = await call(
      appRouter.company.create,
      { name: "Void-Co" },
      admin
    );
    const location = await call(
      appRouter.location.create,
      { companyId: company.id, name: "Void-Store", type: "store" },
      admin
    );
    const product = await call(
      appRouter.product.create,
      { currency: "USD", name: "Void-P", priceMinor: 500, sku: "VOID-P" },
      admin
    );
    const sku = await call(
      appRouter.catalog.skuCreate,
      { code: "VOID-EA", productId: product.id },
      admin
    );
    await call(
      appRouter.inventory.receive,
      {
        costCurrency: "USD",
        costScale: 2,
        locationId: location.id,
        productId: product.id,
        qty: 5,
        skuId: sku.id,
        unitCostMinor: 100,
      },
      admin
    );
    const sale = await call(
      appRouter.pos.createSale,
      {
        idempotencyKey: "void-sale-1",
        lines: [{ productId: product.id, qty: 3, skuId: sku.id }],
        locationId: location.id,
        tenders: [{ amountMinor: 1500, currency: "USD", method: "cash" }],
      },
      admin
    );
    // On-hand after sale: 5 − 3 = 2.
    const onHandAfterSale = await withTenant(db, ORG, (tx) =>
      services.stockOnHand(tx, location.id, product.id)
    );
    expect(onHandAfterSale).toBe(2);

    // Two concurrent voids of the SAME sale — exactly ONE wins (FOR UPDATE).
    const results = await Promise.allSettled([
      call(
        appRouter.pos.void,
        { idempotencyKey: "void-1", saleId: sale.saleId, voidReason: "error" },
        admin
      ),
      call(
        appRouter.pos.void,
        { idempotencyKey: "void-2", saleId: sale.saleId, voidReason: "error" },
        admin
      ),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);

    // Restocked exactly ONCE: on-hand back to 5, not 8.
    const onHandAfterVoid = await withTenant(db, ORG, (tx) =>
      services.stockOnHand(tx, location.id, product.id)
    );
    expect(onHandAfterVoid).toBe(5);

    const voided = await withTenant(db, ORG, (tx) =>
      tx
        .select()
        .from(schema.sale)
        .where(eq(schema.sale.id, sale.saleId))
        .limit(1)
    );
    expect(voided.at(0)?.status).toBe("void");

    const voidEvents = await withTenant(db, ORG, (tx) =>
      tx
        .select()
        .from(schema.outboxEvent)
        .where(eq(schema.outboxEvent.type, "sale.voided"))
    );
    const vp = voidEvents.at(-1)?.payload as Record<string, unknown>;
    expect(vp).toHaveProperty("originalSaleId", sale.saleId);
    expect(vp).toHaveProperty("voidReason", "error");
  });

  it("exchange decomposes into a linked return + sale sharing exchangeGroupId", async () => {
    const admin = { context: makeCtx(ADMIN, ORG) };
    const company = await call(
      appRouter.company.create,
      { name: "Exch-Co" },
      admin
    );
    const location = await call(
      appRouter.location.create,
      { companyId: company.id, name: "Exch-Store", type: "store" },
      admin
    );
    const product = await call(
      appRouter.product.create,
      { currency: "USD", name: "Exch-P", priceMinor: 500, sku: "EXCH-P" },
      admin
    );
    const sku = await call(
      appRouter.catalog.skuCreate,
      { code: "EXCH-EA", productId: product.id },
      admin
    );
    await call(
      appRouter.inventory.receive,
      {
        costCurrency: "USD",
        costScale: 2,
        locationId: location.id,
        productId: product.id,
        qty: 10,
        skuId: sku.id,
        unitCostMinor: 100,
      },
      admin
    );
    const sale = await call(
      appRouter.pos.createSale,
      {
        idempotencyKey: "exch-sale-1",
        lines: [{ productId: product.id, qty: 2, skuId: sku.id }],
        locationId: location.id,
        tenders: [{ amountMinor: 1000, currency: "USD", method: "cash" }],
      },
      admin
    );
    const origLines = await withTenant(db, ORG, (tx) =>
      tx
        .select()
        .from(schema.saleLine)
        .where(eq(schema.saleLine.saleId, sale.saleId))
    );
    const exchange = await call(
      appRouter.pos.exchange,
      {
        idempotencyKey: "exch-1",
        newLines: [{ productId: product.id, qty: 1, skuId: sku.id }],
        originalSaleId: sale.saleId,
        returnLines: [
          { originalSaleLineId: origLines.at(0)?.id ?? "", qty: 1 },
        ],
        tenders: [{ amountMinor: 500, currency: "USD", method: "cash" }],
      },
      admin
    );
    expect(exchange.exchangeGroupId).toBeTruthy();

    // Both legs carry the SAME exchangeGroupId (event-map "Exchange flow").
    const refundDoc = await withTenant(db, ORG, (tx) =>
      tx
        .select()
        .from(schema.sale)
        .where(eq(schema.sale.id, exchange.refund.saleId))
        .limit(1)
    );
    const saleDoc = await withTenant(db, ORG, (tx) =>
      tx
        .select()
        .from(schema.sale)
        .where(eq(schema.sale.id, exchange.sale.saleId))
        .limit(1)
    );
    expect(refundDoc.at(0)?.exchangeGroupId).toBe(exchange.exchangeGroupId);
    expect(saleDoc.at(0)?.exchangeGroupId).toBe(exchange.exchangeGroupId);
    expect(refundDoc.at(0)?.saleType).toBe("return");
    expect(saleDoc.at(0)?.saleType).toBe("sale");

    // Net stock: started 10, sold 2 (→8), returned 1 (→9), sold 1 new (→8).
    const onHand = await withTenant(db, ORG, (tx) =>
      services.stockOnHand(tx, location.id, product.id)
    );
    expect(onHand).toBe(8);
  });

  // H1 — a refund cannot reach across tenants. Tenant B owns a sale; Tenant A
  // tries to refund it. RLS hides B's sale from A's FOR UPDATE load (NOT_FOUND),
  // and the self-referential composite FK DB-guards originalSaleLineId too.
  it("rejects a cross-tenant refund (H1 — original sale belongs to another tenant)", async () => {
    const admin = { context: makeCtx(ADMIN, ORG) };
    const adminB = { context: makeCtx(ADMIN_B, ORG_B) };
    const companyB = await call(
      appRouter.company.create,
      { name: "H1R-CoB" },
      adminB
    );
    const locationB = await call(
      appRouter.location.create,
      { companyId: companyB.id, name: "H1R-StoreB", type: "store" },
      adminB
    );
    const productB = await call(
      appRouter.product.create,
      { currency: "USD", name: "H1R-PB", priceMinor: 500, sku: "H1R-PB" },
      adminB
    );
    const skuB = await call(
      appRouter.catalog.skuCreate,
      { code: "H1R-EAB", productId: productB.id },
      adminB
    );
    await call(
      appRouter.inventory.receive,
      {
        costCurrency: "USD",
        costScale: 2,
        locationId: locationB.id,
        productId: productB.id,
        qty: 5,
        skuId: skuB.id,
        unitCostMinor: 100,
      },
      adminB
    );
    const saleB = await call(
      appRouter.pos.createSale,
      {
        idempotencyKey: "h1r-sale-b",
        lines: [{ productId: productB.id, qty: 2, skuId: skuB.id }],
        locationId: locationB.id,
        tenders: [{ amountMinor: 1000, currency: "USD", method: "cash" }],
      },
      adminB
    );
    const bLines = await withTenant(db, ORG_B, (tx) =>
      tx
        .select()
        .from(schema.saleLine)
        .where(eq(schema.saleLine.saleId, saleB.saleId))
    );
    // Tenant A refunds tenant B's sale → rejected.
    await expect(
      call(
        appRouter.pos.refund,
        {
          idempotencyKey: "h1r-refund",
          lines: [{ originalSaleLineId: bLines.at(0)?.id ?? "", qty: 1 }],
          originalSaleId: saleB.saleId,
          tenders: [{ amountMinor: 500, currency: "USD", method: "cash" }],
        },
        admin
      )
    ).rejects.toThrow();
    // And tenant A cannot void it either.
    await expect(
      call(
        appRouter.pos.void,
        { idempotencyKey: "h1r-void", saleId: saleB.saleId },
        admin
      )
    ).rejects.toThrow();
  });
});
