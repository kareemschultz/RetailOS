// @vitest-environment node
// Node env (not happy-dom): @t3-oss/env-core blocks server env vars when a
// `window` global is present, which happy-dom provides.
import { eq, sql } from "drizzle-orm";
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
        await tx.delete(schema.saleLine);
        await tx.delete(schema.invoice);
        await tx.delete(schema.sale);
        await tx.delete(schema.stockCountLine);
        await tx.delete(schema.stockCount);
        await tx.delete(schema.avgCost);
        await tx.delete(schema.valuationLayer);
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
    await call(
      appRouter.inventory.receive,
      { locationId: location.id, productId: product.id, qty: 10 },
      admin
    );

    const sale1 = await call(
      appRouter.pos.createSale,
      {
        locationId: location.id,
        idempotencyKey: "e2e-key",
        lines: [{ productId: product.id, qty: 3 }],
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
        lines: [{ productId: product.id, qty: 3 }],
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
    // Opening balance of 5 into the (location, product) cell — product-keyed, so
    // it lines up with the sale deduction (no skuId).
    await withTenant(db, ORG, (tx) =>
      services.appendStockMovement(
        tx,
        { tenantId: ORG },
        {
          locationId: location.id,
          productId: product.id,
          movementType: "receipt",
          qtyDelta: 5,
        }
      )
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
        lines: [{ productId: product.id, qty: 3 }],
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
        lines: [{ productId: product.id, qty: 10 }],
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
});
