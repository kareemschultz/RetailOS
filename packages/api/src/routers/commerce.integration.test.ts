// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest";

import type { Context } from "../context";

// DB-gated (real Postgres + RLS roles). Skipped in the default no-DB gate.
const url = process.env.RLS_TEST_DATABASE_URL;

// Fixed test-org ids so the suite is hermetic (delete-then-insert by id).
const ORG_A = "org_commerce_test_a";
const ORG_B = "org_commerce_test_b";
const DOMAIN_A = "shop.acme.test";
const DOMAIN_B = "shop.beta.test";
const STAFF_ADMIN = "u_staff_admin_commerce_test";
const STAFF_WAREHOUSE = "u_staff_warehouse_commerce_test";
const STAFF_ADMIN_B = "u_staff_admin_b_commerce_test";
const NO_STOREFRONT_RE = /no storefront is configured/i;
const PUBLIC_DTO_LEAK_RE =
  /\b(id|productId|skuId|tenantId|costing|margin|cogs|objectKey|trackingMode|removalStrategy|returnCostingPolicy|oversellPolicy|expiryPolicy|createdBy|updatedBy|deletedAt)\b/i;
// Cart responses legitimately carry `id`/`customerId`/`lineId` — the client's
// bearer credentials for the cart (design §5/§10). Every OTHER internal field
// (product/sku ids, cost/policy columns) must still never appear.
const CART_NOT_FOUND_RE = /not found/i;
const CART_DTO_LEAK_RE =
  /\b(productId|skuId|tenantId|costing|margin|cogs|objectKey|trackingMode|removalStrategy|returnCostingPolicy|oversellPolicy|expiryPolicy|createdBy|updatedBy|deletedAt)\b/i;
const ORDER_NUMBER_RE = /^ORDER-/;
const SALE_NUMBER_RE = /^SALE-/;
const COMMERCE_UNAVAILABLE_RE = /COMMERCE_UNAVAILABLE/;
const MISSING_POS_CREATE_SALE_RE = /Missing permission: pos\.create_sale/;
const ORDER_NOT_FOUND_RE = /Order not found/;

// A storefront request context: anonymous (no session), carrying only the Host
// header the gateway resolves from.
function makeStorefrontCtx(host: string | null): Context {
  const headers = new Headers();
  if (host !== null) {
    headers.set("host", host);
  }
  return {
    auth: null,
    session: null,
    meta: {
      requestId: "req",
      correlationId: "corr",
      source: "storefront",
      deploymentMode: "saas",
    },
    headers,
  } as unknown as Context;
}

// A staff (Better Auth org member) request context — the admin/back-office
// path, distinct from the anonymous storefront path above.
function makeStaffCtx(userId: string, organizationId: string | null): Context {
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

describe.skipIf(!url)("Shopix storefront gateway (hostname → tenant)", () => {
  let call: typeof import("@orpc/server")["call"];
  let appRouter: typeof import("./index")["appRouter"];
  let db: typeof import("@RetailOS/db")["db"];
  let schema: typeof import("@RetailOS/db")["schema"];

  beforeAll(async () => {
    ({ call } = await import("@orpc/server"));
    ({ appRouter } = await import("./index"));
    const dbmod = await import("@RetailOS/db");
    db = dbmod.db;
    schema = dbmod.schema;

    // Hermetic: clear any prior rows for these fixed ids, then insert two tenants
    // with distinct storefront domains. Tenant-owned rows must be deleted through
    // withTenant before organization rows, or FK references can make reruns fail.
    const { eq, inArray } = await import("drizzle-orm");
    const { withTenant } = await import("@RetailOS/db");
    const cleanTenantCatalog = (tenantId: string) =>
      withTenant(db, tenantId, async (tx) => {
        await tx.delete(schema.membership);
        await tx.delete(schema.orderLine);
        await tx.delete(schema.order);
        await tx.delete(schema.cartLine);
        await tx.delete(schema.cart);
        await tx.delete(schema.customer);
        await tx.delete(schema.piiVaultField);
        await tx.delete(schema.piiVaultSubject);
        await tx.delete(schema.saleLine);
        await tx.delete(schema.tender);
        await tx.delete(schema.sale);
        await tx.delete(schema.valuationLayer);
        await tx.delete(schema.avgCost);
        await tx.delete(schema.stockLedger);
        await tx.delete(schema.productImage);
        await tx.delete(schema.barcode);
        await tx.delete(schema.sku);
        await tx.delete(schema.product);
        await tx.delete(schema.category);
        await tx.delete(schema.taxRate);
        await tx.delete(schema.location);
        await tx.delete(schema.company);
      });
    await cleanTenantCatalog(ORG_A);
    await cleanTenantCatalog(ORG_B);
    await db
      .delete(schema.organization)
      .where(inArray(schema.organization.id, [ORG_A, ORG_B]));
    // Also clear any org that already holds our test domains (unique constraint).
    await db
      .delete(schema.organization)
      .where(eq(schema.organization.storefrontDomain, DOMAIN_A));
    await db
      .delete(schema.organization)
      .where(eq(schema.organization.storefrontDomain, DOMAIN_B));
    await db.insert(schema.organization).values([
      {
        id: ORG_A,
        name: "Acme Store",
        slug: "acme-commerce-test",
        storefrontDomain: DOMAIN_A,
      },
      {
        id: ORG_B,
        name: "Beta Store",
        slug: "beta-commerce-test",
        storefrontDomain: DOMAIN_B,
      },
    ]);

    await withTenant(db, ORG_A, async (tx) => {
      await tx.insert(schema.taxRate).values({
        tenantId: ORG_A,
        code: "STD-VAT",
        name: "Standard VAT",
        kind: "standard",
        rateBps: 1400,
        createdBy: "seed-user",
        updatedBy: "seed-user",
      });
      const category = (
        await tx
          .insert(schema.category)
          .values({
            tenantId: ORG_A,
            name: "Public Category",
            code: "PUBLIC-CAT",
          })
          .returning()
      ).at(0);
      if (!category) {
        throw new Error("Failed to seed commerce category");
      }
      const product = (
        await tx
          .insert(schema.product)
          .values({
            tenantId: ORG_A,
            sku: "coffee-beans",
            name: "Coffee Beans",
            categoryId: category.id,
            priceMinor: 1250,
            currency: "USD",
            scale: 2,
            costingMethod: "fifo",
            trackingMode: "serial",
            oversellPolicy: "hard-block",
            createdBy: "seed-user",
            updatedBy: "seed-user",
          })
          .returning()
      ).at(0);
      if (!product) {
        throw new Error("Failed to seed commerce product");
      }
      await tx.insert(schema.sku).values({
        tenantId: ORG_A,
        productId: product.id,
        code: "COFFEE-250G",
        name: "250g bag",
        costingMethod: "avco",
        trackingMode: "lot",
        removalStrategy: "fefo",
        returnCostingPolicy: "link-strict",
        createdBy: "seed-user",
        updatedBy: "seed-user",
      });
      await tx.insert(schema.productImage).values({
        tenantId: ORG_A,
        productId: product.id,
        url: "https://cdn.example.test/coffee.jpg",
        objectKey: "tenant-a/private/coffee.jpg",
        altText: "Bag of coffee beans",
        isPrimary: true,
        sortOrder: 1,
        createdBy: "seed-user",
        updatedBy: "seed-user",
      });

      // Checkout fixture: a sellable location + a SEPARATE, simply-costed
      // product with real valued stock (coffee-beans is FIFO/mixed-method,
      // not worth entangling with checkout's cost assertions).
      const co = (
        await tx
          .insert(schema.company)
          .values({ tenantId: ORG_A, name: "Acme Fulfilment Co" })
          .returning()
      ).at(0);
      if (!co) {
        throw new Error("Failed to seed checkout company");
      }
      const loc = (
        await tx
          .insert(schema.location)
          .values({
            tenantId: ORG_A,
            companyId: co.id,
            name: "Acme Storefront Fulfilment",
            type: "store",
            isSellable: true,
          })
          .returning()
      ).at(0);
      if (!loc) {
        throw new Error("Failed to seed checkout location");
      }
      const widget = (
        await tx
          .insert(schema.product)
          .values({
            tenantId: ORG_A,
            sku: "checkout-widget",
            name: "Checkout Widget",
            priceMinor: 2000,
            currency: "USD",
            scale: 2,
            costingMethod: "avco",
            createdBy: "seed-user",
            updatedBy: "seed-user",
          })
          .returning()
      ).at(0);
      if (!widget) {
        throw new Error("Failed to seed checkout widget product");
      }
      const widgetSku = (
        await tx
          .insert(schema.sku)
          .values({
            tenantId: ORG_A,
            productId: widget.id,
            code: "WIDGET-01",
            costingMethod: "avco",
            createdBy: "seed-user",
            updatedBy: "seed-user",
          })
          .returning()
      ).at(0);
      if (!widgetSku) {
        throw new Error("Failed to seed checkout widget sku");
      }
      const { services } = await import("@RetailOS/db");
      const movement = await services.appendStockMovement(
        tx,
        { tenantId: ORG_A },
        {
          locationId: loc.id,
          movementType: "receipt",
          productId: widget.id,
          skuId: widgetSku.id,
          qtyDelta: 10,
          unitCostMinor: 800,
          costCurrency: "USD",
          costScale: 2,
        }
      );
      await services.applyValuation(tx, { tenantId: ORG_A }, movement);
    });

    await withTenant(db, ORG_B, async (tx) => {
      await tx.insert(schema.product).values({
        tenantId: ORG_B,
        sku: "beta-private-product",
        name: "Beta Private Product",
        priceMinor: 9999,
        currency: "USD",
        scale: 2,
      });
    });

    // Staff principals for the commerceAdmin (back-office order view) tests
    // below — a distinct user set from the storefront's anonymous customers.
    await db
      .insert(schema.user)
      .values([
        {
          id: STAFF_ADMIN,
          name: "Staff Admin",
          email: "staff_admin_commerce@example.com",
        },
        {
          id: STAFF_WAREHOUSE,
          name: "Staff Warehouse",
          email: "staff_warehouse_commerce@example.com",
        },
        {
          id: STAFF_ADMIN_B,
          name: "Staff Admin B",
          email: "staff_admin_b_commerce@example.com",
        },
      ])
      .onConflictDoNothing();
    await withTenant(db, ORG_A, (tx) =>
      tx.insert(schema.membership).values([
        { tenantId: ORG_A, userId: STAFF_ADMIN, role: "tenant_admin" },
        { tenantId: ORG_A, userId: STAFF_WAREHOUSE, role: "warehouse" },
      ])
    );
    await withTenant(db, ORG_B, (tx) =>
      tx
        .insert(schema.membership)
        .values([
          { tenantId: ORG_B, userId: STAFF_ADMIN_B, role: "tenant_admin" },
        ])
    );
  });

  it("resolves a known storefront host to its tenant's public name", async () => {
    const res = await call(
      appRouter.commerce.storefront,
      {},
      { context: makeStorefrontCtx(DOMAIN_A) }
    );
    expect(res).toEqual({ name: "Acme Store" });
  });

  it("isolates tenants: each host resolves ONLY its own tenant", async () => {
    const a = await call(
      appRouter.commerce.storefront,
      {},
      { context: makeStorefrontCtx(DOMAIN_A) }
    );
    const b = await call(
      appRouter.commerce.storefront,
      {},
      { context: makeStorefrontCtx(DOMAIN_B) }
    );
    expect(a).toEqual({ name: "Acme Store" });
    expect(b).toEqual({ name: "Beta Store" });
    // Host A never yields tenant B's data.
    expect(a.name).not.toBe(b.name);
  });

  it("is host-driven, not session-driven: ignores a staff session and resolves by host (design §1.4)", async () => {
    // A request that happens to carry a staff session for a DIFFERENT org must
    // still resolve the storefront purely from the host — the staff principal
    // never influences (or leaks into) the storefront path.
    const ctxWithStaffSession = {
      auth: null,
      session: {
        user: { id: "some_staff_user" },
        session: { id: "sess_staff", activeOrganizationId: ORG_B },
      },
      meta: {
        requestId: "req",
        correlationId: "corr",
        source: "storefront",
        deploymentMode: "saas",
      },
      headers: new Headers({ host: DOMAIN_A }),
    } as unknown as Context;
    const res = await call(
      appRouter.commerce.storefront,
      {},
      {
        context: ctxWithStaffSession,
      }
    );
    // Host A → tenant A, regardless of the session pointing at ORG_B.
    expect(res).toEqual({ name: "Acme Store" });
  });

  it("strips the port before resolving the host", async () => {
    const res = await call(
      appRouter.commerce.storefront,
      {},
      { context: makeStorefrontCtx(`${DOMAIN_A}:443`) }
    );
    expect(res).toEqual({ name: "Acme Store" });
  });

  it("returns a public catalog allow-list with no ids, cost, policy, or object-key leakage", async () => {
    // Scoped to just coffee-beans (the checkout fixture also seeds a
    // catalog-visible "checkout-widget" product — there is no is_published
    // curation yet, so every product is catalog-visible).
    const res = await call(
      appRouter.commerce.catalog,
      { limit: 10, q: "Coffee" },
      { context: makeStorefrontCtx(DOMAIN_A) }
    );
    expect(res.items).toHaveLength(1);
    expect(res.items[0]).toEqual({
      handle: "coffee-beans",
      name: "Coffee Beans",
      category: { handle: "PUBLIC-CAT", name: "Public Category" },
      price: { amountMinor: 1250, currency: "USD", scale: 2 },
      primaryImage: {
        url: "https://cdn.example.test/coffee.jpg",
        altText: "Bag of coffee beans",
      },
      availability: "unknown",
    });
    expect(JSON.stringify(res)).not.toMatch(PUBLIC_DTO_LEAK_RE);
  });

  it("isolates public catalog rows by host-resolved tenant", async () => {
    const a = await call(
      appRouter.commerce.catalog,
      { limit: 10, q: "Coffee" },
      { context: makeStorefrontCtx(DOMAIN_A) }
    );
    const b = await call(
      appRouter.commerce.catalog,
      { limit: 10 },
      { context: makeStorefrontCtx(DOMAIN_B) }
    );
    expect(a.items.map((item) => item.handle)).toEqual(["coffee-beans"]);
    expect(b.items.map((item) => item.handle)).toEqual([
      "beta-private-product",
    ]);
    expect(JSON.stringify(a)).not.toContain("Beta Private Product");
    expect(JSON.stringify(b)).not.toContain("Coffee Beans");
  });

  it("returns a public PDP by handle with images and sellable variants without internal leakage", async () => {
    const res = await call(
      appRouter.commerce.product,
      { handle: "coffee-beans" },
      { context: makeStorefrontCtx(DOMAIN_A) }
    );
    expect(res).toEqual({
      handle: "coffee-beans",
      name: "Coffee Beans",
      category: { handle: "PUBLIC-CAT", name: "Public Category" },
      price: { amountMinor: 1250, currency: "USD", scale: 2 },
      images: [
        {
          url: "https://cdn.example.test/coffee.jpg",
          altText: "Bag of coffee beans",
          isPrimary: true,
        },
      ],
      variants: [{ code: "COFFEE-250G", name: "250g bag" }],
      availability: "unknown",
    });
    expect(JSON.stringify(res)).not.toMatch(PUBLIC_DTO_LEAK_RE);
  });

  it("returns a real-tax quote (product falls back to the tenant standard rate)", async () => {
    const res = await call(
      appRouter.commerce.quote,
      { lines: [{ handle: "coffee-beans", quantity: 2 }] },
      { context: makeStorefrontCtx(DOMAIN_A) }
    );
    expect(res).toEqual({
      schemaVersion: 1,
      currency: "USD",
      scale: 2,
      lines: [
        {
          handle: "coffee-beans",
          name: "Coffee Beans",
          quantity: 2,
          unitPriceMinor: 1250,
          lineSubtotalMinor: 2500,
          discountMinor: 0,
          taxMinor: 350,
          lineTotalMinor: 2850,
        },
      ],
      taxBreakdown: [
        { baseMinor: 2500, name: "Standard VAT", rateBps: 1400, taxMinor: 350 },
      ],
      totals: {
        subtotalMinor: 2500,
        discountMinor: 0,
        taxMinor: 350,
        totalMinor: 2850,
      },
    });
    expect(JSON.stringify(res)).not.toMatch(PUBLIC_DTO_LEAK_RE);
  });

  it("charges zero tax when the storefront tenant has no rate configured", async () => {
    const res = await call(
      appRouter.commerce.quote,
      { lines: [{ handle: "beta-private-product", quantity: 1 }] },
      { context: makeStorefrontCtx(DOMAIN_B) }
    );
    expect(res.taxBreakdown).toEqual([]);
    expect(res.totals).toEqual({
      subtotalMinor: 9999,
      discountMinor: 0,
      taxMinor: 0,
      totalMinor: 9999,
    });
    expect(JSON.stringify(res)).not.toMatch(PUBLIC_DTO_LEAK_RE);
  });

  it("cart: starts, adds/merges a line, and returns an authoritative re-taxed total", async () => {
    const started = await call(
      appRouter.commerce.cartStart,
      {},
      { context: makeStorefrontCtx(DOMAIN_A) }
    );
    expect(started.status).toBe("active");
    expect(started.lines).toEqual([]);

    await call(
      appRouter.commerce.cartAddLine,
      {
        cartId: started.id,
        customerId: started.customerId,
        handle: "coffee-beans",
        quantity: 1,
      },
      { context: makeStorefrontCtx(DOMAIN_A) }
    );
    const afterSecondAdd = await call(
      appRouter.commerce.cartAddLine,
      {
        cartId: started.id,
        customerId: started.customerId,
        handle: "coffee-beans",
        quantity: 1,
      },
      { context: makeStorefrontCtx(DOMAIN_A) }
    );

    // Two adds of the same product merge into one line (qty 2), and the total
    // is a REAL re-quote (1250*2 = 2500 subtotal, 14% VAT = 350 tax), not
    // anything echoed from the client.
    expect(afterSecondAdd.lines).toHaveLength(1);
    expect(afterSecondAdd.lines[0]).toEqual({
      lineId: afterSecondAdd.lines[0]?.lineId,
      handle: "coffee-beans",
      name: "Coffee Beans",
      qty: 2,
      unitPriceMinor: 1250,
      lineSubtotalMinor: 2500,
      lineTaxMinor: 350,
      lineTotalMinor: 2850,
    });
    expect(afterSecondAdd.totals).toEqual({
      subtotalMinor: 2500,
      taxMinor: 350,
      totalMinor: 2850,
    });
    expect(JSON.stringify(afterSecondAdd)).not.toMatch(CART_DTO_LEAK_RE);

    const lineId = afterSecondAdd.lines[0]?.lineId;
    if (!lineId) {
      throw new Error("expected a cart line id");
    }
    const afterRemove = await call(
      appRouter.commerce.cartRemoveLine,
      {
        cartId: started.id,
        customerId: started.customerId,
        cartLineId: lineId,
      },
      { context: makeStorefrontCtx(DOMAIN_A) }
    );
    expect(afterRemove.lines).toEqual([]);
    expect(afterRemove.totals).toEqual({
      subtotalMinor: 0,
      taxMinor: 0,
      totalMinor: 0,
    });
  });

  it("cart: rejects operations from the wrong customer bearer credential", async () => {
    const owner = await call(
      appRouter.commerce.cartStart,
      {},
      { context: makeStorefrontCtx(DOMAIN_A) }
    );
    const stranger = await call(
      appRouter.commerce.cartStart,
      {},
      { context: makeStorefrontCtx(DOMAIN_A) }
    );
    await expect(
      call(
        appRouter.commerce.cartGet,
        { cartId: owner.id, customerId: stranger.customerId },
        { context: makeStorefrontCtx(DOMAIN_A) }
      )
    ).rejects.toThrow(CART_NOT_FOUND_RE);
  });

  it("cart: isolates carts by host-resolved tenant", async () => {
    const cartOnA = await call(
      appRouter.commerce.cartStart,
      {},
      { context: makeStorefrontCtx(DOMAIN_A) }
    );
    await expect(
      call(
        appRouter.commerce.cartGet,
        { cartId: cartOnA.id, customerId: cartOnA.customerId },
        { context: makeStorefrontCtx(DOMAIN_B) }
      )
    ).rejects.toThrow(CART_NOT_FOUND_RE);
  });

  it("checkout: full cart -> checkoutCreate -> checkoutConfirm writes a real sale, deducts stock, no leak", async () => {
    const startedCart = await call(
      appRouter.commerce.cartStart,
      {},
      { context: makeStorefrontCtx(DOMAIN_A) }
    );
    await call(
      appRouter.commerce.cartAddLine,
      {
        cartId: startedCart.id,
        customerId: startedCart.customerId,
        handle: "checkout-widget",
        quantity: 2,
      },
      { context: makeStorefrontCtx(DOMAIN_A) }
    );

    const created = await call(
      appRouter.commerce.checkoutCreate,
      { cartId: startedCart.id, customerId: startedCart.customerId },
      { context: makeStorefrontCtx(DOMAIN_A) }
    );
    expect(created.status).toBe("payment_pending");
    expect(created.currency).toBe("USD");
    expect(created.totals).toEqual({
      subtotalMinor: 4000,
      taxMinor: 560, // 4000 * 14%
      totalMinor: 4560,
    });
    expect(JSON.stringify(created)).not.toMatch(CART_DTO_LEAK_RE);

    const confirmed = await call(
      appRouter.commerce.checkoutConfirm,
      { checkoutIntentId: created.checkoutIntentId },
      { context: makeStorefrontCtx(DOMAIN_A) }
    );
    expect(confirmed.status).toBe("paid");
    expect(confirmed.totalMinor).toBe(4560);
    expect(confirmed.orderNumber).toMatch(ORDER_NUMBER_RE);
    expect(confirmed.saleNumber).toMatch(SALE_NUMBER_RE);
    expect(JSON.stringify(confirmed)).not.toMatch(CART_DTO_LEAK_RE);
    // checkoutConfirm's response is intentionally NARROWER than the cart
    // leak regex allows (no bearer ids at all) — assert the strict allow-list.
    expect(Object.keys(confirmed).sort()).toEqual(
      [
        "currency",
        "orderNumber",
        "saleNumber",
        "scale",
        "status",
        "totalMinor",
      ].sort()
    );

    // A second confirm with the same intent is idempotent, not a double-sale.
    const confirmedAgain = await call(
      appRouter.commerce.checkoutConfirm,
      { checkoutIntentId: created.checkoutIntentId },
      { context: makeStorefrontCtx(DOMAIN_A) }
    );
    expect(confirmedAgain).toEqual(confirmed);
  });

  it("checkout: rejects with a generic COMMERCE_UNAVAILABLE when the order exceeds on-hand stock", async () => {
    const startedCart = await call(
      appRouter.commerce.cartStart,
      {},
      { context: makeStorefrontCtx(DOMAIN_A) }
    );
    // 10 were seeded, the prior test already confirmed 2 -> 8 remain. 15 is
    // within CHECKOUT_MAX_QTY_PER_LINE (20, a create-time cap) but exceeds
    // on-hand, so this genuinely reaches the confirm-time availability gate.
    await call(
      appRouter.commerce.cartAddLine,
      {
        cartId: startedCart.id,
        customerId: startedCart.customerId,
        handle: "checkout-widget",
        quantity: 15,
      },
      { context: makeStorefrontCtx(DOMAIN_A) }
    );
    const created = await call(
      appRouter.commerce.checkoutCreate,
      { cartId: startedCart.id, customerId: startedCart.customerId },
      { context: makeStorefrontCtx(DOMAIN_A) }
    );
    let caught: unknown;
    try {
      await call(
        appRouter.commerce.checkoutConfirm,
        { checkoutIntentId: created.checkoutIntentId },
        { context: makeStorefrontCtx(DOMAIN_A) }
      );
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toMatch(COMMERCE_UNAVAILABLE_RE);
  });

  it("commerceAdmin: staff can list/detail a Shopix order written by checkout; permission-gated and tenant-isolated", async () => {
    // Self-contained product/sku/stock fixture (own company; reuses the
    // suite's ONE existing sellable location — the storefront v1 simplifica-
    // tion requires exactly one, so this test must not create a second) so it
    // does not depend on execution order relative to the checkout tests above
    // — it proves the SAME `order`/`sale` write path independently.
    const { services, withTenant: wt } = await import("@RetailOS/db");
    const { eq: eqOp } = await import("drizzle-orm");
    const admin = { context: makeStaffCtx(STAFF_ADMIN, ORG_A) };
    const warehouse = { context: makeStaffCtx(STAFF_WAREHOUSE, ORG_A) };
    const adminB = { context: makeStaffCtx(STAFF_ADMIN_B, ORG_B) };

    let widgetSkuId = "";
    let widgetProductId = "";
    await wt(db, ORG_A, async (tx) => {
      const loc = (
        await tx
          .select()
          .from(schema.location)
          .where(eqOp(schema.location.isSellable, true))
          .limit(1)
      ).at(0);
      if (!loc) {
        throw new Error("Expected the suite's sellable location to exist");
      }
      const widget = (
        await tx
          .insert(schema.product)
          .values({
            tenantId: ORG_A,
            sku: "admin-order-widget",
            name: "Admin Order Widget",
            priceMinor: 1000,
            currency: "USD",
            scale: 2,
            costingMethod: "avco",
            createdBy: "seed-user",
            updatedBy: "seed-user",
          })
          .returning()
      ).at(0);
      if (!widget) {
        throw new Error("Failed to seed admin-order-test widget product");
      }
      widgetProductId = widget.id;
      const widgetSku = (
        await tx
          .insert(schema.sku)
          .values({
            tenantId: ORG_A,
            productId: widget.id,
            code: "ADMIN-ORDER-WIDGET-01",
            costingMethod: "avco",
            createdBy: "seed-user",
            updatedBy: "seed-user",
          })
          .returning()
      ).at(0);
      if (!widgetSku) {
        throw new Error("Failed to seed admin-order-test widget sku");
      }
      widgetSkuId = widgetSku.id;
      const movement = await services.appendStockMovement(
        tx,
        { tenantId: ORG_A },
        {
          locationId: loc.id,
          movementType: "receipt",
          productId: widget.id,
          skuId: widgetSku.id,
          qtyDelta: 5,
          unitCostMinor: 400,
          costCurrency: "USD",
          costScale: 2,
        }
      );
      await services.applyValuation(tx, { tenantId: ORG_A }, movement);
    });

    const startedCart = await call(
      appRouter.commerce.cartStart,
      {},
      { context: makeStorefrontCtx(DOMAIN_A) }
    );
    await call(
      appRouter.commerce.cartAddLine,
      {
        cartId: startedCart.id,
        customerId: startedCart.customerId,
        handle: "admin-order-widget",
        quantity: 2,
      },
      { context: makeStorefrontCtx(DOMAIN_A) }
    );
    const created = await call(
      appRouter.commerce.checkoutCreate,
      { cartId: startedCart.id, customerId: startedCart.customerId },
      { context: makeStorefrontCtx(DOMAIN_A) }
    );
    await call(
      appRouter.commerce.checkoutConfirm,
      { checkoutIntentId: created.checkoutIntentId },
      { context: makeStorefrontCtx(DOMAIN_A) }
    );

    // List reflects the confirmed order (subtotal 2000 + 14% VAT 280 = 2280,
    // same standard-rate fallback the earlier quote/checkout tests exercise).
    const orders = await call(appRouter.commerceAdmin.orderList, {}, admin);
    const found = orders.find((row) => row.totalMinor === 2280);
    expect(found).toBeDefined();
    expect(found?.status).toBe("paid");
    expect(found?.fulfilmentType).toBe("pickup");
    expect(found?.saleId).toEqual(expect.any(String));
    const orderId = found?.id as string;

    // Detail composes header + lines with product/sku identity.
    const detail = await call(
      appRouter.commerceAdmin.orderDetail,
      { orderId },
      admin
    );
    expect(detail.status).toBe("paid");
    expect(detail.lines).toEqual([
      expect.objectContaining({
        productId: widgetProductId,
        skuId: widgetSkuId,
        skuCode: "ADMIN-ORDER-WIDGET-01",
        qty: 2,
      }),
    ]);

    // Permission gate — warehouse staff (no pos.create_sale) is rejected on
    // both reads, matching the gate saleSearch/saleDetail already use.
    await expect(
      call(appRouter.commerceAdmin.orderList, {}, warehouse)
    ).rejects.toThrow(MISSING_POS_CREATE_SALE_RE);
    await expect(
      call(appRouter.commerceAdmin.orderDetail, { orderId }, warehouse)
    ).rejects.toThrow(MISSING_POS_CREATE_SALE_RE);

    // Cross-tenant detail read is NOT_FOUND, not a leak.
    await expect(
      call(appRouter.commerceAdmin.orderDetail, { orderId }, adminB)
    ).rejects.toThrow(ORDER_NOT_FOUND_RE);
  });

  it("fails closed on an unknown host (NOT_FOUND, never a default tenant)", async () => {
    await expect(
      call(
        appRouter.commerce.storefront,
        {},
        { context: makeStorefrontCtx("unknown.example.test") }
      )
    ).rejects.toThrow(NO_STOREFRONT_RE);
  });

  it("fails closed when no host header is present", async () => {
    await expect(
      call(
        appRouter.commerce.storefront,
        {},
        { context: makeStorefrontCtx(null) }
      )
    ).rejects.toThrow(NO_STOREFRONT_RE);
  });
});
