// @vitest-environment node
// Node env (not happy-dom): @t3-oss/env-core blocks server env vars when a
// `window` global is present, which happy-dom provides.
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
});
