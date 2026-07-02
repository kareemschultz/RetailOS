# Tranche 1 — Module-Branch Ports + UI Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **REQUIRED READING FIRST:** `docs/plans/sonnet-execution-playbook.md` (§0 ritual, §1 prohibitions,
> §2 gate suite, §5 migration procedure). Every task below implicitly ends with the playbook §2 gate suite.

**Goal:** Land the reviewed backend work stranded on the module branches (storefront catalog, offline sync ingestion, procurement/accounting foundations + extensions) onto `feat/production-readiness-completion`, and close the two UI gaps the gap-audit left (orphaned demo features, role-filtered navigation).

**Architecture:** Ports are **surgical, not wholesale** — new files are checked out from the source commit; shared files (`vs1.ts`, `schema/index.ts`, `services/index.ts`) get their additive hunks hand-applied; **migrations are always regenerated** with `drizzle-kit generate` on this branch (source-branch numbering 0024–0030 collides with ours) with the source commit's RLS blocks appended verbatim. Navigation filtering adds one read endpoint (`membership.myAccess`) and a client-side filter — the backend `assertPermission` guards remain the enforcement; nav filtering is UX only.

**Tech Stack:** TanStack Start, oRPC, Drizzle/PG18, Vitest, `scripts/gate-db.sh` harness.

## Global Constraints

- Branch: `feat/production-readiness-completion`. Never master. Never push/deploy. (Playbook §1.)
- Migration numbering on THIS branch continues from **0026** (0025 is registered in the journal).
- Do NOT copy from the module branches: any `packages/db/src/migrations/**` file, `meta/*` file,
  `apps/web/src/routeTree.gen.ts`, `docs/**`, or `apps/web/src/{routes,components}/**` (except where a task says otherwise).
- Frozen: `packages/db/src/services/costing.ts` + `costing.rls.test.ts` must be byte-identical to HEAD after every task (`git diff HEAD -- packages/db/src/services/costing.ts` empty).
- Gate baseline that may only go UP: db 99 · api 70 · config 5 · ui 3 · web-import 17, zero skips.
- Every commit updates `docs/architecture/PROGRESS.md` (changelog line) in the same commit.

---

### Task 1: Delete orphaned AdminCN demo features

**Files:**
- Delete: `apps/web/src/features/<all subdirs except misc-pages>` (analytics, calendar, campaigns, chat, commerce-dashboard, contacts, data-tables, empty-states, faq, finance, form-layouts, form-validation, form-wizard, kanban, logistics, mail, onboarding, orders, payments, permissions, pricing, productivity, profile, roles, sales-overview, settings, users)
- Keep: `apps/web/src/features/misc-pages/` (the five `_app/error-*.tsx` routes import `@/features/misc-pages/error-views`)

- [ ] **Step 1: Prove the keep-list is exactly `misc-pages`**

Run:
```bash
grep -rn "from \"@/features/" apps/web/src --include="*.tsx" --include="*.ts" | grep -v "apps/web/src/features/" | sed 's/:.*from "@\/features\//  -> /' | sort -u
```
Expected: only lines pointing at `misc-pages/...`. If ANY other subdir appears, keep that subdir too and note it in the commit message.

- [ ] **Step 2: Delete the orphaned subdirs**

```bash
cd apps/web/src/features
ls -d */ | grep -v "^misc-pages/$" | xargs rm -r
cd -
```

- [ ] **Step 3: Verify nothing broke**

Run: `bun run check-types && bun -F web build`
Expected: both green. If check-types fails, the error names the importer — restore ONLY that subdir (`git checkout HEAD -- apps/web/src/features/<dir>`) and re-run.

- [ ] **Step 4: Lint + mojibake, then commit**

```bash
bun x ultracite check && bun run check:mojibake
git add -A apps/web/src/features docs/architecture/PROGRESS.md
git commit -m "chore(web): delete orphaned AdminCN demo features (gap-audit §7)"
```

---

### Task 2: `membership.myAccess` + role-filtered navigation

**Files:**
- Modify: `packages/api/src/routers/vs1.ts` (inside `membershipRouter`, after `roles:`)
- Modify: `apps/web/src/configs/nav-config.ts`
- Modify: `apps/web/src/components/app-sidebar.tsx`, `apps/web/src/components/command-menu.tsx`
- Test: `packages/api/src/routers/vs1.integration.test.ts`

**Interfaces:**
- Produces: `membership.myAccess` → `{ role: string | null, permissions: string[] }` (no permission gate — any tenant member may read their OWN access).
- Produces: `NavLeaf`/`NavMenuItem` gain optional `permission?: string`; exported helper `filterNavGroups(groups: NavGroup[], permissions: string[]): NavGroup[]`.

- [ ] **Step 1: Write the failing integration test**

In `packages/api/src/routers/vs1.integration.test.ts`, add (inside the existing authenticated-caller describe block, reusing the suite's existing caller helpers — follow the pattern of the nearest `membership.list` test):

```ts
it("membership.myAccess returns the caller's role and permission list", async () => {
  const access = await adminCaller.membership.myAccess({});
  expect(access.role).toBe("tenant_admin");
  expect(access.permissions).toContain("users.manage");

  const cashierAccess = await cashierCaller.membership.myAccess({});
  expect(cashierAccess.role).toBe("cashier");
  expect(cashierAccess.permissions).not.toContain("users.manage");
  expect(cashierAccess.permissions).toContain("pos.create_sale");
});
```
(Use the suite's actual admin/cashier caller variable names — grep `pos.create_sale` in the file for the cashier caller.)

- [ ] **Step 2: Run it to verify it fails**

```bash
scripts/gate-db.sh up && eval "$(scripts/gate-db.sh env)"
bunx vitest run packages/api/src/routers/vs1.integration.test.ts -t "myAccess"
```
Expected: FAIL (`myAccess is not a function` / not found).

- [ ] **Step 3: Implement the endpoint**

In `packages/api/src/routers/vs1.ts`, inside `membershipRouter` directly after the `roles:` procedure:

```ts
  // The caller's OWN role + permissions — powers client-side nav filtering.
  // Deliberately ungated: a member may always read their own access. The
  // backend assertPermission guards stay the real enforcement (§20).
  myAccess: tenantProcedure.input(z.object({}).optional()).handler(({ context }) => {
    const ctx = context.requestContext;
    return withTenant(db, ctx.tenantId, async (tx) => {
      const role = await services.resolveTenantRole(tx, ctx.actorUserId);
      const permissions =
        role && role in services.ROLE_PERMISSIONS
          ? [...services.ROLE_PERMISSIONS[role as services.TenantRole]]
          : [];
      return { permissions, role };
    });
  }),
```
If `services.TenantRole` is not exported through the `services` namespace, import `type TenantRole` the same way the file imports other `@RetailOS/db` types (grep `ROLE_PERMISSIONS` in the file to see how `roles:` reaches it).

- [ ] **Step 4: Run the test to verify it passes**

```bash
bunx vitest run packages/api/src/routers/vs1.integration.test.ts -t "myAccess"
```
Expected: PASS.

- [ ] **Step 5: Tag nav items with permissions + add the filter**

In `apps/web/src/configs/nav-config.ts`: add `permission?: string` to `NavLeaf` and to the `NavMenuItem` base (`{ icon: LucideIcon; label: string; permission?: string }`), then tag these items (leave everything else untagged = visible to all roles):

| Item | permission |
|---|---|
| `Shifts` (`/shifts`) | `pos.open_shift` |
| `Transfers` (`/transfers`) | `inventory.transfer` |
| `Bonded goods` (`/bonds`) | `bond.receive` |
| Reports group: `Reports` parent + all three leaves | `reports.view` |
| `Audit trail` (`/audit-log`) | `audit.view` |
| `Settings` parent + its four leaves | `settings.manage` |
| `Staff & access` (`/staff`) | `users.manage` |
| `Accounting` (`/financials`) | `reports.view` |

Append the filter helper at the bottom of the file:

```ts
// UX-only visibility filter. Backend assertPermission remains the enforcement;
// hiding a nav item is never a security boundary.
export function filterNavGroups(
  groups: NavGroup[],
  permissions: string[]
): NavGroup[] {
  const allowed = (p?: string) => !p || permissions.includes(p);
  return groups
    .map((group) => ({
      ...group,
      items: group.items
        .filter((item) => allowed(item.permission))
        .map((item) =>
          item.childItems
            ? {
                ...item,
                childItems: item.childItems.filter((leaf) =>
                  allowed(leaf.permission)
                ),
              }
            : item
        )
        .filter((item) => !item.childItems || item.childItems.length > 0),
    }))
    .filter((group) => group.items.length > 0);
}
```

- [ ] **Step 6: Wire the sidebar + command palette**

In `app-sidebar.tsx` and `command-menu.tsx` (both consume `navGroups`): fetch access with the file's existing oRPC pattern —

```tsx
const access = useQuery(orpc.membership.myAccess.queryOptions({ input: {} }));
const groups = filterNavGroups(navGroups, access.data?.permissions ?? []);
```
and render `groups` where `navGroups` was rendered. While `access.data` is undefined the fallback `[]` hides gated items briefly — acceptable (items appear when access loads; nothing sensitive flashes).

- [ ] **Step 7: Full gate + commit**

Playbook §2 gate suite (expect api 70→71+). Then:
```bash
git add packages/api apps/web/src/configs/nav-config.ts apps/web/src/components docs/architecture/PROGRESS.md
git commit -m "feat(web): role-filtered navigation via membership.myAccess (gap-audit MEDIUM)"
```
Report honestly: nav filtering is verified by types/tests/build only — flag "not browser-verified" in PROGRESS.

---

### Task 3: Port public storefront catalog (`1404ff9`)

**Files:**
- Modify: `packages/api/src/routers/commerce.ts` (+~304 from source)
- Test: `packages/api/src/routers/commerce.integration.test.ts` (+~195 from source)

- [ ] **Step 1: Attempt the surgical cherry-pick**

```bash
git cherry-pick -n 1404ff9
git status
```
Only those two files should be staged/conflicted. If OTHER files appear, `git restore --staged --worktree <them>`.

- [ ] **Step 2: Resolve conflicts (if any)**

Both hunk sets are additive (new public catalog procedures + their tests). On conflict: keep OUR existing content AND the incoming procedures/tests. Read the resolved file — every new public read must be tenant-scoped and return a scrubbed DTO (no cost/objectKey fields); if the incoming code violates that, fix it and note it in the commit body.

- [ ] **Step 3: Gate + commit**

Playbook §2 suite (api count rises; zero skips). Then:
```bash
git add packages/api docs/architecture/PROGRESS.md
git commit -m "feat(commerce): expose public storefront catalog (port 1404ff9)"
```

---

### Task 4: Port offline sync ingestion foundation (`56fe9cf`) → migration 0026

**Files:**
- Create (checkout from source): `packages/api/src/offline-queue-contract.ts`, `packages/api/src/offline-queue-contract.test.ts`, `packages/db/src/schema/offline_sync.ts`, `packages/db/src/services/offline-sync.ts`, `packages/db/src/services/offline-sync.rls.test.ts`
- Modify (hand-apply hunks): `packages/api/src/routers/vs1.ts`, `packages/db/src/schema/index.ts`, `packages/db/src/services/index.ts`
- Create (regenerated): `packages/db/src/migrations/0026_*.sql` + meta

- [ ] **Step 1: Copy the new files**

```bash
git checkout 56fe9cf -- packages/api/src/offline-queue-contract.ts packages/api/src/offline-queue-contract.test.ts packages/db/src/schema/offline_sync.ts packages/db/src/services/offline-sync.ts packages/db/src/services/offline-sync.rls.test.ts
```

- [ ] **Step 2: Apply the shared-file hunks**

```bash
git show 56fe9cf -- packages/api/src/routers/vs1.ts packages/db/src/schema/index.ts packages/db/src/services/index.ts > /tmp/port-56fe9cf.diff
```
Read the diff; apply each additive hunk with the Edit tool (barrel export lines + the new offline-sync router procedures and their router registration). If a hunk references a symbol that doesn't exist on this branch, STOP and report (playbook §6) — do not invent it.

- [ ] **Step 3: Regenerate the migration (do NOT copy the source's 0024 SQL)**

```bash
bun --cwd packages/db db:generate
```
Expected: a new `0026_*.sql` + `meta/0026_snapshot.json` + journal entry. Read the generated SQL (playbook §5.3).

- [ ] **Step 4: Append the RLS blocks verbatim from the source migration**

```bash
git show 56fe9cf:packages/db/src/migrations/0024_pos_offline_sync.sql
```
Copy every `ENABLE ROW LEVEL SECURITY` / `FORCE` / `CREATE POLICY tenant_isolation` / trigger statement into the END of the generated `0026_*.sql` (with `--> statement-breakpoint` separators, matching the file's existing style). Compare the source SQL's CREATE TABLEs against the generated ones — they must define the same tables/columns; investigate any difference.

- [ ] **Step 5: Fresh-chain + full gate**

```bash
scripts/gate-db.sh down; scripts/gate-db.sh up   # proves 0000→0026 applies fresh
eval "$(scripts/gate-db.sh env)" && bun run test # tenant-isolation-coverage must be green
```
Expected: db/api counts rise (source added ~9 offline-sync tests), zero skips.

- [ ] **Step 6: Commit**

```bash
git add packages docs/architecture/PROGRESS.md
git commit -m "feat(pos): offline sync ingestion foundation (port 56fe9cf, migration 0026)"
```

---

### Task 5: Port procurement + accounting foundations (`b9cecc9`) → migration 0027

**Files:**
- Create (checkout): `packages/db/src/schema/accounting.ts`, `packages/db/src/schema/procurement.ts`, `packages/db/src/services/accounting.ts`, `packages/db/src/services/accounting.rls.test.ts`, `packages/db/src/services/procurement.ts`, `packages/db/src/services/procurement.rls.test.ts`
- Modify (hunks): `packages/api/src/routers/vs1.ts`, `packages/api/src/routers/index.ts`, `packages/db/src/schema/index.ts`, `packages/db/src/services/index.ts`, `packages/db/src/services/entitlements.ts`, `packages/db/src/schema/product.ts`, `packages/db/src/schema/outbox.ts` (the +2 from `67352a2`)
- Create (regenerated): `packages/db/src/migrations/0027_*.sql` + meta

**Interfaces:**
- Produces: `procurement.ts` service + `procurementRouter`/`accountingRouter` procedures that Tasks 6–8 extend. Later tasks checkout NEWER versions of the same service/schema/test files — that is expected and safe (no skipped module-branch commit touches them).

- [ ] **Step 1: Copy new files (foundations versions)**

```bash
git checkout b9cecc9 -- packages/db/src/schema/accounting.ts packages/db/src/schema/procurement.ts packages/db/src/services/accounting.ts packages/db/src/services/accounting.rls.test.ts packages/db/src/services/procurement.ts packages/db/src/services/procurement.rls.test.ts
```

- [ ] **Step 2: Apply shared-file hunks**

```bash
git show b9cecc9 -- packages/api/src/routers/vs1.ts packages/api/src/routers/index.ts packages/db/src/schema/index.ts packages/db/src/services/index.ts packages/db/src/services/entitlements.ts packages/db/src/schema/product.ts > /tmp/port-b9cecc9.diff
git show 67352a2 -- packages/db/src/schema/outbox.ts >> /tmp/port-b9cecc9.diff
```
Hand-apply with Edit (same discipline as Task 4 Step 2). The `entitlements.ts` hunk adds procurement/accounting permission strings to `ROLE_PERMISSIONS` — apply exactly; the `product.ts` hunk is a small additive column/relation.

- [ ] **Step 3: Regenerate migration 0027 + append RLS**

```bash
bun --cwd packages/db db:generate
git show b9cecc9:packages/db/src/migrations/0024_proc_fin_foundations.sql
git show 67352a2:packages/db/src/migrations/0024_proc_fin_foundations.sql   # the gate-repair delta
```
Append every RLS/policy/trigger statement from the source SQL (use `67352a2`'s version of the file — it contains the repaired final form) to the generated `0027_*.sql`. Verify each new tenant table also got its composite `UNIQUE(tenant_id, id)` in the generated SQL (it comes from the schema `foreignKey`/unique definitions — if missing, the schema copy is incomplete).

- [ ] **Step 4: Fresh chain + full gate + commit**

`scripts/gate-db.sh down && scripts/gate-db.sh up`, full §2 suite (db + api counts rise sharply — the source adds ~200-line RLS test files), zero skips, frozen-costing diff empty. Then:
```bash
git add packages docs/architecture/PROGRESS.md
git commit -m "feat(procurement): accounting + procurement foundations (port b9cecc9, migration 0027)"
```

---

### Task 6: Port procurement extensions — GRN, supplier bills, landed cost, import batch → migration 0028

Source commits, in order: `aaa6765` (goods receipts), `1dc4196` (supplier bills), `b815ef6` (landed cost), `f4b0a5d` (import batch customs).

**Files:**
- Modify (checkout FINAL state from `f4b0a5d` — it contains all four commits' growth): `packages/db/src/schema/procurement.ts`, `packages/db/src/services/procurement.ts`, `packages/db/src/services/procurement.rls.test.ts`
- Modify (hunks, one commit at a time): `packages/api/src/routers/vs1.ts`
- Create (regenerated): `packages/db/src/migrations/0028_*.sql` + meta

- [ ] **Step 1: Checkout the final-state files**

```bash
git checkout f4b0a5d -- packages/db/src/schema/procurement.ts packages/db/src/services/procurement.ts packages/db/src/services/procurement.rls.test.ts
```

- [ ] **Step 2: Apply the four vs1.ts hunk sets in commit order**

```bash
for c in aaa6765 1dc4196 b815ef6 f4b0a5d; do git show $c -- packages/api/src/routers/vs1.ts > /tmp/port-$c-vs1.diff; done
```
Apply each with Edit, oldest first. All four are additive router procedures + registrations.

- [ ] **Step 3: Regenerate migration 0028 + append RLS from all four source migrations**

```bash
bun --cwd packages/db db:generate
for f in 0026_goods_receipt_grn_lite 0027_supplier_bill_three_way_match 0028_landed_cost_pools 0029_import_batch_tracking; do git show f4b0a5d:packages/db/src/migrations/$f.sql; done
```
One generated `0028_*.sql` on our branch covers all four source migrations' tables. Append every RLS/policy/trigger statement from all four source files. Read the generated SQL for FK-before-UNIQUE ordering (playbook §5.3).

- [ ] **Step 4: Verify the FIFO landed-cost guard is preserved**

```bash
grep -n "FIFO value-only" packages/db/src/services/costing.ts
git diff HEAD -- packages/db/src/services/costing.ts
```
Expected: the throw is still present and the diff is EMPTY (frozen). The ported landed-cost service must route FIFO allocation into that reject path — if the ported `procurement.ts` bypasses `applyValuation` to write `valuation_layer`/`avg_cost` directly, STOP and report (that's the #8 class + an OPEN Phase-6 decision).

- [ ] **Step 5: Fresh chain + full gate + commit**

Fresh `gate-db.sh` cycle, full §2 suite (procurement.rls.test grows to ~1,200 lines of tests), zero skips.
```bash
git add packages docs/architecture/PROGRESS.md
git commit -m "feat(procurement): GRN, supplier bills, landed cost, import batches (ports aaa6765..f4b0a5d, migration 0028)"
```

---

### Task 7: Port reorder→PO conversion (`315680d`) — no migration

**Files:**
- Modify (hunks): `packages/api/src/routers/vs1.ts`, `packages/api/src/routers/vs1.integration.test.ts`
- Modify (hunk): `packages/db/src/services/procurement.ts` (+75)

- [ ] **Step 1: Apply the three file diffs**

```bash
git show 315680d -- packages/api/src/routers/vs1.ts packages/api/src/routers/vs1.integration.test.ts packages/db/src/services/procurement.ts > /tmp/port-315680d.diff
```
Hand-apply with Edit. The service hunk may already be PRESENT from Task 6's final-state checkout **if** `315680d` predates `f4b0a5d` — it does NOT (it's later), so apply it. If a hunk's context already exists verbatim, skip that hunk (idempotent port) and note it.

- [ ] **Step 2: Gate + commit**

Full §2 suite (api +~2 from the 68-line integration test), then:
```bash
git add packages docs/architecture/PROGRESS.md
git commit -m "feat(procurement): reorder suggestion → PO conversion (port 315680d)"
```

---

### Task 8: Port vendor payment seam — BACKEND ONLY (`6aa4a21`) → migration 0029

**Files:**
- Modify (hunks): `packages/api/src/routers/vs1.ts`, `packages/db/src/schema/procurement.ts`, `packages/db/src/services/procurement.ts`, `packages/db/src/services/procurement.rls.test.ts`
- Create (regenerated): `packages/db/src/migrations/0029_*.sql` + meta
- **DO NOT TOUCH** (source commit changes them, we skip them): `apps/web/**` (login, onboarding, sign-up-form, google-sign-in, routeTree, `_app/route.tsx`)

- [ ] **Step 1: Apply backend hunks only**

```bash
git show 6aa4a21 -- packages/db/src/schema/procurement.ts packages/db/src/services/procurement.ts packages/db/src/services/procurement.rls.test.ts packages/api/src/routers/vs1.ts > /tmp/port-6aa4a21.diff
```
Hand-apply with Edit. **Exclusion rule:** the vs1.ts diff mixes vendor-payment procedures with an "onboarding gate" that references the trial-tenant provisioning from `417b62b` (NOT ported). Apply the vendor-payment hunks; for any hunk whose symbols don't resolve after `bun run check-types`, that hunk belongs to the skipped onboarding work — drop it and record the drop in the commit body + PROGRESS.md. Never recreate the missing symbol.

- [ ] **Step 2: Regenerate migration 0029 + append RLS**

```bash
bun --cwd packages/db db:generate
git show 6aa4a21:packages/db/src/migrations/0030_ap_vendor_payment_seam.sql
```
Append the source file's RLS/policy statements to the generated `0029_*.sql`.

- [ ] **Step 3: Fresh chain + full gate + commit**

```bash
scripts/gate-db.sh down && scripts/gate-db.sh up && eval "$(scripts/gate-db.sh env)" && bun run test
git add packages docs/architecture/PROGRESS.md
git commit -m "feat(procurement): AP vendor payment seam, backend only (port 6aa4a21, migration 0029)"
```

---

### Task 9: Docs sync + final full gate

**Files:**
- Modify: `docs/architecture/PROGRESS.md` (task board + "verified facts" test counts), `docs/architecture/phase-roadmap.md` (Phase 4/6 rows: note ported foundations), `docs/plans/2026-07-02-retailos-production-readiness-completion.md` (mark Phase 4 ports complete)
- Modify (if any surprises occurred): `docs/architecture/lessons-learned.md` (append entries)

- [ ] **Step 1: Update the three docs** with the final test counts and the list of ported commits (including any dropped hunks from Task 8).

- [ ] **Step 2: Final full gate**, including `bun -F web build`, on a fresh `gate-db.sh` cycle. Record exact "N passed" numbers in PROGRESS.md.

- [ ] **Step 3: Verify shared infra untouched**

```bash
docker ps --filter name=postgres-central --format '{{.Names}}: {{.Status}}'
scripts/gate-db.sh status
```
Expected: postgres-central Up (healthy); no gate container left running (`down` was run).

- [ ] **Step 4: Commit**

```bash
git add docs
git commit -m "docs: tranche-1 ports complete — PROGRESS/roadmap/plan sync"
```

**STOP here.** Do not merge, push, or deploy. Report the branch state and test counts to Kareem.

---

## Explicitly OUT of this tranche (do not attempt)

- `417b62b` self-serve trial-tenant onboarding (conflicts with this branch's onboarding revamp).
- `f79a13c`/`1f67d71`/`6686284` creation-action commits (this branch already built richer versions of those surfaces; review-later).
- Real browser E2E replacing `e2e/smoke.spec.ts` (needs its own plan: served web + seeded DB + login flow).
- Anything in Phases 5–13 beyond these ports (playbook §7 entry gates).
