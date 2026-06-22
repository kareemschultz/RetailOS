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
const FORCE_RE = /ALTER TABLE\s+"?([a-z_]+)"?\s+FORCE ROW LEVEL SECURITY/gi;
const POLICY_RE =
  /CREATE POLICY\s+tenant_isolation\s+ON\s+"?([a-z_]+)"?[\s\S]*?USING\s*\([\s\S]*?tenant_id\s*=\s*current_setting\('app\.tenant_id',\s*true\)[\s\S]*?WITH CHECK\s*\([\s\S]*?tenant_id\s*=\s*current_setting\('app\.tenant_id',\s*true\)/gi;
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

// Tables any migration places under fail-closed RLS — union of both declaration
// forms, tracked per required clause.
function rlsCoverage(): RlsCoverage {
  const coverage: RlsCoverage = {
    enable: new Set<string>(),
    force: new Set<string>(),
    policy: new Set<string>(),
  };
  for (const file of readdirSync(MIGRATIONS_DIR)) {
    if (!file.endsWith(".sql")) {
      continue;
    }
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    for (const m of sql.matchAll(ENABLE_RE)) {
      if (m[1]) {
        coverage.enable.add(m[1]);
      }
    }
    for (const m of sql.matchAll(FORCE_RE)) {
      if (m[1]) {
        coverage.force.add(m[1]);
      }
    }
    for (const m of sql.matchAll(POLICY_RE)) {
      if (m[1]) {
        coverage.policy.add(m[1]);
      }
    }
    // Array-driven enablement only counts when the file actually enables RLS.
    if (RLS_PRESENT_RE.test(sql)) {
      for (const arr of sql.matchAll(ARRAY_RE)) {
        const body = arr[1];
        if (!body) {
          continue;
        }
        for (const q of body.matchAll(QUOTED_RE)) {
          if (q[1]) {
            coverage.enable.add(q[1]);
            if (FORCE_PRESENT_RE.test(sql)) {
              coverage.force.add(q[1]);
            }
            if (POLICY_PRESENT_RE.test(sql)) {
              coverage.policy.add(q[1]);
            }
          }
        }
      }
    }
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
});
