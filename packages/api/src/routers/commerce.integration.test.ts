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
const NO_STOREFRONT_RE = /no storefront is configured/i;
const PUBLIC_DTO_LEAK_RE =
  /\b(id|productId|skuId|tenantId|costing|margin|cogs|objectKey|trackingMode|removalStrategy|returnCostingPolicy|oversellPolicy|expiryPolicy|createdBy|updatedBy|deletedAt)\b/i;

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
        await tx.delete(schema.productImage);
        await tx.delete(schema.barcode);
        await tx.delete(schema.sku);
        await tx.delete(schema.product);
        await tx.delete(schema.category);
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
    const res = await call(
      appRouter.commerce.catalog,
      { limit: 10 },
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
      { limit: 10 },
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

  it("returns a quote skeleton using public handles and explicit tax/cart blockers", async () => {
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
          taxMinor: 0,
          lineTotalMinor: 2500,
        },
      ],
      totals: {
        subtotalMinor: 2500,
        discountMinor: 0,
        taxMinor: 0,
        totalMinor: 2500,
      },
      tax: {
        status: "blocked",
        blocker:
          "Real storefront tax rates are not modelled yet; v1 quote carries a zero-tax seam only.",
      },
      checkout: {
        status: "blocked",
        blocker:
          "Cart persistence, reservation, checkout intent, payment provider, and online order writes are deferred to the next Storefront/Commerce slice.",
      },
    });
    expect(JSON.stringify(res)).not.toMatch(PUBLIC_DTO_LEAK_RE);
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
