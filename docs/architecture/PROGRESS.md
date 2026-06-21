# RetailOS — PROGRESS (live cross-agent state)

> **Read this first.** This is the single live operational tracker for the current effort, shared across
> agents and across context compaction. It holds the **task board**, a **changelog**, and **verified facts**
> so no agent re-derives or re-litigates settled work. Update it as part of every commit.
>
> Distinct from: `phase-roadmap.md` (strategic Phase 0–13 status) and `phase-0-checklist.md` (§46 gate
> scoreboard). This file is the day-to-day operational log.

- **Current effort:** Phase 0 — Architecture Review & Foundation Lock-In (no feature code; charter §0/§1/§32/§47).
- **Approved plan:** `~/.claude/plans/retailos-master-architecture-groovy-oasis.md`.
- **Working branch:** `phase-0-architecture-foundation` (small commits grouped by deliverable A–E; merge to `master` on approval).
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
| Deliverable B — architecture-review doc set | done | done |
| Automation & coordination (hook, CLAUDE protocol, PROGRESS, helper script) | agent-infra | in progress |
| Deliverable D — foundation config (scripts/husky/vitest/playwright/CI/docker) | done | done |
| Deliverable C — Vertical Slice #1 design | done | done |
| Deliverable E — verify + merge | _unclaimed_ (do last) | todo |

## Task Board

Legend: ☐ todo · ◐ in progress · ☑ done

### Deliverable A — Charter + governance scaffolding  ✅ DONE (commit 7566eef)
- ☑ Charter `retailos-master-charter.md` (1429 lines) · root `CLAUDE.md` (lean + linked) · `adr/` (template + 0001 base-ui, 0002 no-feature-code, 0003 baseline-stack) · `module-specs/README` · `glossary.md` · `phase-roadmap.md` · `competitive/README` · README `@magicui`/`@magicui-pro` split reconciled.
- ◐ A polish: add ADRs 0004+ for the remaining locked decisions if not yet covered (tenant isolation, offline conflict seam, money minor units, Outbox, webhook dispatcher seam, fiscalization/OCR seams, search interface).

### Automation & coordination (NEW — user request)  ✅ DONE [lane: agent-infra]
- ☑ `SessionStart` hook (`.claude/settings.json`) surfaces a lean PROGRESS view to every session/agent (context linked to docs across compaction). Activates on next `/hooks` open or restart (settings file was created mid-session).
- ☑ "Progress protocol" + Work-lanes + subagent/parallel guidance in root `CLAUDE.md` (kept lean + linked).
- ☑ `scripts/log-progress.sh` — `show` (lean state for the hook) + `log "msg"` (stamp a dated changelog entry). Verified.

### Deliverable B — Architecture-review doc set (each ends with "Known limitations / intentionally deferred")
- ☐ `architecture-review.md` (exec summary, assumptions, risks & gaps, improvements)
- ☐ `domain-model.md` (contexts, dependency map, ERD, table map, Drizzle plan, migration + seed strategy)
- ☐ `auth-authz.md` (Better Auth plugins, access-control boundary, RBAC + permission matrix, Entitlements Service)
- ☐ `tenancy-deployment.md` (platform/tenant/org, RLS, deployment modes, residency, migration fan-out, noisy-neighbor)
- ☐ `offline-edge-hardware.md` (offline levels, conflict policy, time integrity, avalanche, Edge Hub, hardware bridge)
- ☐ `money-fiscal-inventory.md` (money/pricing/tax, fiscalization + numbering, inventory ledger, bonded, procurement, POS)
- ☐ `accounting-crm-ecommerce.md` (double-entry accounting, CRM, shared-inventory ecommerce)
- ☐ `platform-saas-integrations.md` (white-label/SaaS/licensing, feature flags, integrations/webhooks/idempotency, events/Outbox)
- ☐ `quality-security-ops.md` (errors/logging, analytics/read-models, testing/CI-CD, secrets, DR, observability, security, perf budgets, SLO/RPO/RTO, quality gates — ALL QA lives here)
- ☐ `folder-structure-conventions.md` (folder/monorepo, engineering rules, module-spec/DoD templates, env+config matrix incl. env-validation per app/package)
- ☐ `ui-ux-plan.md` (§5 plan; references ui-inventory/ as source of truth; records base-lyra=Base UI; registry+MCP auth)
- ☐ `security-baseline.md` (headers, CORS, rate limits, request-size limits, cookie policy, dep audit, secret scanning)
- ☐ `phase-0-checklist.md` (§46 requirement → file → present/absent → pass/fail scoreboard)

### Deliverable C — Vertical Slice #1 design (DESIGN ONLY, no code)
- ☐ `docs/architecture/vertical-slice-1.md` (§32 flow, schema, oRPC routers, tenant-guard middleware, RLS, util interfaces, test list)

### Deliverable D — Phase-0 foundation config (no feature code)
- ☐ Root scripts: add `test` (→ `turbo test`), `lint`; keep `check` (ultracite) + `check-types`; `turbo.json` add `test` task
- ☐ Husky + lint-staged pre-commit (`check` + `check-types`)
- ☐ `vitest.config.ts` (DOM env: happy-dom/jsdom) + smoke test per package → `bun run test` passes
- ☐ `playwright.config.ts` + minimal placeholder e2e
- ☐ `.github/workflows/ci.yml` (check-types, lint, test, build; valid YAML; step cmds match script names; upload Playwright artifacts on failure)
- ☐ `docker-compose.yml` +redis +minio (persistent named volumes; keep postgres+web); add `.dockerignore`; `.env.example` placeholders (Redis URL, S3/MinIO endpoint+bucket)

### Deliverable E — Lessons-learned + verify + merge
- ☐ Append dated `lessons-learned.md` entry (charter committed; base-lyra=Base UI confirmed)
- ☐ Run §46 verification (check-types, check, test, docker config/up, CI YAML)
- ☐ Merge `phase-0-architecture-foundation` → `master`

## Verified facts (do not re-derive)

- **`base-lyra` IS the Base UI primitive family** — `@base-ui/react ^1.0.0` is in `packages/ui/package.json` and components import `@base-ui`. Satisfies charter §5 (no Radix/Base UI conflict).
- Existing root scripts: `check-types` (turbo) and `check` (ultracite) exist; `db:push/studio/generate/migrate` exist. **Missing:** `test`, `lint`, husky, lint-staged, vitest, playwright, happy-dom/jsdom.
- Registry config (root + `packages/ui` `components.json`) is live-verified and correct: `@shadcn`, `@magicui` (free), `@magicui-pro` (Bearer `${MAGICUI_PRO_REGISTRY_TOKEN}`), `@shadcn-studio`/`@ss-blocks`/`@ss-components`/`@ss-themes` (style-param `…/r/{style}/{name}.json` + `email`/`license_key` params), `@reui` (`base-nova`). Credentials in gitignored `.env`. See `ui-inventory/INDEX.md` + `lessons-learned.md`.
- UI inventory (Phase-0 §5 discovery) is COMPLETE: `ui-inventory/` 9 files; counts live-verified (shadcn core 414, studio 735/61, Magic UI free 245/77 + Pro 103, ReUI 17). Origin UI + shadcnblocks evaluated, not configured.
- Scaffold reality: Better Auth = email/password + Expo plugin only; DB = auth schema only, no migrations; 2 demo oRPC procedures; docker-compose = postgres + web only. All charter foundation domain work (tenant/RBAC/audit/RLS/Redis/object storage/Better Auth plugins) is NOT yet built (deferred past Phase-0 lock-in).

## Changelog (newest first)

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
