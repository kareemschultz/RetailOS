import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { is } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import * as schema from "./schema";

// COMMIT 0 — the tenant-isolation coverage GATE (charter §8/§29; ADR 0006).
//
// Mechanically enumerates every table in the Drizzle schema and proves the two
// sets are identical: { tables carrying a `tenant_id` column } == { tables a
// migration places under fail-closed RLS: ENABLE + FORCE + tenant_isolation
// policy }. It FAILS the build if a tenant-owned table exists without full RLS
// coverage (or a documented exclusion) — so a future phase cannot add a tenant
// table and forget the RLS policy. Pure/static (no DB), so it runs in the
// default `bun run test` gate on every commit.
//
// (Runtime proof that the policies actually deny cross-tenant access lives in the
// DB-gated `tenant.rls.test.ts`; this gate proves the policy is DECLARED for
// every tenant-owned table, at every commit, without a database.)

// Documented exceptions: a table that carries `tenant_id` but is deliberately NOT
// under the standard `tenant_isolation` policy. Each MUST carry a reason. Empty
// today — this is the escape hatch for a future, justified exception.
const RLS_EXCLUSIONS: Record<string, string> = {};

const MIGRATIONS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "migrations"
);

// Direct forms: `ALTER TABLE <t> ENABLE/FORCE ROW LEVEL SECURITY`
// (e.g. migration 0003).
const ENABLE_RE = /ALTER TABLE\s+"?([a-z_]+)"?\s+ENABLE ROW LEVEL SECURITY/gi;
const DISABLE_RE = /ALTER TABLE\s+"?([a-z_]+)"?\s+DISABLE ROW LEVEL SECURITY/gi;
const FORCE_RE = /ALTER TABLE\s+"?([a-z_]+)"?\s+FORCE ROW LEVEL SECURITY/gi;
const NO_FORCE_RE =
  /ALTER TABLE\s+"?([a-z_]+)"?\s+NO FORCE ROW LEVEL SECURITY/gi;
const POLICY_RE =
  /CREATE POLICY\s+tenant_isolation\s+ON\s+"?([a-z_]+)"?[\s\S]*?USING\s*\([\s\S]*?tenant_id\s*=\s*current_setting\('app\.tenant_id',\s*true\)[\s\S]*?WITH CHECK\s*\([\s\S]*?tenant_id\s*=\s*current_setting\('app\.tenant_id',\s*true\)/gi;
const DROP_POLICY_RE =
  /DROP POLICY(?:\s+IF EXISTS)?\s+tenant_isolation\s+ON\s+"?([a-z_]+)"?/gi;
// DO-block array form: `tenant_tables ... ARRAY['a','b',...]` consumed by a
// FOREACH ... ENABLE loop (e.g. migration 0001).
const ARRAY_RE = /ARRAY\s*\[([^\]]*)\]/g;
const QUOTED_RE = /'([a-z_]+)'/g;
const RLS_PRESENT_RE = /ENABLE ROW LEVEL SECURITY/i;
const FORCE_PRESENT_RE = /FORCE ROW LEVEL SECURITY/i;
const POLICY_PRESENT_RE = /CREATE POLICY\s+tenant_isolation/i;

interface RlsCoverage {
  enable: Set<string>;
  force: Set<string>;
  policy: Set<string>;
}

type RlsClause = keyof RlsCoverage;

interface RlsAction {
  clause: RlsClause;
  index: number;
  op: "add" | "delete";
  table: string;
}

function collectActions(
  actions: RlsAction[],
  sql: string,
  re: RegExp,
  clause: RlsClause,
  op: RlsAction["op"]
): void {
  for (const m of sql.matchAll(re)) {
    const table = m[1];
    if (!table) {
      continue;
    }
    actions.push({
      clause,
      index: m.index,
      op,
      table,
    });
  }
}

function collectArrayDrivenActions(actions: RlsAction[], sql: string): void {
  if (!RLS_PRESENT_RE.test(sql)) {
    return;
  }
  for (const arr of sql.matchAll(ARRAY_RE)) {
    const body = arr[1];
    if (!body) {
      continue;
    }
    for (const q of body.matchAll(QUOTED_RE)) {
      const table = q[1];
      if (!table) {
        continue;
      }
      actions.push({
        clause: "enable",
        index: arr.index,
        op: "add",
        table,
      });
      if (FORCE_PRESENT_RE.test(sql)) {
        actions.push({
          clause: "force",
          index: arr.index,
          op: "add",
          table,
        });
      }
      if (POLICY_PRESENT_RE.test(sql)) {
        actions.push({
          clause: "policy",
          index: arr.index,
          op: "add",
          table,
        });
      }
    }
  }
}

function applyRlsMigrationSql(coverage: RlsCoverage, sql: string): void {
  const actions: RlsAction[] = [];
  collectActions(actions, sql, ENABLE_RE, "enable", "add");
  collectActions(actions, sql, DISABLE_RE, "enable", "delete");
  collectActions(actions, sql, FORCE_RE, "force", "add");
  collectActions(actions, sql, NO_FORCE_RE, "force", "delete");
  collectActions(actions, sql, POLICY_RE, "policy", "add");
  collectActions(actions, sql, DROP_POLICY_RE, "policy", "delete");
  collectArrayDrivenActions(actions, sql);

  for (const action of actions.sort((a, b) => a.index - b.index)) {
    coverage[action.clause][action.op](action.table);
  }
}

// Tables the final migration state places under fail-closed RLS, tracked per
// required clause. Negative DDL is applied in migration order so a later DISABLE
// or DROP POLICY removes coverage instead of being masked by historical setup.
function rlsCoverage(): RlsCoverage {
  const coverage: RlsCoverage = {
    enable: new Set<string>(),
    force: new Set<string>(),
    policy: new Set<string>(),
  };
  for (const file of readdirSync(MIGRATIONS_DIR).sort()) {
    if (!file.endsWith(".sql")) {
      continue;
    }
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    applyRlsMigrationSql(coverage, sql);
  }
  return coverage;
}

// Every pgTable in the schema barrel + whether it carries a `tenant_id` column.
function schemaTables(): { name: string; tenantOwned: boolean }[] {
  const out: { name: string; tenantOwned: boolean }[] = [];
  for (const value of Object.values(schema)) {
    if (is(value, PgTable)) {
      const cfg = getTableConfig(value);
      out.push({
        name: cfg.name,
        tenantOwned: cfg.columns.some((c) => c.name === "tenant_id"),
      });
    }
  }
  return out;
}

describe("tenant-isolation coverage gate (Commit 0)", () => {
  const tables = schemaTables();
  const coverage = rlsCoverage();
  const covered = new Set([
    ...coverage.enable,
    ...coverage.force,
    ...coverage.policy,
  ]);
  const fullyCovered = new Set(
    [...coverage.enable].filter(
      (name) => coverage.force.has(name) && coverage.policy.has(name)
    )
  );
  const tenantOwned = tables.filter((t) => t.tenantOwned).map((t) => t.name);
  const allNames = new Set(tables.map((t) => t.name));

  it("every tenant-owned table has fail-closed RLS coverage or a documented exclusion", () => {
    const gaps = tenantOwned.filter(
      (name) => !(fullyCovered.has(name) || name in RLS_EXCLUSIONS)
    );
    expect(
      gaps,
      `tenant-owned tables missing full RLS coverage (add ENABLE+FORCE+tenant_isolation policy in a migration, or document an exclusion): ${gaps.join(", ")}`
    ).toEqual([]);
  });

  it("tenant-owned RLS coverage includes ENABLE, FORCE, and tenant_isolation policy", () => {
    const missingByClause = {
      enable: tenantOwned.filter((name) => !coverage.enable.has(name)),
      force: tenantOwned.filter((name) => !coverage.force.has(name)),
      policy: tenantOwned.filter((name) => !coverage.policy.has(name)),
    };
    expect(missingByClause).toEqual({
      enable: [],
      force: [],
      policy: [],
    });
  });

  it("no RLS policy targets a non-existent table (catches typos/stragglers)", () => {
    const orphans = [...covered].filter((name) => !allNames.has(name));
    expect(
      orphans,
      `RLS migrations reference tables not in the schema: ${orphans.join(", ")}`
    ).toEqual([]);
  });

  it("every RLS-covered table actually carries a tenant_id column", () => {
    const tenantSet = new Set(tenantOwned);
    const nonTenant = [...covered].filter((name) => !tenantSet.has(name));
    expect(
      nonTenant,
      `tables under tenant_isolation RLS but missing a tenant_id column: ${nonTenant.join(", ")}`
    ).toEqual([]);
  });

  it("anchors the known tenant-owned baseline (>= 12 from VS#1)", () => {
    expect(tenantOwned.length).toBeGreaterThanOrEqual(12);
  });

  it("tracks final RLS state when later migrations remove coverage", () => {
    const finalState: RlsCoverage = {
      enable: new Set<string>(),
      force: new Set<string>(),
      policy: new Set<string>(),
    };
    applyRlsMigrationSql(
      finalState,
      `
        ALTER TABLE product ENABLE ROW LEVEL SECURITY;
        ALTER TABLE product FORCE ROW LEVEL SECURITY;
        CREATE POLICY tenant_isolation ON product
          USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
          WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
      `
    );
    applyRlsMigrationSql(
      finalState,
      `
        ALTER TABLE product DISABLE ROW LEVEL SECURITY;
        ALTER TABLE product NO FORCE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS tenant_isolation ON product;
      `
    );

    expect({
      enable: finalState.enable.has("product"),
      force: finalState.force.has("product"),
      policy: finalState.policy.has("product"),
    }).toEqual({
      enable: false,
      force: false,
      policy: false,
    });
  });
});
