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

## 🌙 AUTONOMOUS RUN STATUS (top-of-file; morning review)

- **Mode:** unattended overnight. Branch **`vs1-phase1`** (never master; all work = PRs for review).
- **Loop per commit:** implement-scope → gates (`check`/`check-types`/`test` + real-Postgres RLS where relevant) → codex adversarial review (CRITICAL/HIGH only) → fix → commit → push → update PR → lessons + PROGRESS.
- **Order:** VS#1 Commits 2→7, then phase roadmap §31 (Phase 1→2→3…) with §41/§42/§45 gates before any new module.
- **Current step:** VS#1 **COMPLETE** (all 7 commits, PR #1). Phase 2 gating: §41 competitive + §42 requirements docs **done** (→ PR #2); owner decided D1 (costing) + D5 (oversell), rounding left open. **HARD STOP** — awaiting owner ruling on D2/D3/D4/D6/D7 + PR #1 review before any Phase-2 schema/costing code. **Tooling:** added mojibake pre-commit guard (`scripts/check-mojibake.mjs`).

### ⛔ BLOCKERS awaiting your decision

**HARD STOP before Phase 2 (Products & Inventory Ledger).** VS#1/Phase 1 is complete (PR #1). Phase 2 §41/§42 docs are done on branch `phase-2-inventory` (→ PR #2). Two of the foundational decisions are now **made by the owner (2026-06-22)**; the remaining ones still need a ruling before any Phase-2 schema/costing code.

**✅ Owner decisions received (2026-06-22) — incorporated into `module-specs/inventory.md`:**
1. **Inventory costing (D1)** — **AVCO is the default**; **FIFO available per tenant/category/product** (esp. pharmacy/expiry/batch/lot/regulated); **no LIFO** (not IFRS-aligned); **not hardcoded as the only method** — costing is a per-tenant/category/product strategy (AVCO running-average vs FIFO cost-layer resolved per movement).
2. **Oversell (D5)** — **"Allow Oversell with Flagging" is the default**: ledger may go negative, emit `inventory.stock_discrepancy` for manager review/cycle count; **hard-block configurable per tenant/category/product** (serialized/controlled/regulated/high-risk). Ledger stays policy-neutral; policy applied above it.

**⏳ Still awaiting your decision at the Phase-2 approval gate (detailed in `module-specs/inventory.md`):**
- **D-money rounding mode** — **left OPEN per your directive**: do NOT assume banker's or half-up; pending verification of the Guyana/GRA VAT rounding rule + other target-country tax rules. (Not needed until Phase 5 tax/FX division.)
- **D2** multi-UoM conversion model · **D3** serial/batch/lot scope for Phase 2 · **D4** expiry/FEFO enforcement strength · **D6** barcode symbologies + weight/price-embedded format · **D7** reorder automation (suggest vs auto-PO).

**What I did instead of guessing:** finished the §41 competitive + §42 requirements docs, incorporated D1+D5, left rounding open. **STOPPED — no Phase-2 implementation code written** pending your ruling on D2/D3/D4/D6/D7 (+ rounding when Phase 5 nears) and your separate review of PR #1.

### §45 phase reassessment (end of Phase 1 / VS#1)
- Architecture held: fail-closed RLS + 3-role model + tenant-scoped `withTenant` is the load-bearing spine; every later module inherits it. No ADR changes needed. Codex found real HIGHs at the service/router layers (idempotency race, FK-bypasses-RLS, money int4) — all fixed + regression-tested; 0 CRITICAL across the whole slice.
- Tech debt queued (non-blocking): deferred §43 gates (a11y/Trivy/dep-audit/SAST/bundle/VRT), §44 perf gate, distributed number allocator, accounting GL (Phase 5), read-models (Phase 12).

### 📋 Deferred-decisions log (business/product rules I refused to guess)
1. **Monetary rounding mode** (half-up / half-even / half-away-from-zero) — charter §19 mandates "one rounding policy" but doesn't pick one. **STILL OPEN (owner directive 2026-06-22):** do NOT assume banker's or half-up — pending verification of the Guyana/GRA VAT rounding rule + other target-country tax rules. **Not needed for VS#1/Phase 2** (no division yet); first needed at **division**: tax (Phase 5) and FX. *(No work blocked now.)*
2. ~~**Oversell policy**~~ → **RESOLVED 2026-06-22 (owner directive):** "Allow Oversell with Flagging" default (ledger may go negative, emit `inventory.stock_discrepancy` for manager review); hard-block configurable per tenant/category/product (serialized/controlled/regulated/high-risk). `StockLedger.append` stays **policy-neutral** (as VS#1 shipped); the oversell policy resolver sits ABOVE the ledger. Recorded in `module-specs/inventory.md` D5.
3. **Inventory costing (D1)** → **RESOLVED 2026-06-22 (owner directive):** AVCO default, FIFO per tenant/category/product, no LIFO, not hardcoded (per-tenant/category/product strategy). Recorded in `module-specs/inventory.md` D1.
- *Still open (Phase 2 approval gate):* D2 multi-UoM · D3 serial/batch/lot scope · D4 expiry/FEFO · D6 barcode/weight-embedded · D7 reorder automation. *Open (Phase 5):* monetary rounding mode.

### ✅ PRs opened
- **PR #1** — `vs1-phase1` → master — **VS#1 COMPLETE** (all 7 commits: schema; fail-closed RLS + 3-role bootstrap; core services; request context + tenant guard; events/outbox; oRPC routers + minimal RBAC; §32 e2e tests + CI integration). All gates green; codex-reviewed each commit. Open for review; **DO NOT MERGE**.

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
