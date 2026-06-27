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
const STORED_VALUE_TENDER_RESERVED_RE = /Stored-value tenders are reserved/;
const UNDERPAYMENT_RE = /Underpayment/;

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
        // Cash control (Commit 4): cash_movement → shift → location/company.
        await tx.delete(schema.cashMovement);
        await tx.delete(schema.shift);
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
    const receipt = await call(
      appRouter.pos.receipt,
      { saleId: sale.saleId },
      admin
    );
    expect(receipt).toMatchObject({ receiptVersion: 1, schemaVersion: 1 });
    expect(receipt.totals).toMatchObject({
      discountMinor: 0,
      subtotalMinor: 4000,
      taxMinor: 0,
      totalMinor: 4000,
    });
    expect(receipt.payments.summary).toMatchObject({
      balanceDueMinor: 0,
      changeMinor: 1000,
      settledMinor: 4000,
      tenderedMinor: 5000,
    });
    expect(receipt.lines).toHaveLength(2);
    expect(receipt.lines.every((line) => "lineTotalMinor" in line)).toBe(true);
    expect(receipt.fiscal).toMatchObject({
      documentId: null,
      fiscalNumber: null,
      provider: null,
      qrPayload: null,
    });
    await expect(
      call(
        appRouter.pos.receipt,
        { saleId: sale.saleId },
        { context: makeCtx(ADMIN_B, ORG_B) }
      )
    ).rejects.toThrow();

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
    const evt = saleEvents
      .map((event) => event.payload as Record<string, unknown>)
      .find((payload) => payload.saleId === sale.saleId);
    expect(evt).toBeTruthy();
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
    const payEvt = payEvents
      .map((event) => event.payload as Record<string, unknown>)
      .find((payload) => payload.saleId === sale.saleId);
    expect(payEvt).toBeTruthy();
    expect(payEvt).toMatchObject({
      amountFunctionalMinor: null,
      amountMinor: 5000,
      currency: "USD",
      fxRateUsed: null,
      paymentId: tenders.at(0)?.id,
      saleId: sale.saleId,
      scale: 2,
      sourceId: sale.saleId,
      sourceType: "sale",
      tenderId: tenders.at(0)?.id,
      tenderType: "cash",
    });
    for (const key of [
      "amountMinor",
      "currency",
      "scale",
      "amountFunctionalMinor",
      "fxRateUsed",
      "occurredAt",
      "paymentId",
      "saleId",
      "tenderId",
      "tenderType",
    ]) {
      expect(payEvt).toHaveProperty(key);
    }

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

    const splitSale = await call(
      appRouter.pos.createSale,
      {
        idempotencyKey: "msp-split",
        lines: [{ productId: avcoProduct.id, qty: 1, skuId: avcoSku.id }],
        locationId: location.id,
        tenders: [
          { amountMinor: 600, currency: "USD", method: "card" },
          { amountMinor: 400, currency: "USD", method: "mobile_money" },
        ],
      },
      admin
    );
    expect(splitSale.totalMinor).toBe(1000);
    const splitReceipt = await call(
      appRouter.pos.receipt,
      { saleId: splitSale.saleId },
      admin
    );
    expect(splitReceipt.payments.items.map((p) => p.method).sort()).toEqual([
      "card",
      "mobile_money",
    ]);
    expect(splitReceipt.payments.summary).toMatchObject({
      balanceDueMinor: 0,
      changeMinor: 0,
      settledMinor: 1000,
      tenderedMinor: 1000,
    });
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

    // (d) Stored-value / voucher tender is a reserved seam until the liability
    // ledger lands — it must not settle a sale silently.
    await expect(
      call(
        appRouter.pos.createSale,
        {
          idempotencyKey: "g-store-credit",
          lines: [{ productId: product.id, qty: 1, skuId: sku.id }],
          locationId: location.id,
          tenders: [
            { amountMinor: 500, currency: "USD", method: "store_credit" },
          ],
        },
        admin
      )
    ).rejects.toThrow(STORED_VALUE_TENDER_RESERVED_RE);

    // (e) Non-sellable location → reject. Flip isSellable (the location.create
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

  // ── Phase-4 Commit 3 — Returns / Refunds / Voids (exchange deferred) ────────
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

    await expect(
      call(
        appRouter.pos.refund,
        {
          idempotencyKey: "ret-refund-store-credit-blocked",
          lines: [{ originalSaleLineId: avcoLine?.id ?? "", qty: 1 }],
          originalSaleId: sale.saleId,
          refundReason: "blocked stored-value refund",
          tenders: [
            { amountMinor: 500, currency: "USD", method: "store_credit" },
          ],
        },
        admin
      )
    ).rejects.toThrow(STORED_VALUE_TENDER_RESERVED_RE);

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

  // Codex HIGH-1: two entries with the SAME originalSaleLineId in ONE request
  // must be SUMMED before the over-refund check. Otherwise each sees the same
  // `already=0` and both pass → over-refund + double-restock.
  it("aggregates duplicate originalSaleLineId in one request (Codex HIGH-1)", async () => {
    const admin = { context: makeCtx(ADMIN, ORG) };
    const company = await call(
      appRouter.company.create,
      { name: "Dup-Co" },
      admin
    );
    const location = await call(
      appRouter.location.create,
      { companyId: company.id, name: "Dup-Store", type: "store" },
      admin
    );
    const product = await call(
      appRouter.product.create,
      { currency: "USD", name: "Dup-P", priceMinor: 500, sku: "DUP-P" },
      admin
    );
    const sku = await call(
      appRouter.catalog.skuCreate,
      { code: "DUP-EA", productId: product.id },
      admin
    );
    await call(
      appRouter.inventory.receive,
      {
        costCurrency: "USD",
        costScale: 2,
        locationId: location.id,
        productId: product.id,
        qty: 3,
        skuId: sku.id,
        unitCostMinor: 100,
      },
      admin
    );
    // Sell 1 unit, then sell 3 on a second sale (the aggregation case).
    const sale1 = await call(
      appRouter.pos.createSale,
      {
        idempotencyKey: "dup-sale-1",
        lines: [{ productId: product.id, qty: 1, skuId: sku.id }],
        locationId: location.id,
        tenders: [{ amountMinor: 500, currency: "USD", method: "cash" }],
      },
      admin
    );
    const s1Line = (
      await withTenant(db, ORG, (tx) =>
        tx
          .select()
          .from(schema.saleLine)
          .where(eq(schema.saleLine.saleId, sale1.saleId))
      )
    ).at(0);
    // Two qty-1 entries on a qty-1 line → summed 2 > 1 → REJECTED (the bug would
    // let each independently pass).
    await expect(
      call(
        appRouter.pos.refund,
        {
          idempotencyKey: "dup-overrefund",
          lines: [
            { originalSaleLineId: s1Line?.id ?? "", qty: 1 },
            { originalSaleLineId: s1Line?.id ?? "", qty: 1 },
          ],
          originalSaleId: sale1.saleId,
          tenders: [{ amountMinor: 1000, currency: "USD", method: "cash" }],
        },
        admin
      )
    ).rejects.toThrow();

    // Legit aggregation: sell 3, refund with two qty-1 entries summing to 2 ≤ 3 →
    // EXACTLY ONE return line for that original (not two).
    const sale2 = await call(
      appRouter.pos.createSale,
      {
        idempotencyKey: "dup-sale-2",
        lines: [{ productId: product.id, qty: 2, skuId: sku.id }],
        locationId: location.id,
        tenders: [{ amountMinor: 1000, currency: "USD", method: "cash" }],
      },
      admin
    );
    const s2Line = (
      await withTenant(db, ORG, (tx) =>
        tx
          .select()
          .from(schema.saleLine)
          .where(eq(schema.saleLine.saleId, sale2.saleId))
      )
    ).at(0);
    const refund = await call(
      appRouter.pos.refund,
      {
        idempotencyKey: "dup-agg",
        lines: [
          { originalSaleLineId: s2Line?.id ?? "", qty: 1 },
          { originalSaleLineId: s2Line?.id ?? "", qty: 1 },
        ],
        originalSaleId: sale2.saleId,
        tenders: [{ amountMinor: 1000, currency: "USD", method: "cash" }],
      },
      admin
    );
    const retLines = await withTenant(db, ORG, (tx) =>
      tx
        .select()
        .from(schema.saleLine)
        .where(eq(schema.saleLine.saleId, refund.saleId))
    );
    expect(retLines.length).toBe(1);
    expect(retLines.at(0)?.qty).toBe(2);
  });

  // Codex HIGH-2: sequential partial refunds must restock EXACTLY the original
  // stamped cogsMinor — no per-refund rounding drift. cogsMinor=101 / qty=3 with
  // three qty-1 refunds: the buggy independent round gives 34+34+34=102; the
  // cumulative-difference split gives 34+33+34=101.
  it("conserves cogsMinor across sequential partial refunds (Codex HIGH-2)", async () => {
    const admin = { context: makeCtx(ADMIN, ORG) };
    const company = await call(
      appRouter.company.create,
      { name: "Drift-Co" },
      admin
    );
    const location = await call(
      appRouter.location.create,
      { companyId: company.id, name: "Drift-Store", type: "store" },
      admin
    );
    const product = await call(
      appRouter.product.create,
      { currency: "USD", name: "Drift-P", priceMinor: 500, sku: "DRIFT-P" },
      admin
    );
    const sku = await call(
      appRouter.catalog.skuCreate,
      { code: "DRIFT-EA", productId: product.id },
      admin
    );
    // AVCO cell of (qty 3, value 101): 1@33 + 2@34. Selling 3 stamps cogsMinor=101.
    await call(
      appRouter.inventory.receive,
      {
        costCurrency: "USD",
        costScale: 2,
        locationId: location.id,
        productId: product.id,
        qty: 1,
        skuId: sku.id,
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
        productId: product.id,
        qty: 2,
        skuId: sku.id,
        unitCostMinor: 34,
      },
      admin
    );
    const sale = await call(
      appRouter.pos.createSale,
      {
        idempotencyKey: "drift-sale",
        lines: [{ productId: product.id, qty: 3, skuId: sku.id }],
        locationId: location.id,
        tenders: [{ amountMinor: 1500, currency: "USD", method: "cash" }],
      },
      admin
    );
    const origLine = (
      await withTenant(db, ORG, (tx) =>
        tx
          .select()
          .from(schema.saleLine)
          .where(eq(schema.saleLine.saleId, sale.saleId))
      )
    ).at(0);
    expect(origLine?.cogsMinor).toBe(101);

    // Three sequential qty-1 refunds (separate requests). Each rounds against the
    // CUMULATIVE target, so the restocked values are 34, 33, 34 — summing to 101.
    const restockedEach: number[] = [];
    for (let i = 0; i < 3; i++) {
      const refund = await call(
        appRouter.pos.refund,
        {
          idempotencyKey: `drift-refund-${i}`,
          lines: [{ originalSaleLineId: origLine?.id ?? "", qty: 1 }],
          originalSaleId: sale.saleId,
          tenders: [{ amountMinor: 500, currency: "USD", method: "cash" }],
        },
        admin
      );
      const retLine = (
        await withTenant(db, ORG, (tx) =>
          tx
            .select()
            .from(schema.saleLine)
            .where(eq(schema.saleLine.saleId, refund.saleId))
        )
      ).at(0);
      restockedEach.push(Number(retLine?.cogsMinor));
    }
    expect(restockedEach).toEqual([34, 33, 34]);
    expect(restockedEach.reduce((a, b) => a + b, 0)).toBe(101);

    // The valuation cell holds EXACTLY the original removed value (101), not 102.
    const avco = await withTenant(db, ORG, (tx) =>
      tx
        .select()
        .from(schema.avgCost)
        .where(eq(schema.avgCost.skuId, sku.id))
        .limit(1)
    );
    expect(avco.at(0)?.qtyOnHand).toBe(3);
    expect(avco.at(0)?.totalValueMinor).toBe(101);
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

  // (pos.exchange is DEFERRED to a later commit — needs the stored-value seam
  // for excess credit. The exchangeGroupId column + reserved-nullable event
  // field stay; the sale.created assertion above proves the field is null.)

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

  // ─────────────────── Phase-4 Commit 4: configurable cash control ──────────

  // Seed a sellable location with one AVCO product/sku carrying stock, so a
  // cash sale can be attached to a shift. Returns ids used by the cash tests.
  async function seedCashFixture(tag: string) {
    const admin = { context: makeCtx(ADMIN, ORG) };
    const company = await call(
      appRouter.company.create,
      { name: `${tag}Co` },
      admin
    );
    const location = await call(
      appRouter.location.create,
      { companyId: company.id, name: `${tag}Store`, type: "store" },
      admin
    );
    const each = await call(
      appRouter.catalog.uomCreate,
      { code: `${tag}-EA`, name: "Each" },
      admin
    );
    const product = await call(
      appRouter.product.create,
      {
        baseUomId: each.id,
        costingMethod: "avco",
        currency: "USD",
        name: `${tag}P`,
        priceMinor: 2000,
        sku: `${tag}-P`,
      },
      admin
    );
    const sku = await call(
      appRouter.catalog.skuCreate,
      { baseUomId: each.id, code: `${tag}-P-EA`, productId: product.id },
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
    return { company, location, product, sku };
  }

  it("Commit 4: openShift creates a drawer; a second open on the same terminal is rejected", async () => {
    const admin = { context: makeCtx(ADMIN, ORG) };
    const { location } = await seedCashFixture("ShOpen");
    const opened = await call(
      appRouter.pos.openShift,
      {
        idempotencyKey: "sh-open-1",
        locationId: location.id,
        openingFloat: [{ amountMinor: 10_000, currency: "USD", scale: 2 }],
        terminalId: "T-OPEN-1",
      },
      admin
    );
    expect(opened.status).toBe("open");
    // Same terminal, still open → rejected (one open shift per terminal).
    await expect(
      call(
        appRouter.pos.openShift,
        {
          idempotencyKey: "sh-open-1b",
          locationId: location.id,
          openingFloat: [],
          terminalId: "T-OPEN-1",
        },
        admin
      )
    ).rejects.toThrow();
  });

  it("Commit 4: BLIND close computes expected + over/short EXACTLY (float + cash sale + pay-out)", async () => {
    const admin = { context: makeCtx(ADMIN, ORG) };
    const { location, product, sku } = await seedCashFixture("ShClose");
    const opened = await call(
      appRouter.pos.openShift,
      {
        idempotencyKey: "sh-close-open",
        locationId: location.id,
        openingFloat: [{ amountMinor: 10_000, currency: "USD", scale: 2 }],
        terminalId: "T-CLOSE-1",
      },
      admin
    );
    // A cash sale attached to the shift: 2 @ 2000 = 4000, paid 4000 cash (no change).
    await call(
      appRouter.pos.createSale,
      {
        idempotencyKey: "sh-close-sale",
        lines: [{ productId: product.id, qty: 2, skuId: sku.id }],
        locationId: location.id,
        shiftId: opened.shiftId,
        terminalId: "T-CLOSE-1",
        tenders: [{ amountMinor: 4000, currency: "USD", method: "cash" }],
      },
      admin
    );
    // A pay-out of 500 leaves the drawer.
    await call(
      appRouter.pos.cashMovement,
      {
        amountMinor: 500,
        currency: "USD",
        idempotencyKey: "sh-close-payout",
        scale: 2,
        shiftId: opened.shiftId,
        terminalId: "T-CLOSE-1",
        type: "pay_out",
      },
      admin
    );
    // Expected = 10000 float + 4000 cash sale − 500 pay-out = 13500.
    // Counted 13000 (blind) → over/short = 13000 − 13500 = −500 (short).
    const closed = await call(
      appRouter.pos.closeShift,
      {
        countedCash: [{ amountMinor: 13_000, currency: "USD", scale: 2 }],
        idempotencyKey: "sh-close-do",
        shiftId: opened.shiftId,
        terminalId: "T-CLOSE-1",
      },
      admin
    );
    expect(closed.status).toBe("closed");
    expect(closed.zReportNumber.startsWith("Z-")).toBe(true);
    const exp = closed.expectedCash.find((c) => c.currency === "USD");
    expect(exp?.amountMinor).toBe(13_500);
    const os = closed.overShort.find((c) => c.currency === "USD");
    expect(os?.amountMinor).toBe(-500);
    // shift.closed event carries the system-computed expected + over/short.
    const events = await withTenant(db, ORG, (tx) =>
      tx
        .select()
        .from(schema.outboxEvent)
        .where(eq(schema.outboxEvent.type, "shift.closed"))
    );
    expect(events.length).toBeGreaterThan(0);
  });

  it("Commit 4: shift_enforcement toggle — disabled ⇒ sale shiftId null; required ⇒ sale without an open shift rejected", async () => {
    const admin = { context: makeCtx(ADMIN, ORG) };
    const { location, product, sku } = await seedCashFixture("ShTog");
    // Location-level override: disabled → sale ignores any shiftId, stores null.
    await withTenant(db, ORG, (tx) =>
      tx
        .update(schema.location)
        .set({ shiftEnforcement: "disabled" })
        .where(eq(schema.location.id, location.id))
    );
    const sale = await call(
      appRouter.pos.createSale,
      {
        idempotencyKey: "tog-disabled",
        // A bogus shiftId is ignored entirely when disabled.
        lines: [{ productId: product.id, qty: 1, skuId: sku.id }],
        locationId: location.id,
        shiftId: "00000000-0000-0000-0000-000000000000",
        tenders: [{ amountMinor: 2000, currency: "USD", method: "cash" }],
      },
      admin
    );
    const saleRow = await withTenant(db, ORG, (tx) =>
      tx.select().from(schema.sale).where(eq(schema.sale.id, sale.saleId))
    );
    expect(saleRow.at(0)?.shiftId).toBeNull();
    // Now require an open shift; a sale with none is rejected.
    await withTenant(db, ORG, (tx) =>
      tx
        .update(schema.location)
        .set({ shiftEnforcement: "required" })
        .where(eq(schema.location.id, location.id))
    );
    await expect(
      call(
        appRouter.pos.createSale,
        {
          idempotencyKey: "tog-required",
          lines: [{ productId: product.id, qty: 1, skuId: sku.id }],
          locationId: location.id,
          tenders: [{ amountMinor: 2000, currency: "USD", method: "cash" }],
        },
        admin
      )
    ).rejects.toThrow();
  });

  it("Commit 4: concurrent closeShift — exactly one winner (FOR UPDATE)", async () => {
    const admin = { context: makeCtx(ADMIN, ORG) };
    const { location } = await seedCashFixture("ShRace");
    const opened = await call(
      appRouter.pos.openShift,
      {
        idempotencyKey: "race-open",
        locationId: location.id,
        openingFloat: [{ amountMinor: 5000, currency: "USD", scale: 2 }],
        terminalId: "T-RACE-1",
      },
      admin
    );
    // DIFFERENT idempotency keys → both run concurrently (not collapsed); the
    // FOR UPDATE lock serializes them and exactly one close commits.
    const results = await Promise.allSettled([
      call(
        appRouter.pos.closeShift,
        {
          countedCash: [{ amountMinor: 5000, currency: "USD", scale: 2 }],
          idempotencyKey: "race-close-a",
          shiftId: opened.shiftId,
          terminalId: "T-RACE-1",
        },
        admin
      ),
      call(
        appRouter.pos.closeShift,
        {
          countedCash: [{ amountMinor: 5000, currency: "USD", scale: 2 }],
          idempotencyKey: "race-close-b",
          shiftId: opened.shiftId,
          terminalId: "T-RACE-1",
        },
        admin
      ),
    ]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    expect(fulfilled.length).toBe(1);
  });

  it("Commit 4: cross-tenant shift access is rejected (H1)", async () => {
    const adminB = { context: makeCtx(ADMIN_B, ORG_B) };
    const admin = { context: makeCtx(ADMIN, ORG) };
    // Tenant B opens a shift.
    const companyB = await call(
      appRouter.company.create,
      { name: "ShH1Co" },
      adminB
    );
    const locationB = await call(
      appRouter.location.create,
      { companyId: companyB.id, name: "ShH1Store", type: "store" },
      adminB
    );
    const openedB = await call(
      appRouter.pos.openShift,
      {
        idempotencyKey: "h1-open-b",
        locationId: locationB.id,
        openingFloat: [],
        terminalId: "T-H1-B",
      },
      adminB
    );
    // Tenant A cannot close or move cash on tenant B's shift (RLS read → none).
    await expect(
      call(
        appRouter.pos.closeShift,
        {
          countedCash: [],
          idempotencyKey: "h1-close-a",
          shiftId: openedB.shiftId,
          terminalId: "T-H1-A",
        },
        admin
      )
    ).rejects.toThrow();
    await expect(
      call(
        appRouter.pos.cashMovement,
        {
          amountMinor: 100,
          currency: "USD",
          idempotencyKey: "h1-mv-a",
          scale: 2,
          shiftId: openedB.shiftId,
          terminalId: "T-H1-A",
          type: "pay_in",
        },
        admin
      )
    ).rejects.toThrow();
  });

  it("Commit 4: a cash refund during a shift REDUCES expected cash (Codex HIGH-1)", async () => {
    const admin = { context: makeCtx(ADMIN, ORG) };
    const { location, product, sku } = await seedCashFixture("ShRef");
    const opened = await call(
      appRouter.pos.openShift,
      {
        idempotencyKey: "ref-open",
        locationId: location.id,
        openingFloat: [{ amountMinor: 10_000, currency: "USD", scale: 2 }],
        terminalId: "T-REF-1",
      },
      admin
    );
    const sale = await call(
      appRouter.pos.createSale,
      {
        idempotencyKey: "ref-sale",
        lines: [{ productId: product.id, qty: 2, skuId: sku.id }],
        locationId: location.id,
        shiftId: opened.shiftId,
        terminalId: "T-REF-1",
        tenders: [{ amountMinor: 4000, currency: "USD", method: "cash" }],
      },
      admin
    );
    const origLines = await withTenant(db, ORG, (tx) =>
      tx
        .select()
        .from(schema.saleLine)
        .where(eq(schema.saleLine.saleId, sale.saleId))
    );
    const line = origLines.at(0);
    // Cash refund of 1 @ 2000 at the SAME terminal → attaches to the open shift.
    await call(
      appRouter.pos.refund,
      {
        idempotencyKey: "ref-refund",
        lines: [{ originalSaleLineId: line?.id ?? "", qty: 1 }],
        originalSaleId: sale.saleId,
        terminalId: "T-REF-1",
        tenders: [{ amountMinor: 2000, currency: "USD", method: "cash" }],
      },
      admin
    );
    // Expected = 10000 float + 4000 cash sale − 2000 cash refund = 12000.
    const x = await call(
      appRouter.pos.xReport,
      { shiftId: opened.shiftId },
      admin
    );
    expect(x.expectedCash.find((c) => c.currency === "USD")?.amountMinor).toBe(
      12_000
    );
  });

  it("Commit 4: same currency / different scale stays in separate buckets (Codex HIGH-2)", async () => {
    const admin = { context: makeCtx(ADMIN, ORG) };
    const { location } = await seedCashFixture("ShScale");
    const opened = await call(
      appRouter.pos.openShift,
      {
        idempotencyKey: "scale-open",
        locationId: location.id,
        openingFloat: [{ amountMinor: 10_000, currency: "USD", scale: 2 }],
        terminalId: "T-SCALE-1",
      },
      admin
    );
    // A pay-in in USD at scale 0 (whole dollars) must NOT merge with scale-2.
    await call(
      appRouter.pos.cashMovement,
      {
        amountMinor: 10,
        currency: "USD",
        idempotencyKey: "scale-payin",
        scale: 0,
        shiftId: opened.shiftId,
        terminalId: "T-SCALE-1",
        type: "pay_in",
      },
      admin
    );
    const x = await call(
      appRouter.pos.xReport,
      { shiftId: opened.shiftId },
      admin
    );
    const usd = x.expectedCash.filter((c) => c.currency === "USD");
    expect(usd.length).toBe(2);
    expect(
      x.expectedCash.find((c) => c.currency === "USD" && c.scale === 2)
        ?.amountMinor
    ).toBe(10_000);
    expect(
      x.expectedCash.find((c) => c.currency === "USD" && c.scale === 0)
        ?.amountMinor
    ).toBe(10);
  });

  it("Commit 4: a sale cannot attach to another terminal's open shift (Codex HIGH-3)", async () => {
    const admin = { context: makeCtx(ADMIN, ORG) };
    const { location, product, sku } = await seedCashFixture("ShXTerm");
    const opened = await call(
      appRouter.pos.openShift,
      {
        idempotencyKey: "xterm-open",
        locationId: location.id,
        openingFloat: [],
        terminalId: "T-XA",
      },
      admin
    );
    await expect(
      call(
        appRouter.pos.createSale,
        {
          idempotencyKey: "xterm-sale",
          lines: [{ productId: product.id, qty: 1, skuId: sku.id }],
          locationId: location.id,
          shiftId: opened.shiftId,
          terminalId: "T-XB",
          tenders: [{ amountMinor: 2000, currency: "USD", method: "cash" }],
        },
        admin
      )
    ).rejects.toThrow();
  });

  it("Commit 4: cash movement / close from a different terminal is rejected (Codex HIGH-4)", async () => {
    const admin = { context: makeCtx(ADMIN, ORG) };
    const { location } = await seedCashFixture("ShXMv");
    const opened = await call(
      appRouter.pos.openShift,
      {
        idempotencyKey: "xmv-open",
        locationId: location.id,
        openingFloat: [],
        terminalId: "T-XMV-A",
      },
      admin
    );
    await expect(
      call(
        appRouter.pos.cashMovement,
        {
          amountMinor: 100,
          currency: "USD",
          idempotencyKey: "xmv-mv",
          scale: 2,
          shiftId: opened.shiftId,
          terminalId: "T-XMV-B",
          type: "drop",
        },
        admin
      )
    ).rejects.toThrow();
    await expect(
      call(
        appRouter.pos.closeShift,
        {
          countedCash: [],
          idempotencyKey: "xmv-close",
          shiftId: opened.shiftId,
          terminalId: "T-XMV-B",
        },
        admin
      )
    ).rejects.toThrow();
  });

  it("Commit 4: an invalid toggle value is rejected by the DB CHECK (Codex HIGH-5)", async () => {
    const { location } = await seedCashFixture("ShChk");
    await expect(
      withTenant(db, ORG, (tx) =>
        tx.execute(
          sql`UPDATE location SET shift_enforcement = 'requird' WHERE id = ${location.id}`
        )
      )
    ).rejects.toThrow();
  });

  it("Commit 4: sale.created carries the DB-resolved shiftId, not client input (Codex MEDIUM)", async () => {
    const admin = { context: makeCtx(ADMIN, ORG) };
    const { location, product, sku } = await seedCashFixture("ShEvt");
    // Disabled ⇒ the row stores shift_id=null even if the client sends a UUID;
    // the event must mirror the row, not echo the client's (cross-tenant) input.
    await withTenant(db, ORG, (tx) =>
      tx
        .update(schema.location)
        .set({ shiftEnforcement: "disabled" })
        .where(eq(schema.location.id, location.id))
    );
    const sale = await call(
      appRouter.pos.createSale,
      {
        idempotencyKey: "evt-sale",
        lines: [{ productId: product.id, qty: 1, skuId: sku.id }],
        locationId: location.id,
        shiftId: "00000000-0000-0000-0000-000000000000",
        terminalId: "T-EVT",
        tenders: [{ amountMinor: 2000, currency: "USD", method: "cash" }],
      },
      admin
    );
    const events = await withTenant(db, ORG, (tx) =>
      tx
        .select()
        .from(schema.outboxEvent)
        .where(eq(schema.outboxEvent.type, "sale.created"))
    );
    const mine = events.find(
      (e) => (e.payload as { saleId?: string }).saleId === sale.saleId
    );
    expect((mine?.payload as { shiftId: string | null }).shiftId).toBeNull();
  });

  // ── Frontend-readiness slice: POS item search + pre-sale quote ────────────
  // Seed a sellable product+sku+location with stock; returns the ids a POS line
  // needs. Setup runs as ADMIN (full perms); the assertions run as CASHIER.
  const seedSellable = async (suffix: string) => {
    const admin = { context: makeCtx(ADMIN, ORG) };
    const company = await call(
      appRouter.company.create,
      { name: `Co-${suffix}` },
      admin
    );
    const location = await call(
      appRouter.location.create,
      { companyId: company.id, name: `Store-${suffix}`, type: "store" },
      admin
    );
    const product = await call(
      appRouter.product.create,
      {
        sku: `FR-${suffix}`,
        name: `Prod ${suffix}`,
        priceMinor: 1000,
        currency: "USD",
      },
      admin
    );
    const sku = await call(
      appRouter.catalog.skuCreate,
      { code: `FR-${suffix}-EA`, productId: product.id },
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
        unitCostMinor: 500,
      },
      admin
    );
    return {
      admin,
      locationId: location.id,
      productId: product.id,
      skuId: sku.id,
    };
  };

  it("POS item search: a cashier finds sellable items, receives skuId, and matches a scanned barcode", async () => {
    const { admin, skuId } = await seedSellable("search");
    await call(
      appRouter.catalog.barcodeCreate,
      { skuId, value: "BC-SEARCH-001" },
      admin
    );
    const cashier = { context: makeCtx(CASHIER, ORG) };

    // By name.
    const byName = await call(
      appRouter.pos.itemSearch,
      { q: "Prod search" },
      cashier
    );
    const hit = byName.find((r) => r.skuId === skuId);
    expect(hit).toBeDefined();
    expect(hit?.skuId).toBe(skuId);
    expect(hit?.priceMinor).toBe(1000);
    expect(hit?.currency).toBe("USD");
    expect(hit?.scale).toBe(2);
    expect(hit?.sellable).toBe(true);
    expect(hit?.matchedBarcode).toBeNull();

    // By scanned barcode — exact match surfaces matchedBarcode.
    const byBarcode = await call(
      appRouter.pos.itemSearch,
      { q: "BC-SEARCH-001" },
      cashier
    );
    const scanned = byBarcode.find((r) => r.skuId === skuId);
    expect(scanned?.matchedBarcode).toBe("BC-SEARCH-001");
  });

  it("POS item search: a cashier is blocked from admin catalog.skuList and the DTO leaks no admin internals", async () => {
    const { productId } = await seedSellable("guard");
    const cashier = { context: makeCtx(CASHIER, ORG) };

    // Admin-only catalog API (products.create) — cashier forbidden.
    await expect(
      call(appRouter.catalog.skuList, { productId }, cashier)
    ).rejects.toThrow();

    // But the cashier-safe POS search works and exposes only POS fields.
    const results = await call(
      appRouter.pos.itemSearch,
      { q: "Prod guard" },
      cashier
    );
    expect(results.length).toBeGreaterThan(0);
    const row = results[0] as Record<string, unknown>;
    expect(row).not.toHaveProperty("costingMethod");
    expect(row).not.toHaveProperty("oversellPolicy");
    expect(row).not.toHaveProperty("returnCostingPolicy");
    expect(row).not.toHaveProperty("removalStrategy");
  });

  it("quote totals match pos.createSale for the same cart", async () => {
    const { locationId, productId, skuId } = await seedSellable("match");
    const cashier = { context: makeCtx(CASHIER, ORG) };
    const lines = [{ productId, qty: 3, skuId }];
    const tenders = [
      { amountMinor: 3000, currency: "USD", method: "cash" as const },
    ];

    const quote = await call(
      appRouter.pos.quote,
      { lines, locationId, tenders },
      cashier
    );
    expect(quote.totals.subtotalMinor).toBe(3000);
    expect(quote.totals.totalMinor).toBe(3000);
    expect(quote.payments.settleable).toBe(true);
    expect(quote.payments.summary.balanceDueMinor).toBe(0);
    expect(quote.payments.summary.changeMinor).toBe(0);

    // The committed sale charges exactly what the quote previewed.
    const sale = await call(
      appRouter.pos.createSale,
      { idempotencyKey: "match-key", lines, locationId, tenders },
      cashier
    );
    expect(quote.totals.totalMinor).toBe(sale.totalMinor);
  });

  it("quote computes cash change on overpayment", async () => {
    const { locationId, productId, skuId } = await seedSellable("change");
    const cashier = { context: makeCtx(CASHIER, ORG) };
    const quote = await call(
      appRouter.pos.quote,
      {
        lines: [{ productId, qty: 2, skuId }],
        locationId,
        tenders: [{ amountMinor: 2500, currency: "USD", method: "cash" }],
      },
      cashier
    );
    expect(quote.totals.totalMinor).toBe(2000);
    expect(quote.payments.settleable).toBe(true);
    expect(quote.payments.summary.changeMinor).toBe(500);
    expect(quote.payments.summary.balanceDueMinor).toBe(0);
  });

  it("quote flags underpayment consistently with createSale (which rejects it)", async () => {
    const { locationId, productId, skuId } = await seedSellable("under");
    const cashier = { context: makeCtx(CASHIER, ORG) };
    const lines = [{ productId, qty: 2, skuId }];
    const tenders = [
      { amountMinor: 1500, currency: "USD", method: "cash" as const },
    ];

    const quote = await call(
      appRouter.pos.quote,
      { lines, locationId, tenders },
      cashier
    );
    expect(quote.payments.settleable).toBe(false);
    expect(quote.payments.underpaid).toBe(true);
    expect(quote.payments.summary.balanceDueMinor).toBe(500);
    expect(quote.payments.settlementError).toMatch(UNDERPAYMENT_RE);

    // The same cart through createSale is rejected — the quote flag is honest.
    await expect(
      call(
        appRouter.pos.createSale,
        { idempotencyKey: "under-key", lines, locationId, tenders },
        cashier
      )
    ).rejects.toThrow();
  });

  it("quote creates no sale/invoice/tender/stock/outbox records", async () => {
    const { locationId, productId, skuId } = await seedSellable("noop");
    const cashier = { context: makeCtx(CASHIER, ORG) };
    const counts = () =>
      withTenant(db, ORG, async (tx) => ({
        invoices: (
          await tx.select({ id: schema.invoice.id }).from(schema.invoice)
        ).length,
        ledger: (
          await tx
            .select({ id: schema.stockLedger.id })
            .from(schema.stockLedger)
        ).length,
        outbox: (
          await tx
            .select({ id: schema.outboxEvent.id })
            .from(schema.outboxEvent)
        ).length,
        sales: (await tx.select({ id: schema.sale.id }).from(schema.sale))
          .length,
        tenders: (await tx.select({ id: schema.tender.id }).from(schema.tender))
          .length,
      }));

    const before = await counts();
    await call(
      appRouter.pos.quote,
      {
        lines: [{ productId, qty: 1, skuId }],
        locationId,
        tenders: [{ amountMinor: 1000, currency: "USD", method: "cash" }],
      },
      cashier
    );
    const after = await counts();
    expect(after).toEqual(before);
  });

  it("quote enforces tenant isolation — a cross-tenant sku is rejected", async () => {
    const { locationId, productId } = await seedSellable("iso");
    const cashier = { context: makeCtx(CASHIER, ORG) };

    // A sku that belongs to a DIFFERENT tenant (ORG_B).
    const adminB = { context: makeCtx(ADMIN_B, ORG_B) };
    const companyB = await call(
      appRouter.company.create,
      { name: "Co iso B" },
      adminB
    );
    const productB = await call(
      appRouter.product.create,
      { sku: "ISO-B", name: "Prod iso B", priceMinor: 1000, currency: "USD" },
      adminB
    );
    const skuB = await call(
      appRouter.catalog.skuCreate,
      { code: "ISO-B-EA", productId: productB.id },
      adminB
    );
    expect(companyB.id).toBeDefined();

    // ORG's cashier cannot quote against ORG_B's sku (RLS-scoped visibility).
    await expect(
      call(
        appRouter.pos.quote,
        { lines: [{ productId, qty: 1, skuId: skuB.id }], locationId },
        cashier
      )
    ).rejects.toThrow();
  });

  it("quote applies the same shift enforcement as createSale (rejects an invalid shiftId)", async () => {
    const { locationId, productId, skuId } = await seedSellable("shift");
    const cashier = { context: makeCtx(CASHIER, ORG) };
    const lines = [{ productId, qty: 1, skuId }];
    // A shiftId that does not resolve must be rejected by resolveSaleShift in
    // BOTH the quote and the sale — no green-preview-then-submit-rejection drift.
    const bogusShift = "00000000-0000-0000-0000-000000000000";
    await expect(
      call(
        appRouter.pos.quote,
        { lines, locationId, shiftId: bogusShift, terminalId: "T-shift" },
        cashier
      )
    ).rejects.toThrow();
    await expect(
      call(
        appRouter.pos.createSale,
        {
          idempotencyKey: "shift-drift-key",
          lines,
          locationId,
          shiftId: bogusShift,
          terminalId: "T-shift",
          tenders: [{ amountMinor: 1000, currency: "USD", method: "cash" }],
        },
        cashier
      )
    ).rejects.toThrow();
  });
});
