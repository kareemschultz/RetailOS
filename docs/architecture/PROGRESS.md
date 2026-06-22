# RetailOS â PROGRESS (live cross-agent state)

> **Read this first.** This is the single live operational tracker for the current effort, shared across
> agents and across context compaction. It holds the **task board**, a **changelog**, and **verified facts**
> so no agent re-derives or re-litigates settled work. Update it as part of every commit.
>
> Distinct from: `phase-roadmap.md` (strategic Phase 0â13 status) and `phase-0-checklist.md` (Â§46 gate
> scoreboard). This file is the day-to-day operational log.

<!-- âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
     AUTONOMOUS OVERNIGHT RUN â read this block FIRST in the morning
     âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ -->

## ð AUTONOMOUS RUN STATUS (top-of-file; morning review)

- **Mode:** unattended overnight. Branch **`vs1-phase1`** (never master; all work = PRs for review).
- **Loop per commit:** implement-scope â gates (`check`/`check-types`/`test` + real-Postgres RLS where relevant) â codex adversarial review (CRITICAL/HIGH only) â fix â commit â push â update PR â lessons + PROGRESS.
- **Order:** VS#1 Commits 2â7, then phase roadmap Â§31 (Phase 1â2â3â¦) with Â§41/Â§42/Â§45 gates before any new module.
- **Current step:** VS#1 **Commit 4** (middleware + standardized request context) â starting.

### â BLOCKERS awaiting your decision (none yet)
*(When I hard-stop, the blocker + analysis + options go here.)*

### ð Deferred-decisions log (business/product rules I refused to guess)
1. **Monetary rounding mode** (half-up / half-even / half-away-from-zero) â charter Â§19 mandates "one rounding policy" but doesn't pick one. **Not needed for VS#1** (all money math is exact integer add/multiply-by-quantity; no division yet). First needed at **division**: tax (Phase 5) and FX. Decide before Phase 5. *(No work blocked now.)*
- *Next expected:* Phase 2 inventory costing FIFO/LIFO/avg.

### â PRs opened
- **PR #1** â `vs1-phase1` â master â VS#1 tenant-isolation spine. Commits 1â3 landed (schema; fail-closed RLS + 3-role bootstrap; core services). Open for review; DO NOT MERGE.

---

- **Current effort:** Phase 0 â **post-lock-in hardening**: audit-only red-team pass of Phase 0 vs charter v4.1 â fix CRITICAL findings only â then Phase 1 (Vertical Slice #1). Charter Â§0/Â§1/Â§32/Â§45/Â§47.
- **Approved plan:** `~/.claude/plans/retailos-master-architecture-groovy-oasis.md` (Deliverables AâE DONE + merged to `master`).
- **Working branch:** `master` (Phase-0 branch merged; commits `4ce9499`/`cfcf588`/`bdc51f6`). Foundation docs + config locked-in and CI green.
- **Charter:** `docs/architecture/retailos-master-charter.md` (v4.1).

## How to resume (any agent / after compaction)

1. Read `docs/architecture/lessons-learned.md`, this file, and the relevant charter section(s).
2. Check the **Work lanes** table, then the Task Board, for the next unclaimed/unchecked item.
3. **Claim a lane before writing** (add your session tag in the table) so parallel agents don't collide on the same file.
4. Keep commits small and grouped by deliverable; update this file's Task Board + Changelog in the same commit.
5. `git pull --rebase` before committing (multiple agents share this branch).

## Work lanes (multi-agent partition â claim before writing)

| Lane | Owner | Status |
|---|---|---|
| Deliverable AâE (charter, doc set, slice-1 design, foundation config, verify+merge) | done | â done â merged to `master`, CI green |
| CI green + Docker optimization (2.38GBâ168MB) + dep alignment + ADRs 0004/0005 | done | â done (`cfcf588`/`bdc51f6`) |
| **Audit-only red-team pass (Phase 0 vs charter v4.1)** | this session | â 5 parallel read-only audit agents running |
| Fix CRITICAL audit findings only; queue rest as backlog | this session | â blocked on audit results |
| Phase 1 â Vertical Slice #1 implementation (from `vertical-slice-1.md`) | _unclaimed_ | â after critical fixes |

## Task Board

Legend: â todo Â· â in progress Â· â done

### Deliverable A â Charter + governance scaffolding  â DONE (commit 7566eef)
- â Charter `retailos-master-charter.md` (1429 lines) Â· root `CLAUDE.md` (lean + linked) Â· `adr/` (template + 0001 base-ui, 0002 no-feature-code, 0003 baseline-stack) Â· `module-specs/README` Â· `glossary.md` Â· `phase-roadmap.md` Â· `competitive/README` Â· README `@magicui`/`@magicui-pro` split reconciled.
- â A polish: add ADRs 0004+ for the remaining locked decisions if not yet covered (tenant isolation, offline conflict seam, money minor units, Outbox, webhook dispatcher seam, fiscalization/OCR seams, search interface).

### Automation & coordination (NEW â user request)  â DONE [lane: agent-infra]
- â `SessionStart` hook (`.claude/settings.json`) surfaces a lean PROGRESS view to every session/agent (context linked to docs across compaction). Activates on next `/hooks` open or restart (settings file was created mid-session).
- â "Progress protocol" + Work-lanes + subagent/parallel guidance in root `CLAUDE.md` (kept lean + linked).
- â `scripts/log-progress.sh` â `show` (lean state for the hook) + `log "msg"` (stamp a dated changelog entry). Verified.

### Deliverable B â Architecture-review doc set  â DONE (all 13 docs committed + merged to master)
- â architecture-review Â· domain-model Â· auth-authz Â· tenancy-deployment Â· offline-edge-hardware Â· money-fiscal-inventory Â· accounting-crm-ecommerce Â· platform-saas-integrations Â· quality-security-ops Â· folder-structure-conventions Â· ui-ux-plan Â· security-baseline Â· phase-0-checklist. (Fidelity to be re-verified by the audit pass below.)

### Deliverable C â Vertical Slice #1 design  â DONE
- â `docs/architecture/vertical-slice-1.md` (Â§32 flow, schema, oRPC routers, tenant-guard middleware, RLS, util interfaces, test list). DESIGN ONLY â no code.

### Deliverable D â Phase-0 foundation config  â DONE + GREEN
- â Root scripts (`test`/`lint`/`check`/`check-types`/`build`) + turbo `test` task; husky + lint-staged; vitest (happy-dom) + smoke tests; playwright config + placeholder e2e; `.github/workflows/ci.yml` (quality+docker+e2e jobs, GHA cache, â¤350MB size gate, checkout@v5); docker-compose +redis +minio +`.dockerignore`; `.env.example` placeholders.

### Deliverable E â Lessons-learned + verify + merge  â DONE
- â lessons-learned entries appended (charter committed; base-lyra=Base UI; fumadocs shiki-WASM; distroless Bun-vs-Node). Â§46 gates verified green; CI green on master; branch merged.

### Phase-0 hardening (post-lock-in â current task list)
- â #13 Fix red CI on master (fumadocs shiki-WASM excluded from build gate)
- â #14 Full docker build locally (web image 2.38GBâ168MB, boots+listens)
- â #15 tech-stack.md dep follow-ups (lucide-react/biome dedup; better-auth+expo 1.6.20); gates green post-bump
- â #17 ADR-0004 (central-infra reuse) + ADR-0005 (Product Intelligence Layer deferred)
- â #20 heimdallone-v2 Docker optimization studied + applied (multi-stage/cache/distroless)
- â #16 Audit-only red-team pass â 5 parallel read-only agents â **0 CRITICAL / 0 HIGH**; report in `phase-0-audit.md`
- â #18 No CRITICAL to fix; resolved 5 stale-metadata MEDIUM contradictions (Â§40); dismissed 1 (postgres-18 volume, verified); queued engineering items
- â #19 Begin Phase 1 â implement Vertical Slice #1 from `vertical-slice-1.md` (NEXT)
- â Full Phase-0 completion report to user (requested)

## Verified facts (do not re-derive)

- **`base-lyra` IS the Base UI primitive family** â `@base-ui/react ^1.0.0` is in `packages/ui/package.json` and components import `@base-ui`. Satisfies charter Â§5 (no Radix/Base UI conflict).
- Existing root scripts: `check-types` (turbo) and `check` (ultracite) exist; `db:push/studio/generate/migrate` exist. **Missing:** `test`, `lint`, husky, lint-staged, vitest, playwright, happy-dom/jsdom.
- Registry config (root + `packages/ui` `components.json`) is live-verified and correct: `@shadcn`, `@magicui` (free), `@magicui-pro` (Bearer `${MAGICUI_PRO_REGISTRY_TOKEN}`), `@shadcn-studio`/`@ss-blocks`/`@ss-components`/`@ss-themes` (style-param `â¦/r/{style}/{name}.json` + `email`/`license_key` params), `@reui` (`base-nova`). Credentials in gitignored `.env`. See `ui-inventory/INDEX.md` + `lessons-learned.md`.
- UI inventory (Phase-0 Â§5 discovery) is COMPLETE: `ui-inventory/` 10 files; counts live-verified (shadcn core 414, studio 735/61, Magic UI free 245/77 + Pro 103, ReUI 17). Origin UI + shadcnblocks evaluated, not configured.
- Scaffold reality: Better Auth = email/password + Expo plugin only; DB = auth schema only, no migrations; 2 demo oRPC procedures; docker-compose = postgres + web only. All charter foundation domain work (tenant/RBAC/audit/RLS/Redis/object storage/Better Auth plugins) is NOT yet built (deferred past Phase-0 lock-in).

## Changelog (newest first)

- **2026-06-22** â VS#1 **Commit 3** (PR #1): core services in packages/db/src/services/ â Money (integer minor units, no rounding yet), StockLedger (sole stock mutator; advisory-lock serialized balance_after), Idempotency (payload-hash, advisory-lock pre-select), Audit. New idempotency_key table + RLS (now 12 tenant tables). Money columns widened int4→bigint(mode:number). Codex review: 3 HIGH fixed (idempotency race, non-canonical hash, money safe-int/int4) + regression tests. 16 db tests pass vs real PG; gates green.

- **2026-06-22** â VS#1 **Commit 2** (`e9b711e`, PR #1): migrations + fail-closed RLS + 3-role bootstrap (ADR 0006). `roles.sql` (idempotent, superuser, pre-migration): owner/migrator/app all NOSUPERUSER/NOBYPASSRLS/NOCREATEDB/NOCREATEROLE; migrator SET roleâowner; revokes PUBLIC schema CREATE + any owner-membership from app. Migration 0001 ENABLE+FORCE RLS + fail-closed policy on 11 tenant tables. URL split (app runtime / migrator migrations). withTenant rejects empty tenant. CI `db-rls` job (real Postgres: bootstrapâmigrateâtest). 5 RLS tests pass vs real PG. Codex review: 2 HIGH role-hardening fixed, 0 CRIT. Gates green.

- **2026-06-21** â VS#1 **Commit 1** (`c8e7ab1`): schema + Better Auth org/admin + tenant-scoped seed scaffold. Domain tables (company/location/membership/product/stock_ledger/sale/sale_line/invoice/audit_log/outbox_event/number_block) with tenant cols from day one; `withTenant()` GUC primitive; `seeds/` via injected Better-Auth provisioner (no bypass); `tenant_id` text (BA nanoid), domain PKs uuid; added `check-types` to db+auth. NO migration/RLS yet. Gates green (check 115, check-types 4, test 6). **Stopped for review before Commit 2 (Migration + RLS).** Approved 8-step sequence recorded in `vertical-slice-1.md`.

- **2026-06-21** â Turbo test orchestration (`7ea29b2`): per-package `test` scripts + re-exported `vitest.config.ts` (6 pkgs); root `test`â`turbo run test`; dead `lint` task removed (Biome single-root). Resolves audit M6.

- **2026-06-21** â Phase-0 audit-only red-team pass (5 parallel read-only agents): **0 CRITICAL / 0 HIGH**. Report `phase-0-audit.md`. Resolved 5 stale-metadata Â§40 contradictions (ADR index +0004/0005; roadmap Phase-0âComplete; checklist Docker row + counts; quality-security-ops gate table; CLAUDE.md +docker-and-cicd/tech-stack refs). Dismissed M7 (postgres-18 volume) via live `docker image inspect` â PG18 uses `PGDATA=/var/lib/postgresql/18/docker` so our parent mount is correct; new lessons-learned entry. Queued: turbo test/lint no-ops, deferred Â§43 gates, Â§44 perf gate.

- **2026-06-21** â Deps: better-auth+expo 1.6.11â1.6.20, biome deduped to 2.5.0, lucide-react unified to catalog ^1.21.0; all gates green post-bump. Docker: web image multi-stage distroless-bun 2.38GBâ168MB; CI +docker job (GHA cache + â¤350MB size gate, checkout@v5); prod compose +resource-limits/log-rotation; consolidated docs into docker-and-cicd.md. ADR-0004 (central-infra reuse) + ADR-0005 (Product Intelligence Layer deferred).

- **2026-06-21** â Deps: lucide-react aligned to catalog ^1.21.0 (deduped), Better Auth + @better-auth/expo 1.6.11â1.6.20, Biome root 2.4.16â2.5.0 (deduped). ADRs 0004 (central-infra reuse) + 0005 (Product Intelligence Layer deferred). docs/architecture/docker-and-cicd.md added; CI gains docker build+GHA cache+size gate; prod compose resource limits+log rotation. All gates green.

- **2026-06-21** â Docker: optimized apps/web image 2.38GBâ168MB (~93%) via multi-stage (turbo prune --docker â builder â distroless-bun runtime shipping only Nitro .output), non-root; verified boots+listens. Hardened .dockerignore. Patterns adapted from same-stack heimdallone reference.

- **2026-06-21** â CI fix: fumadocs (docs-site addon) excluded from build gate â shiki onig.wasm can't bundle under rolldown/Vite8; root build now 'turbo build --filter=!fumadocs'; engine:'js' kept for dev; turbo build outputs +.output/.nitro. All gates green locally.

- **2026-06-21** â PHASE 0 COMPLETE: phase-0-checklist.md added (Â§46 scoreboard); all governance + architecture-review docs present; gates green (check/check-types/test); merging branch â master. Remaining = CI first-run green + docker image build verify (run on push) + Phase-1 features.

- **2026-06-21** â Phase-0 D complete + GREEN: check â / check-types â / test â (3 tests). Fixed biome nested-root (fumadocs root:false), overrode framework-incompatible rules, excluded vendored skills + docs-site, fixed 5 real lint errors. Pinned postgres:18-alpine. tech-stack.md added (versions/compat verified; flagged lucide-react split + biome 2.4.16/2.5.0 dedup as follow-ups).

- **2026-06-21** â D config wired: vitest(happy-dom)+smoke test â `bun run test` PASSES (3 tests); playwright.config+e2e placeholder; .github/workflows/ci.yml; root test/lint/e2e scripts + lint-staged; turbo test task; docker redis+minio (base compose); fixed broken `bun test` pre-commit â lint-staged + check-types.

- **2026-06-21** â Central infra (KareTech VPS, save resources): provisioned `retailos` DB (least-priv role) in postgres-central; creds stored in Infisical /credentials/retailos (prod); REDIS_URLâredis-shared/3. Added docker-compose.prod.yml (VPS override reuses central via pangolin; others use self-contained base compose). Hybrid confirmed.

- **2026-06-21** â Automation lane: added SessionStart hook + scripts/log-progress.sh + CLAUDE.md progress protocol (lean+linked). Multi-agent Work-lanes table added to PROGRESS.md.

- **2026-06-21** â Phase 0 started. Plan approved (docs + foundation config, no feature code; competitive matrices deferred per-module). Branch `phase-0-architecture-foundation` created; `PROGRESS.md` added. Confirmed `base-lyra` = Base UI. Prior this session (on `master`): UI inventory v2 complete, registry config corrected & live-verified, `lessons-learned.md` seeded (12 entries).
