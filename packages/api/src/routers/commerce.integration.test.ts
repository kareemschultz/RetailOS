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
const ADMIN_A = "user_commerce_admin_a";
const CASHIER_A = "user_commerce_cashier_a";
const NO_STOREFRONT_RE = /no storefront is configured/i;
const NO_PUBLISHED_RE = /no published product/i;
const MISSING_PRODUCTS_PERM_RE = /Missing permission: products\.create/;

// Public catalog/PDP allow-lists + the fields that must NEVER appear publicly.
const CATALOG_KEYS = [
  "categoryName",
  "currency",
  "name",
  "primaryImageAltText",
  "primaryImageUrl",
  "priceMinor",
  "scale",
  "slug",
].sort();
const FORBIDDEN_PUBLIC_KEYS = [
  "id",
  "sku",
  "cost",
  "costMinor",
  "cogsMinor",
  "margin",
  "qtyOnHand",
  "totalValueMinor",
  "isPublished",
  "deletedAt",
];

// A storefront request context: anonymous (no session), carrying only the Host.
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

// An authenticated staff context (for the curation mutation).
function makeStaffCtx(userId: string, organizationId: string): Context {
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

describe.skipIf(!url)("Shopix storefront — gateway + public reads", () => {
  let call: typeof import("@orpc/server")["call"];
  let appRouter: typeof import("./index")["appRouter"];
  let db: typeof import("@RetailOS/db")["db"];
  let schema: typeof import("@RetailOS/db")["schema"];
  let withTenant: typeof import("@RetailOS/db")["withTenant"];

  beforeAll(async () => {
    ({ call } = await import("@orpc/server"));
    ({ appRouter } = await import("./index"));
    const dbmod = await import("@RetailOS/db");
    db = dbmod.db;
    schema = dbmod.schema;
    withTenant = dbmod.withTenant;
    const { eq, inArray } = await import("drizzle-orm");

    // Per-tenant hermetic cleanup (RLS-scoped), then re-seed.
    const cleanTenant = (tenant: string) =>
      withTenant(db, tenant, async (tx) => {
        await tx.delete(schema.productImage);
        await tx.delete(schema.product);
        await tx.delete(schema.membership);
      });
    await cleanTenant(ORG_A);
    await cleanTenant(ORG_B);
    await db
      .delete(schema.organization)
      .where(inArray(schema.organization.id, [ORG_A, ORG_B]));
    for (const domain of [DOMAIN_A, DOMAIN_B]) {
      await db
        .delete(schema.organization)
        .where(eq(schema.organization.storefrontDomain, domain));
    }
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
    // Identity rows (not RLS-scoped) — the membership FK requires them.
    await db
      .insert(schema.user)
      .values([
        {
          id: ADMIN_A,
          name: "Acme Admin",
          email: "admin_commerce@example.test",
        },
        {
          id: CASHIER_A,
          name: "Acme Cashier",
          email: "cashier_commerce@example.test",
        },
      ])
      .onConflictDoNothing();

    // Tenant A: a published product (+ primary image), an unpublished product,
    // and staff memberships for the curation test.
    await withTenant(db, ORG_A, async (tx) => {
      await tx.insert(schema.membership).values([
        { tenantId: ORG_A, userId: ADMIN_A, role: "tenant_admin" },
        { tenantId: ORG_A, userId: CASHIER_A, role: "cashier" },
      ]);
      const published = (
        await tx
          .insert(schema.product)
          .values({
            tenantId: ORG_A,
            sku: "ACME-WIDGET-1",
            name: "Acme Widget",
            priceMinor: 1599,
            currency: "USD",
            scale: 2,
            isPublished: true,
            slug: "acme-widget",
          })
          .returning({ id: schema.product.id })
      ).at(0);
      await tx.insert(schema.productImage).values({
        tenantId: ORG_A,
        productId: published?.id ?? "",
        url: "https://cdn.example.test/acme-widget.jpg",
        altText: "Acme Widget",
        isPrimary: true,
        sortOrder: 0,
      });
      await tx.insert(schema.product).values({
        tenantId: ORG_A,
        sku: "ACME-HIDDEN-1",
        name: "Unlisted Gadget",
        priceMinor: 999,
        currency: "USD",
        scale: 2,
        isPublished: false,
      });
    });

    // Tenant B: a published product, to prove host-A never surfaces it.
    await withTenant(db, ORG_B, async (tx) => {
      await tx.insert(schema.product).values({
        tenantId: ORG_B,
        sku: "BETA-ONLY-1",
        name: "Beta Only Item",
        priceMinor: 4200,
        currency: "USD",
        scale: 2,
        isPublished: true,
        slug: "beta-only",
      });
    });
  });

  // ---- Gateway (commit 1) ----

  it("resolves a known storefront host to its tenant's public name", async () => {
    const res = await call(
      appRouter.commerce.storefront,
      {},
      {
        context: makeStorefrontCtx(DOMAIN_A),
      }
    );
    expect(res).toEqual({ name: "Acme Store" });
  });

  it("fails closed on an unknown host (NOT_FOUND, never a default tenant)", async () => {
    await expect(
      call(
        appRouter.commerce.storefront,
        {},
        {
          context: makeStorefrontCtx("unknown.example.test"),
        }
      )
    ).rejects.toThrow(NO_STOREFRONT_RE);
  });

  it("fails closed when no host header is present", async () => {
    await expect(
      call(
        appRouter.commerce.storefront,
        {},
        {
          context: makeStorefrontCtx(null),
        }
      )
    ).rejects.toThrow(NO_STOREFRONT_RE);
  });

  it("is host-driven, not session-driven: ignores a staff session (design §1.4)", async () => {
    const ctx = {
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
    const res = await call(appRouter.commerce.storefront, {}, { context: ctx });
    expect(res).toEqual({ name: "Acme Store" });
  });

  // ---- Public catalog (commit 2) ----

  it("catalog returns ONLY published products, never unpublished", async () => {
    const rows = await call(
      appRouter.commerce.catalog,
      {},
      {
        context: makeStorefrontCtx(DOMAIN_A),
      }
    );
    const names = rows.map((r) => r.name);
    expect(names).toContain("Acme Widget");
    expect(names).not.toContain("Unlisted Gadget");
  });

  it("catalog is tenant-isolated: host A never surfaces tenant B's products", async () => {
    const rows = await call(
      appRouter.commerce.catalog,
      {},
      {
        context: makeStorefrontCtx(DOMAIN_A),
      }
    );
    expect(rows.map((r) => r.slug)).not.toContain("beta-only");
    const bRows = await call(
      appRouter.commerce.catalog,
      {},
      {
        context: makeStorefrontCtx(DOMAIN_B),
      }
    );
    expect(bRows.map((r) => r.slug)).toEqual(["beta-only"]);
  });

  it("catalog DTO is a strict allow-list — no cost/qty/id/sku leak", async () => {
    const rows = await call(
      appRouter.commerce.catalog,
      {},
      {
        context: makeStorefrontCtx(DOMAIN_A),
      }
    );
    const widget = rows.find((r) => r.slug === "acme-widget");
    expect(widget).toBeDefined();
    expect(Object.keys(widget ?? {}).sort()).toEqual(CATALOG_KEYS);
    for (const key of FORBIDDEN_PUBLIC_KEYS) {
      expect(widget).not.toHaveProperty(key);
    }
    expect(widget?.primaryImageUrl).toBe(
      "https://cdn.example.test/acme-widget.jpg"
    );
  });

  // ---- Public PDP (commit 2) ----

  it("productDetail returns a published product by slug, allow-list only", async () => {
    const pdp = await call(
      appRouter.commerce.productDetail,
      {
        slug: "acme-widget",
      },
      { context: makeStorefrontCtx(DOMAIN_A) }
    );
    expect(pdp.name).toBe("Acme Widget");
    expect(pdp.slug).toBe("acme-widget");
    expect(pdp.images.length).toBe(1);
    for (const key of FORBIDDEN_PUBLIC_KEYS) {
      expect(pdp).not.toHaveProperty(key);
    }
    // Image DTO carries no internal id either.
    expect(pdp.images[0]).not.toHaveProperty("id");
  });

  it("productDetail fails closed for an unpublished or unknown slug", async () => {
    await expect(
      call(
        appRouter.commerce.productDetail,
        { slug: "no-such-slug" },
        {
          context: makeStorefrontCtx(DOMAIN_A),
        }
      )
    ).rejects.toThrow(NO_PUBLISHED_RE);
    // Tenant B's slug is not reachable from host A.
    await expect(
      call(
        appRouter.commerce.productDetail,
        { slug: "beta-only" },
        {
          context: makeStorefrontCtx(DOMAIN_A),
        }
      )
    ).rejects.toThrow(NO_PUBLISHED_RE);
  });

  // ---- Public availability (commit 2) ----

  it("availability returns a COARSE band only — no exact qty/value leak", async () => {
    const res = await call(
      appRouter.commerce.availability,
      {
        slug: "acme-widget",
      },
      { context: makeStorefrontCtx(DOMAIN_A) }
    );
    // No sellable stock seeded → out_of_stock; the DTO is exactly { band }.
    expect(res).toEqual({ band: "out_of_stock" });
    expect(Object.keys(res)).toEqual(["band"]);
  });

  // ---- Staff curation control (commit 2) ----

  it("setPublished (staff) publishes a product, generates a slug, and it then appears in catalog", async () => {
    const before = await call(
      appRouter.commerce.catalog,
      {},
      {
        context: makeStorefrontCtx(DOMAIN_A),
      }
    );
    expect(before.map((r) => r.name)).not.toContain("Unlisted Gadget");

    // Find the unpublished product's id (staff-side).
    const hidden = await withTenant(db, ORG_A, async (tx) => {
      const { and, eq, isNull } = await import("drizzle-orm");
      return (
        await tx
          .select({ id: schema.product.id })
          .from(schema.product)
          .where(
            and(
              eq(schema.product.sku, "ACME-HIDDEN-1"),
              isNull(schema.product.deletedAt)
            )
          )
          .limit(1)
      ).at(0);
    });
    const res = await call(
      appRouter.product.setPublished,
      {
        id: hidden?.id ?? "",
        isPublished: true,
      },
      { context: makeStaffCtx(ADMIN_A, ORG_A) }
    );
    expect(res.isPublished).toBe(true);
    expect(res.slug).toBe("unlisted-gadget");

    const after = await call(
      appRouter.commerce.catalog,
      {},
      {
        context: makeStorefrontCtx(DOMAIN_A),
      }
    );
    expect(after.map((r) => r.name)).toContain("Unlisted Gadget");
  });

  it("setPublished is permission-gated: a cashier cannot curate", async () => {
    await expect(
      call(
        appRouter.product.setPublished,
        {
          id: "00000000-0000-0000-0000-000000000000",
          isPublished: true,
        },
        { context: makeStaffCtx(CASHIER_A, ORG_A) }
      )
    ).rejects.toThrow(MISSING_PRODUCTS_PERM_RE);
  });
});
