# RetailOS — PROGRESS (live cross-agent state)

> **Read this first.** This is the single live operational tracker for the current effort, shared across
> agents and across context compaction. It holds the **task board**, a **changelog**, and **verified facts**
> so no agent re-derives or re-litigates settled work. Update it as part of every commit.
>
> Distinct from: `phase-roadmap.md` (strategic Phase 0–13 status) and `phase-0-checklist.md` (§46 gate
> scoreboard). This file is the day-to-day operational log.

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
