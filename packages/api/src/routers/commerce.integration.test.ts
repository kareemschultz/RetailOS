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
    // with distinct storefront domains. organization is the tenant registry (no
    // RLS), so these are direct platform writes.
    const { eq, inArray } = await import("drizzle-orm");
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
