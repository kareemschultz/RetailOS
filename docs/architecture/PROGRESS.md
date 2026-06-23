# RetailOS — PROGRESS (live cross-agent state)

> **Read this first.** This is the single live operational tracker for the current effort, shared across
> agents and across context compaction. It holds the **task board**, a **changelog**, and **verified facts**
> so no agent re-derives or re-litigates settled work. Update it as part of every commit.
>
> Distinct from: `phase-roadmap.md` (strategic Phase 0–13 status) and `phase-0-checklist.md` (§46 gate
> scoreboard). This file is the day-to-day operational log.

<!-- ═══════════════════════════════════════════════════════════════════════════
     AUTONOMOUS OVERNIGHT RUN — read this block FIRST in the morning
     ═══════════════════════════════════════════════════════════════════════════ -->

## 🌙 RUN STATUS (top-of-file; cross-agent state)

- **Branches/PRs:** Phase 1 (PR #1), Phase 2 schema (PR #4 `d39428d`), Phase 2 behavior (PR #9 `72b2100`) all **MERGED to master**; master CI green (4/4 jobs incl. real-Postgres RLS). **No active feature branch.** All work = PRs; never push to master directly.
- **Loop per commit:** implement-scope → gates (`check`/`check-types`/`test` + coverage gate + real-Postgres RLS where relevant) → codex adversarial review (CRITICAL/HIGH only) → fix → commit → push → update PR → lessons + PROGRESS.
- **Standing build order (Phase 2 onward):** schema → migrations → RLS → **ROBUST seed** → services → routers → validation → RBAC → audit/outbox → tests → API contract docs. **No production UI** until APIs stable+approved; later UI strictly from `ui-inventory/` + MCP registries (never hand-rolled React). POS UI is a **Phase 4** decision (Tauri/offline/SQLite) — not decided now.
- **Current step:** **Phase 3 (Locations / Warehouses / Bonds) — PLANNING PACKET DRAFTED + REVISED; awaiting owner approval before any schema/code.** Phase 2 ✅ complete @ `72b2100`, CI green; narrative in [`phase-2-complete.md`](./phase-2-complete.md). Phase-3 docs: `phase-3-implementation-plan.md`, `phase-3-gap-analysis.md`, `module-specs/locations-warehouses-bonds.md`, `event-map-phase3.md`, `competitive/locations-warehouses-bonds.md`. **Revised design (owner directives):** (1) **pay parked debt FIRST** — #5 composite-FK (`UNIQUE(tenant_id,id)` on company/location/product/sku/lot + new tables born composite) **AND** #7 set-once DB-trigger — before any new table; (2) **ONE unified self-referential `location` tree** (`parent_location_id`), not separate zone/aisle/bin tables, + behaviour flags (`is_sellable/is_quarantine/is_bonded/is_transit`) + bin capacity seam (`max_weight/max_volume`, no routing); (3) **two-step intra-company-only transfers** (in-transit virtual node, `shipped_at/expected/actual` date seams; inter-company blocked — needs P5 GL); (4) **bond-release duty reuses the existing AVCO value-only `valuation_adjustment` seam** (qty=0, value>0) — no new costing machinery; (5) **generic jurisdiction-agnostic** customs/landed-cost reference seams (no allocation). **Transfer VALUE conservation:** AVCO conserves exactly via receipt + value-only remainder (NO frozen change); only **FIFO** transfer needs an additive `transfer_in` primitive in `costing.ts` (owner decision). **6 open decisions** (plan §I). Recommended first commit = parked-debt #5+#7 (expand-only). **STILL PARKED elsewhere:** #8 + `cost_reconciliation` (Phase 4); #6 + `valuation_updated` enrichment (Phase 5).

### ⛔ BLOCKERS / gates

**Phase 2 backend is review-ready for the approved scope.** All product-policy decisions D1–D7 are LOCKED (below); only D-money rounding stays open (Phase 5, not a Phase-2 blocker — AVCO carries exact-integer remainders, FIFO is division-free; see the plan's *Value-integrity invariants*). Phase-2 schema, rich seed data, valuation/inventory services, inventory routers/reports, catalog CRUD, product Phase-2 create/list/update/archive, variant lifecycle, lot lifecycle, reorder-rule CRUD, discrepancy review, revaluation, import preview, mixed-catalog router e2e, API contract docs, gap analysis, and closeout audit now exist. **No P0 backend gaps remain for approved Phase-2 scope.** UI is still intentionally absent.

**✅ Owner decisions LOCKED (2026-06-22) — all in `module-specs/inventory.md`:**
1. **D1 costing** — AVCO default; FIFO per tenant/category/product (pharmacy/expiry/lot/regulated); no LIFO; not hardcoded — per-tenant/category/product strategy (both `avg_cost` + `valuation_layer` exist). + Costing Strategy Examples section.
2. **D2 multi-UoM** — canonical base units; integer-ratio conversion factors where possible; purchase/stock/sale/reporting units; conversions tenant/category/product configurable.
3. **D3 serial/batch/lot** — model all three (serial + batch/lot + expiry); ship lot/batch+expiry first; serial stubbed but schema must not block it.
4. **D4 expiry/FEFO** — NOT a global hard-block; tenant/category/product configurable; general-retail default warn-and-override (audited `inventory.override_expiry`); pharmacy/regulated/controlled hard-block selectable per category/product.
5. **D5 oversell** — allow-oversell-with-flagging default (negative ledger + `inventory.stock_discrepancy`); hard-block configurable per tenant/category/product. Ledger policy-neutral.
6. **D6 barcode** — data-driven parser config; GS1/EAN/UPC/Code128 + variable-measure/weight-embedded; conservative Phase-2 build (table + config seam; live scale/parser deferred to Phase 4).
7. **D7 reorder** — fixed min/max; suggestions only; no auto-PO; manager approval required before procurement.

**⏳ Still OPEN (only one):**
- **D-money rounding mode** — left OPEN per directive; do NOT assume banker's or half-up; pending Guyana/GRA VAT + target-country rounding verification. First needed Phase 5 (tax/FX division), not Phase 2.

**What I did:** finished + locked all D1–D7 in the §42 spec; added Costing Strategy Examples; kept rounding open; drafted the approved Phase-2 implementation plan, event map, inventory screen map, Commit-0 RLS coverage gate, Commit-1 catalog schema/migration/RLS, Commit-2 tracking schema/migration/RLS, Commit-3 costing storage/migration/RLS, Commit-4 reorder/count/BOM schema/migration/RLS, Commit-5 raw seed foundation (multi-tenant AVCO/FIFO/mixed catalog, UoM, varied lots, serial stub, reorder/count/BOM config), Commit-6 costing resolver/applyValuation service (product→category→tenant, AVCO remainder carry/zeroing, FIFO `FOR UPDATE` layer consumption), Commit-7 valuation-bearing seed movements (receipts/issues/oversell row through resolver, idempotency-key guarded), Commit-8 inventory services (UoM, FEFO, oversell, reorder), Commit-9 stock-count posting (count lines → valued adjustment movements, positive variance requires explicit value triplet), Commit-10 routers/reports (`inventory.receive` SKU-aware, adjust, count start/line/post, reorder evaluate, valuation + low-stock reports), Commit-11 API contract doc, Commit-12 catalog create routes, and Commit-13 gap audit/guard regression. **No UI yet.**

### §45 phase reassessment (end of Phase 1 / VS#1)
- Architecture held: fail-closed RLS + 3-role model + tenant-scoped `withTenant` is the load-bearing spine; every later module inherits it. No ADR changes needed. Codex found real HIGHs at the service/router layers (idempotency race, FK-bypasses-RLS, money int4) — all fixed + regression-tested; 0 CRITICAL across the whole slice.
- Tech debt queued (non-blocking): deferred §43 gates (a11y/Trivy/dep-audit/SAST/bundle/VRT), §44 perf gate, distributed number allocator, accounting GL (Phase 5), read-models (Phase 12).

### 📋 Deferred-decisions log (business/product rules I refused to guess)
1. **Monetary rounding mode** (half-up / half-even / half-away-from-zero) — charter §19 mandates "one rounding policy" but doesn't pick one. **STILL OPEN (owner directive 2026-06-22):** do NOT assume banker's or half-up — pending verification of the Guyana/GRA VAT rounding rule + other target-country tax rules. **Not needed for VS#1/Phase 2** (no division yet); first needed at **division**: tax (Phase 5) and FX. *(No work blocked now.)*
2. ~~**Oversell policy**~~ → **RESOLVED 2026-06-22 (owner directive):** "Allow Oversell with Flagging" default (ledger may go negative, emit `inventory.stock_discrepancy` for manager review); hard-block configurable per tenant/category/product (serialized/controlled/regulated/high-risk). `StockLedger.append` stays **policy-neutral** (as VS#1 shipped); the oversell policy resolver sits ABOVE the ledger. Recorded in `module-specs/inventory.md` D5.
3. **Inventory costing (D1)** → **RESOLVED 2026-06-22 (owner directive):** AVCO default, FIFO per tenant/category/product, no LIFO, not hardcoded (per-tenant/category/product strategy). Recorded in `module-specs/inventory.md` D1.
4. **D2/D3/D4/D6/D7** → **ALL RESOLVED 2026-06-22 (owner directive):** UoM (canonical base + integer ratios + 4 unit roles + configurable), serial/batch/lot (all three modelled, lot first, serial stubbed), expiry/FEFO (configurable, no global hard-block, audited override), barcode (data-driven config, conservative build), reorder (fixed min/max, suggest-only, manager approval). All in `module-specs/inventory.md`.
- *Still open (Phase 5):* monetary rounding mode only.

### ✅ PRs merged
- **PR #1** — `vs1-phase1` → master — **MERGED** (VS#1 complete).
- **PR #3** — `phase-2-inventory` → master — **MERGED** (Phase-2 §41/§42 docs + ADR-0007 after PR #2 auto-closed).

### 🚧 Active review branch
- **`phase-2-implementation`** — Commit 0 coverage gate + docs-only planning artifacts; Commit 1 catalog schema/migration/RLS; Commit 2 tracking schema/migration/RLS; Commit 3 costing storage/migration/RLS; Commit 4 reorder/count/BOM schema/migration/RLS; Commit 5 raw rich seed foundation; Commit 6 SKU ledger seam + costing resolver/applyValuation; Commit 7 valuation-bearing seed movements; Commit 8 UoM/FEFO/oversell/reorder services; Commit 9 stock-count posting service; Commit 10 inventory routers/reports; Commit 11 API contract doc; Commit 12 catalog create routers; Commit 13 gap audit + catalog FK regression; Commit 14 product Phase-2 create fields + mixed-catalog router e2e; Commit 15 catalog/product list routes; Commit 16 catalog/product/variant/lot/reorder lifecycle routes; Commit 17 discrepancy review, revaluation, import preview; closeout audit. UI is not implemented yet. Next: owner review, then P1 hardening or Phase 3 backend planning.

---

- **Current effort:** Phase 0 — **post-lock-in hardening**: audit-only red-team pass of Phase 0 vs charter v4.1 → fix CRITICAL findings only → then Phase 1 (Vertical Slice #1). Charter §0/§1/§32/§45/§47.
- **Approved plan:** `~/.claude/plans/retailos-master-architecture-groovy-oasis.md` (Deliverables A–E DONE + merged to `master`).
- **Working branch:** `master` (Phase-0 branch merged; commits `4ce9499`/`cfcf588`/`bdc51f6`). Foundation docs + config locked-in and CI green.
- **Charter:** `docs/architecture/retailos-master-charter.md` (v4.1).

## How to resume (any agent / after compaction)

1. Read `docs/architecture/lessons-learned.md`, this file, and the relevant charter section(s).
2. Check the **Work lanes** table, then the Task Board, for the next unclaimed/unchecked item.
3. **Claim a lane before writing** (add your session tag in the table) so parallel agents don't collide on the same file.
4. Keep commits small and grouped by deliverable; update this file's Task Board + Changelog in the same commit.
5. `git pull --rebase` before committing (multiple agents share this branch).

## Work lanes (multi-agent partition — claim before writing)

| Lane | Owner | Status |
|---|---|---|
| Deliverable A–E (charter, doc set, slice-1 design, foundation config, verify+merge) | done | ☑ done — merged to `master`, CI green |
| CI green + Docker optimization (2.38GB→168MB) + dep alignment + ADRs 0004/0005 | done | ☑ done (`cfcf588`/`bdc51f6`) |
| **Audit-only red-team pass (Phase 0 vs charter v4.1)** | this session | ◐ 5 parallel read-only audit agents running |
| Fix CRITICAL audit findings only; queue rest as backlog | this session | ☐ blocked on audit results |
| Phase 1 — Vertical Slice #1 implementation (from `vertical-slice-1.md`) | _unclaimed_ | ☐ after critical fixes |

## Task Board

Legend: ☐ todo · ◐ in progress · ☑ done

### Deliverable A — Charter + governance scaffolding  ✅ DONE (commit 7566eef)
- ☑ Charter `retailos-master-charter.md` (1429 lines) · root `CLAUDE.md` (lean + linked) · `adr/` (template + 0001 base-ui, 0002 no-feature-code, 0003 baseline-stack) · `module-specs/README` · `glossary.md` · `phase-roadmap.md` · `competitive/README` · README `@magicui`/`@magicui-pro` split reconciled.
- ◐ A polish: add ADRs 0004+ for the remaining locked decisions if not yet covered (tenant isolation, offline conflict seam, money minor units, Outbox, webhook dispatcher seam, fiscalization/OCR seams, search interface).

### Automation & coordination (NEW — user request)  ✅ DONE [lane: agent-infra]
- ☑ `SessionStart` hook (`.claude/settings.json`) surfaces a lean PROGRESS view to every session/agent (context linked to docs across compaction). Activates on next `/hooks` open or restart (settings file was created mid-session).
- ☑ "Progress protocol" + Work-lanes + subagent/parallel guidance in root `CLAUDE.md` (kept lean + linked).
- ☑ `scripts/log-progress.sh` — `show` (lean state for the hook) + `log "msg"` (stamp a dated changelog entry). Verified.

### Deliverable B — Architecture-review doc set  ✅ DONE (all 13 docs committed + merged to master)
- ☑ architecture-review · domain-model · auth-authz · tenancy-deployment · offline-edge-hardware · money-fiscal-inventory · accounting-crm-ecommerce · platform-saas-integrations · quality-security-ops · folder-structure-conventions · ui-ux-plan · security-baseline · phase-0-checklist. (Fidelity to be re-verified by the audit pass below.)

### Deliverable C — Vertical Slice #1 design  ✅ DONE
- ☑ `docs/architecture/vertical-slice-1.md` (§32 flow, schema, oRPC routers, tenant-guard middleware, RLS, util interfaces, test list). DESIGN ONLY — no code.

### Deliverable D — Phase-0 foundation config  ✅ DONE + GREEN
- ☑ Root scripts (`test`/`lint`/`check`/`check-types`/`build`) + turbo `test` task; husky + lint-staged; vitest (happy-dom) + smoke tests; playwright config + placeholder e2e; `.github/workflows/ci.yml` (quality+docker+e2e jobs, GHA cache, ≤350MB size gate, checkout@v5); docker-compose +redis +minio +`.dockerignore`; `.env.example` placeholders.

### Deliverable E — Lessons-learned + verify + merge  ✅ DONE
- ☑ lessons-learned entries appended (charter committed; base-lyra=Base UI; fumadocs shiki-WASM; distroless Bun-vs-Node). §46 gates verified green; CI green on master; branch merged.

### Phase-0 hardening (post-lock-in — current task list)
- ☑ #13 Fix red CI on master (fumadocs shiki-WASM excluded from build gate)
- ☑ #14 Full docker build locally (web image 2.38GB→168MB, boots+listens)
- ☑ #15 tech-stack.md dep follow-ups (lucide-react/biome dedup; better-auth+expo 1.6.20); gates green post-bump
- ☑ #17 ADR-0004 (central-infra reuse) + ADR-0005 (Product Intelligence Layer deferred)
- ☑ #20 heimdallone-v2 Docker optimization studied + applied (multi-stage/cache/distroless)
- ☑ #16 Audit-only red-team pass — 5 parallel read-only agents → **0 CRITICAL / 0 HIGH**; report in `phase-0-audit.md`
- ☑ #18 No CRITICAL to fix; resolved 5 stale-metadata MEDIUM contradictions (§40); dismissed 1 (postgres-18 volume, verified); queued engineering items
- ◐ #19 Begin Phase 1 — implement Vertical Slice #1 from `vertical-slice-1.md` (NEXT)
- ☐ Full Phase-0 completion report to user (requested)

## Verified facts (do not re-derive)

- **`base-lyra` IS the Base UI primitive family** — `@base-ui/react ^1.0.0` is in `packages/ui/package.json` and components import `@base-ui`. Satisfies charter §5 (no Radix/Base UI conflict).
- Existing root scripts: `check-types` (turbo) and `check` (ultracite) exist; `db:push/studio/generate/migrate` exist. **Missing:** `test`, `lint`, husky, lint-staged, vitest, playwright, happy-dom/jsdom.
- Registry config (root + `packages/ui` `components.json`) is live-verified and correct: `@shadcn`, `@magicui` (free), `@magicui-pro` (Bearer `${MAGICUI_PRO_REGISTRY_TOKEN}`), `@shadcn-studio`/`@ss-blocks`/`@ss-components`/`@ss-themes` (style-param `…/r/{style}/{name}.json` + `email`/`license_key` params), `@reui` (`base-nova`). Credentials in gitignored `.env`. See `ui-inventory/INDEX.md` + `lessons-learned.md`.
- UI inventory (Phase-0 §5 discovery) is COMPLETE: `ui-inventory/` 10 files; counts live-verified (shadcn core 414, studio 735/61, Magic UI free 245/77 + Pro 103, ReUI 17). Origin UI + shadcnblocks evaluated, not configured.
- Scaffold reality: Better Auth = email/password + Expo plugin only; DB = auth schema only, no migrations; 2 demo oRPC procedures; docker-compose = postgres + web only. All charter foundation domain work (tenant/RBAC/audit/RLS/Redis/object storage/Better Auth plugins) is NOT yet built (deferred past Phase-0 lock-in).

## Changelog (newest first)

- **2026-06-22** — **Phase 3 planning packet REVISED** (branch `phase-3-planning`, docs-only) per refined owner directives: parked debt (#5 composite-FK + #7 set-once DB-trigger) paid **first**, before new tables; **ONE unified self-referential `location` tree** (`parent_location_id`) replacing separate zone/aisle/rack/bin tables, + behaviour flags (`is_sellable/is_quarantine/is_bonded/is_transit`) + bin capacity seam; **two-step intra-company-only** transfers (in-transit node, date seams; inter-company blocked); **bond-release duty reuses the existing value-only `valuation_adjustment` seam** (no new costing); **generic** customs/landed-cost reference seams. Transfer value-conservation refined: AVCO conserves exactly by reusing receipt + value-only seams (no frozen change); only FIFO transfer needs an additive primitive. plan/gap/module-spec/event-map updated; PR #11.

- **2026-06-22** — **Phase 3 planning packet** (branch `phase-3-planning`, docs-only): drafted `phase-3-implementation-plan.md`, `phase-3-gap-analysis.md`, `module-specs/locations-warehouses-bonds.md`, `event-map-phase3.md`, `competitive/locations-warehouses-bonds.md`. Verified the existing spine against master `eabf98e` (location.type is bare unconstrained text; NO composite/`unique(tenant_id,id)` FKs anywhere — H1 lives at the DB layer; costing is SKU×location and method resolves product→category→tenant NOT location ⇒ transfers are never mixed-method). **#5 composite-FK pulled INTO Phase-3 scope** (new tables born composite; referenced tables get `unique(tenant_id,id)`). Designed transfer **value conservation** (move exact integer `V`, no rounding ⇒ #6 not a blocker; additive touch to frozen `costing.ts` flagged for owner). Per-invariant ownership + the recognized-class write-path-invokes-service gate baked into the plan (INV-1..INV-6). Proposed ONE implementation pass (structural CRUD over a proven spine) with a single risk-justified checkpoint after the transfer-value commit. AGENTS.md/CLAUDE.md/roadmap synced. **No code; STOP for owner approval of 6 open decisions.**

- **2026-06-22** — **Phase 2 MERGED to master** (PR #9, merge commit `72b2100`): behavior pass (item 1 single resolver + item 3 M1 event-contract normalization + reserved nullable fields) landed on master; CI 4/4 green (Quality gates, E2E, Docker build, RLS real-Postgres); local == origin == GitHub master == `72b2100`. **Housekeeping:** archived the Phase-2 commit-by-commit narrative into `phase-2-complete.md` (moved out of PROGRESS); reset the RUN STATUS current-step to a lean block; re-stamped `test-matrix.md` last-verified to `72b2100`; confirmed the parked-items list in roadmap + PROGRESS. **Phase 2 done. Phase 3 kickoff awaits a separate owner GO.**

- **2026-06-22** — Phase 2 **reserved-field fix** (branch `phase-2-behavior`): reserve two deferred event fields as **present-but-null** instead of absent, so binding them in Phase 5 is additive not breaking. `inventory.adjusted` → `approvedBy: null` (audit-critical; §22 approval workflow); `inventory.valuation_updated` → `totalValueMinor: null` + `qtyOnHandBase: null` (qty=0⟺value=0 integrity fields; bound when `ValuationResult` is extended). Additive nullable only — no behavior/schema change. Map contracts updated; integration test asserts the keys are PRESENT (`toHaveProperty`) so the reservation can't regress. Gates: check 157/0 · check-types 6/6 · test 7/7 · DB-gated db **45/45**, api **11/11**.

- **2026-06-22** — Phase 2 **behavior item 3** (branch `phase-2-behavior`): **M1 event-contract normalization** — emitted inventory events now match `event-map-phase2.md` ("payload shapes locked" is now TRUE). `emitEvent` injects a server-set `occurredAt` into **every** payload (applied last → producer can't override; §14). Field alignment: `received` carries `productId` + reserved `serialIds:null`; `adjusted` keeps `cogsMinor` (value moved through valuation; map corrected); `count_posted` aligned to the base/Minor line contract + top-level `locationId`/`currency`/`scale` (added to `postStockCount` return; service `adjustments` names preserved, only the event normalized). `valuation_updated`/`stock_discrepancy` maps aligned to as-built (totalValue/qtyOnHand enrichment → Phase 5; stock_discrepancy stays product-level until #8/Phase 4). `lot_expiring`/`lot_expired` marked DEFERRED, `uom_converted` FOLDED (kept as locked contracts, not in `DomainEventType`). `revalued` + `stock_discrepancy_reviewed` added to the catalog + consumer matrix. Gates: check 157/0 · check-types 6/6 · test 7/7 · DB-gated db **45/45** (+1 occurredAt test) · api **11/11**. Only test edit = additive occurredAt contract guard. **Item 2 (`cost_reconciliation` emit) stays Phase-4-deferred (#8, owner-ratified 2026-06-22).**

- **2026-06-22** — Phase 2 **Commit 3** (branch `phase-2-implementation`): costing storage group added — `avg_cost` (AVCO source-of-truth projection with `total_value_minor` + `qty_on_hand`) and `valuation_layer` (FIFO layer storage with `received_at`, `seq`, `qty_remaining`, `unit_cost_minor`), plus `organization.costing_method` and `organization.barcode_parser_config`. Migration `0007_overconfident_junta.sql` includes FK/index/unique/check constraints and fail-closed RLS for `avg_cost` + `valuation_layer`; DB-level invariant added: `qty_on_hand <> 0 OR total_value_minor = 0` to mechanically block orphaned AVCO value at zero stock. Verified: static RLS coverage gate 5/5, full migration chain applied in a throwaway Postgres 18 container, `check:mojibake`, `check`, `check-types`, `test` green. **Next: rich seed foundation / costing resolver services.**

- **2026-06-22** — Phase 2 **Commit 2** (branch `phase-2-implementation`): tracking schema group added — `lot` (SKU batch/expiry/status) and `serial` (serial stub with optional lot link), plus nullable `stock_ledger.lot_id`, `serial_id`, and unit-cost money triplet (`unit_cost_minor`, `cost_currency`, `cost_scale`). Widened `stock_ledger.qty_delta` and `balance_after` from int4 to int8 for base-unit quantities (eaches/grams/etc.). Migration `0006_many_synch.sql` includes FK/index/unique/check constraints and fail-closed RLS for `lot` + `serial`; `StockLedger.append` accepts optional lot/serial/cost fields and preserves policy-neutral behavior. Verified: static RLS coverage gate 5/5, full migration chain applied in a throwaway Postgres 18 container, `check`, `check-types`, `test` green. **Next: Commit 3 costing storage (`avg_cost`, `valuation_layer`, config columns).**

- **2026-06-22** — Phase 2 **Commit 1** (branch `phase-2-implementation`): catalog schema group added in approved order — `category`, `brand`, `variant`, `sku`, `barcode`, `unit_of_measure`, `uom_conversion`, plus nullable `product` extensions (`category_id`, `brand_id`, `base_uom_id`, `costing_method`, `tracking_mode`). Migration `0005_adorable_harrier.sql` includes FK/index/unique/check constraints and fail-closed RLS (`ENABLE` + `FORCE` + `tenant_isolation`) for every new tenant-owned table. Audit fix: `uom_conversion` scoped uniqueness uses `UNIQUE NULLS NOT DISTINCT` so tenant/category/product/SKU-level conversion rows cannot duplicate through nullable scope columns. Verified: static RLS coverage gate 5/5, full migration chain applied in a throwaway Postgres 18 container, `check:mojibake`, `check`, `check-types`, `test` green. **Next: Commit 2 tracking schema (lot/serial + stock ledger nullable seams).**

- **2026-06-22** — Phase 2 **Commit 0** (branch `phase-2-implementation`): docs-only planning artifacts added (`event-map-phase2.md`, `inventory-screen-map.md`), approved implementation plan updated with the no-native-`pgEnum` schema convention, root `CLAUDE.md` points future agents at the Phase-2 docs, and `tenant-isolation-coverage.test.ts` added as the mechanical RLS coverage gate. Gate statically enumerates Drizzle schema tables and requires every tenant-owned table to have **ENABLE + FORCE + `tenant_isolation` policy** coverage (or an explicit exclusion); red→green demonstrated with a temporary uncovered table and removed before commit. Gates green: `check`, `check-types`, `test`, `check:mojibake`. **Stop here for review; no Phase-2 schema/resolver/services/routers/UI.**

- **2026-06-22** — VS#1 **Commit 7** (PR #1) — **VS#1 COMPLETE**: §32 end-to-end integration test through the oRPC routers (Org→Company→Location→Product→Receipt→Sale→Invoice→Report) vs real Postgres — proves POS idempotency (same key ⇒ one sale, on-hand 7), permission denial (cashier can't create products), report totals match (USD 3000, count 1). CI `db-rls` job runs bootstrap→migrate→`bun run test` with DATABASE_URL+RLS_TEST_DATABASE_URL as `retailos_app` (+ dev-only auth env) so RLS + service + e2e tests all execute under the non-privileged role. Lesson: env-core blocks server vars under happy-dom → `// @vitest-environment node` + lazy imports in skip-guarded beforeAll. Codex: 0 findings. Gates green.

- **2026-06-22** — VS#1 **Commit 6** (PR #1): oRPC routers for the §32 flow — tenant.setActive, company/location/product.create, inventory.receive (→receipt ledger + inventory.received event), pos.createSale (idempotent; sale+lines+ledger deductions+invoice+audit+sale.created event; advisory-locked gapless numbers), reports.salesBasic (grouped by currency). Minimal RBAC (`entitlements.ts`: tenant_admin/manager/cashier), enforced per-route inside the tenant tx. Codex review: 4 HIGH → 3 fixed (cross-tenant FK refs validated via RLS-scoped reads since FK checks bypass RLS; non-negative price; multi-currency report), 1 deferred (oversell = §14 business decision, logged). Gates green; routers type-checked + 4 RBAC tests. (Full §32 e2e through routers = Commit 7.)

- **2026-06-22** — VS#1 **Commit 5** (PR #1): transactional outbox. `emitEvent(tx, ctx, {type, version?, payload})` writes one `outbox_event` row in the SAME tx (versioned envelope = the row: type/version/tenant/correlation/request/created_at + jsonb payload). `DomainEventType` consts (inventory.received, sale.created). No dispatcher/consumers/Svix/DLQ yet (deferred). Tests incl. same-tx rollback atomicity (rolled-back tx emits no event). Codex: 0 findings. 18 db tests vs real PG; gates green.

- **2026-06-22** — VS#1 **Commit 4** (PR #1): standardized request context + tenant guard. `RequestContext` `{tenantId, organizationId, actorUserId, employeeId?, sessionId?, impersonatorUserId?, requestId, correlationId, source, deploymentMode}` (superset of db ServiceContext) built fail-closed by `buildRequestContext` (UNAUTHORIZED w/o user, FORBIDDEN w/o active org); `tenantProcedure` = protectedProcedure + tenant guard. `tenantId` comes ONLY from session.activeOrganizationId (not client headers). Added `DEPLOYMENT_MODE` env; `check-types` added to api+env (now 6 pkgs gated). Codex review: 0 findings. Gates green; 3 guard unit tests.

- **2026-06-22** — VS#1 **Commit 3** (PR #1): core services in `packages/db/src/services/` — Money (integer minor units, no rounding yet), StockLedger (sole stock mutator; advisory-lock serialized `balance_after`), Idempotency (canonical payload-hash, advisory-lock pre-select), Audit. New `idempotency_key` table + RLS (now 12 tenant tables). Money columns widened int4→bigint(mode:number). Codex review: 3 HIGH fixed (idempotency race, non-canonical hash, money safe-int/int4) + regression tests. 16 db tests pass vs real PG; gates green. (Note: PROGRESS.md UTF-8 was corrupted by a `perl -0pi` run and restored — never run perl in-place on these docs.)

- **2026-06-22** — VS#1 **Commit 2** (`e9b711e`, PR #1): migrations + fail-closed RLS + 3-role bootstrap (ADR 0006). `roles.sql` (idempotent, superuser, pre-migration): owner/migrator/app all NOSUPERUSER/NOBYPASSRLS/NOCREATEDB/NOCREATEROLE; migrator SET role→owner; revokes PUBLIC schema CREATE + any owner-membership from app. Migration 0001 ENABLE+FORCE RLS + fail-closed policy on 11 tenant tables. URL split (app runtime / migrator migrations). withTenant rejects empty tenant. CI `db-rls` job (real Postgres: bootstrap→migrate→test). 5 RLS tests pass vs real PG. Codex review: 2 HIGH role-hardening fixed, 0 CRIT. Gates green.

- **2026-06-21** — VS#1 **Commit 1** (`c8e7ab1`): schema + Better Auth org/admin + tenant-scoped seed scaffold. Domain tables (company/location/membership/product/stock_ledger/sale/sale_line/invoice/audit_log/outbox_event/number_block) with tenant cols from day one; `withTenant()` GUC primitive; `seeds/` via injected Better-Auth provisioner (no bypass); `tenant_id` text (BA nanoid), domain PKs uuid; added `check-types` to db+auth. NO migration/RLS yet. Gates green (check 115, check-types 4, test 6). **Stopped for review before Commit 2 (Migration + RLS).** Approved 8-step sequence recorded in `vertical-slice-1.md`.

- **2026-06-21** — Turbo test orchestration (`7ea29b2`): per-package `test` scripts + re-exported `vitest.config.ts` (6 pkgs); root `test`→`turbo run test`; dead `lint` task removed (Biome single-root). Resolves audit M6.

- **2026-06-21** — Phase-0 audit-only red-team pass (5 parallel read-only agents): **0 CRITICAL / 0 HIGH**. Report `phase-0-audit.md`. Resolved 5 stale-metadata §40 contradictions (ADR index +0004/0005; roadmap Phase-0→Complete; checklist Docker row + counts; quality-security-ops gate table; CLAUDE.md +docker-and-cicd/tech-stack refs). Dismissed M7 (postgres-18 volume) via live `docker image inspect` — PG18 uses `PGDATA=/var/lib/postgresql/18/docker` so our parent mount is correct; new lessons-learned entry. Queued: turbo test/lint no-ops, deferred §43 gates, §44 perf gate.

- **2026-06-21** — Deps: better-auth+expo 1.6.11→1.6.20, biome deduped to 2.5.0, lucide-react unified to catalog ^1.21.0; all gates green post-bump. Docker: web image multi-stage distroless-bun 2.38GB→168MB; CI +docker job (GHA cache + ≤350MB size gate, checkout@v5); prod compose +resource-limits/log-rotation; consolidated docs into docker-and-cicd.md. ADR-0004 (central-infra reuse) + ADR-0005 (Product Intelligence Layer deferred).

- **2026-06-21** — Deps: lucide-react aligned to catalog ^1.21.0 (deduped), Better Auth + @better-auth/expo 1.6.11→1.6.20, Biome root 2.4.16→2.5.0 (deduped). ADRs 0004 (central-infra reuse) + 0005 (Product Intelligence Layer deferred). docs/architecture/docker-and-cicd.md added; CI gains docker build+GHA cache+size gate; prod compose resource limits+log rotation. All gates green.

- **2026-06-21** — Docker: optimized apps/web image 2.38GB→168MB (~93%) via multi-stage (turbo prune --docker → builder → distroless-bun runtime shipping only Nitro .output), non-root; verified boots+listens. Hardened .dockerignore. Patterns adapted from same-stack heimdallone reference.

- **2026-06-21** — CI fix: fumadocs (docs-site addon) excluded from build gate — shiki onig.wasm can't bundle under rolldown/Vite8; root build now 'turbo build --filter=!fumadocs'; engine:'js' kept for dev; turbo build outputs +.output/.nitro. All gates green locally.

- **2026-06-21** — PHASE 0 COMPLETE: phase-0-checklist.md added (§46 scoreboard); all governance + architecture-review docs present; gates green (check/check-types/test); merging branch → master. Remaining = CI first-run green + docker image build verify (run on push) + Phase-1 features.

- **2026-06-21** — Phase-0 D complete + GREEN: check ✅ / check-types ✅ / test ✅ (3 tests). Fixed biome nested-root (fumadocs root:false), overrode framework-incompatible rules, excluded vendored skills + docs-site, fixed 5 real lint errors. Pinned postgres:18-alpine. tech-stack.md added (versions/compat verified; flagged lucide-react split + biome 2.4.16/2.5.0 dedup as follow-ups).

- **2026-06-21** — D config wired: vitest(happy-dom)+smoke test → `bun run test` PASSES (3 tests); playwright.config+e2e placeholder; .github/workflows/ci.yml; root test/lint/e2e scripts + lint-staged; turbo test task; docker redis+minio (base compose); fixed broken `bun test` pre-commit → lint-staged + check-types.

- **2026-06-21** — Central infra (KareTech VPS, save resources): provisioned `retailos` DB (least-priv role) in postgres-central; creds stored in Infisical /credentials/retailos (prod); REDIS_URL→redis-shared/3. Added docker-compose.prod.yml (VPS override reuses central via pangolin; others use self-contained base compose). Hybrid confirmed.

- **2026-06-21** — Automation lane: added SessionStart hook + scripts/log-progress.sh + CLAUDE.md progress protocol (lean+linked). Multi-agent Work-lanes table added to PROGRESS.md.

- **2026-06-21** — Phase 0 started. Plan approved (docs + foundation config, no feature code; competitive matrices deferred per-module). Branch `phase-0-architecture-foundation` created; `PROGRESS.md` added. Confirmed `base-lyra` = Base UI. Prior this session (on `master`): UI inventory v2 complete, registry config corrected & live-verified, `lessons-learned.md` seeded (12 entries).
