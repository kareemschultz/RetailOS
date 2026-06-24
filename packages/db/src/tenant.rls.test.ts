import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "./schema";
import { company } from "./schema";
import { withTenant } from "./tenant";

// Fail-closed RLS tests (ADR 0006). These need a REAL Postgres reached as the
// non-superuser `retailos_app` role (roles bootstrapped + migrations applied).
// They are skipped unless RLS_TEST_DATABASE_URL is set, so the default
// `bun run test` gate stays green without a database; CI sets it (real Postgres).
const url = process.env.RLS_TEST_DATABASE_URL;
const NON_EMPTY_TENANT_RE = /non-empty tenant id/;

const TENANT_TABLES = [
  "company",
  "location",
  "membership",
  "product",
  "stock_ledger",
  "sale",
  "sale_line",
  "invoice",
  "audit_log",
  "outbox_event",
  "number_block",
  "idempotency_key",
  "fiscal_document",
  "tender",
] as const;

describe.skipIf(!url)("RLS — fail-closed tenant isolation (ADR 0006)", () => {
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;

  beforeAll(async () => {
    pool = new Pool({ connectionString: url });
    db = drizzle(pool, { schema });
    // Seed two tenants through the tenant-scoped path (never a bypass).
    await withTenant(db, "rls_tenant_a", (tx) =>
      tx.insert(company).values({ tenantId: "rls_tenant_a", name: "A Co" })
    );
    await withTenant(db, "rls_tenant_b", (tx) =>
      tx.insert(company).values({ tenantId: "rls_tenant_b", name: "B Co" })
    );
  });

  afterAll(async () => {
    await pool?.end();
  });

  it("returns zero rows on every tenant-owned table when app.tenant_id is unset", async () => {
    for (const table of TENANT_TABLES) {
      const result = await db.execute(
        sql.raw(`SELECT count(*)::int AS c FROM ${table}`)
      );
      const row = result.rows.at(0) as { c?: number } | undefined;
      expect(
        row?.c,
        `${table} must be fail-closed (0 rows) with no tenant GUC`
      ).toBe(0);
    }
  });

  it("a tenant connection cannot read another tenant's rows", async () => {
    const aRows = await withTenant(db, "rls_tenant_a", (tx) =>
      tx.select().from(company)
    );
    const bRows = await withTenant(db, "rls_tenant_b", (tx) =>
      tx.select().from(company)
    );
    expect(aRows.length).toBeGreaterThan(0);
    expect(bRows.length).toBeGreaterThan(0);
    expect(aRows.every((r) => r.tenantId === "rls_tenant_a")).toBe(true);
    expect(aRows.some((r) => r.tenantId === "rls_tenant_b")).toBe(false);
    expect(bRows.every((r) => r.tenantId === "rls_tenant_b")).toBe(true);
  });

  it("the raw db handle (no withTenant) is fail-closed", async () => {
    const rows = await db.select().from(company);
    expect(rows.length).toBe(0);
  });

  it("withTenant cannot be called without a tenant id", async () => {
    await expect(withTenant(db, "", async () => 1)).rejects.toThrow(
      NON_EMPTY_TENANT_RE
    );
    await expect(withTenant(db, "   ", async () => 1)).rejects.toThrow();
  });

  it("the runtime role has no privilege that could bypass RLS", async () => {
    const result = await db.execute(sql`
      SELECT
        rolsuper,
        rolbypassrls,
        rolcreatedb,
        rolcreaterole,
        pg_has_role(current_user, 'retailos_owner', 'MEMBER') AS is_owner_member,
        has_schema_privilege(current_user, 'public', 'CREATE') AS can_create_in_public
      FROM pg_roles
      WHERE rolname = current_user
    `);
    const row = result.rows.at(0) as
      | {
          rolsuper?: boolean;
          rolbypassrls?: boolean;
          rolcreatedb?: boolean;
          rolcreaterole?: boolean;
          is_owner_member?: boolean;
          can_create_in_public?: boolean;
        }
      | undefined;
    expect(row?.rolsuper).toBe(false);
    expect(row?.rolbypassrls).toBe(false);
    expect(row?.rolcreatedb).toBe(false);
    expect(row?.rolcreaterole).toBe(false);
    // must not be able to SET ROLE retailos_owner (would disable RLS)
    expect(row?.is_owner_member).toBe(false);
    // must not be able to create DDL objects in public
    expect(row?.can_create_in_public).toBe(false);
  });
});
