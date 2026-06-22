# Phase 0 — Lock-In Checklist (§46 scoreboard)

> Charter §46 gate for Phase-0 completion. **Phase 0 is locked-in** (merged to `master`, CI green); this is the
> post-lock-in scoreboard, re-verified by the 2026-06-21 audit-only red-team pass (see `phase-0-audit.md`).
> Legend: ✅ done · ⚠️ partial/deferred · ❌ missing.

## Required artifacts (§46)

| Requirement | Path | Status |
|---|---|---|
| Master charter | `docs/architecture/retailos-master-charter.md` | ✅ (v4.1, 1429 lines) |
| Agent entry point | `CLAUDE.md` (root) + `.claude/CLAUDE.md` | ✅ lean + linked |
| ADRs | `docs/architecture/adr/` | ✅ template + 0001 base-ui, 0002 no-feature-code, 0003 baseline-stack, 0004 central-infra-reuse, 0005 product-intelligence-deferred |
| Module specs | `docs/architecture/module-specs/` | ✅ README + template |
| Competitive | `docs/architecture/competitive/` | ✅ README + matrix template (matrices deferred per-module, §41) |
| Phase roadmap | `docs/architecture/phase-roadmap.md` | ✅ |
| Glossary | `docs/architecture/glossary.md` | ✅ |
| Lessons learned | `docs/architecture/lessons-learned.md` | ✅ (16 entries) |
| UI inventory | `docs/architecture/ui-inventory/` | ✅ 10 files, live-verified |
| CI workflow | `.github/workflows/ci.yml` | ✅ check-types/lint/test/build + e2e (artifact upload) |
| Vitest config | `vitest.config.ts` | ✅ happy-dom + smoke test |
| Playwright config | `playwright.config.ts` | ✅ + `e2e/` placeholder |
| Env/config matrix (§36) | `docs/architecture/folder-structure-conventions.md` | ✅ |
| Docker hardening plan (§28) | `.dockerignore` + `docs/architecture/docker-and-cicd.md` | ✅ multi-stage distroless `apps/web/Dockerfile` (2.38GB→168MB, boots verified) + CI image-build job with ≤350MB size budget + `.dockerignore`; ⚠️ Trivy container scan still to wire (CI/CD phase) |

## Architecture-review doc set (§49)

`architecture-review.md` ✅ · `domain-model.md` ✅ · `auth-authz.md` ✅ · `tenancy-deployment.md` ✅ · `offline-edge-hardware.md` ✅ · `money-fiscal-inventory.md` ✅ · `accounting-crm-ecommerce.md` ✅ · `platform-saas-integrations.md` ✅ · `quality-security-ops.md` ✅ · `folder-structure-conventions.md` ✅ · `ui-ux-plan.md` ✅ · `security-baseline.md` ✅ · `vertical-slice-1.md` ✅ · `tech-stack.md` ✅ — each ends with "Known limitations / intentionally deferred" (audited).

## Quality gates (§46 completion criteria)

| Gate | Command | Status |
|---|---|---|
| Types pass | `bun run check-types` | ✅ green |
| Lint/format pass | `bun run check` (Ultracite/Biome) | ✅ green |
| Tests exist & pass | `bun run test` (Vitest) | ✅ 3 tests pass |
| CI green | `.github/workflows/ci.yml` | ✅ green on master (commits `4ce9499`/`cfcf588`/`bdc51f6`) |
| Docker build verified | `docker compose config` / `docker:build` | ✅ web image builds (168MB) and boots+listens; CI docker job enforces ≤350MB |
| Charter/ADRs/specs committed | git | ✅ merged to `master` |

## Deferred to Phase 1+ (intentional, §47)

- Feature/domain code: tenant model, RBAC/entitlements, audit, RLS, Better Auth plugins (organization/admin/2FA/SCIM/device-auth), Redis client lib, object-storage client — design only in Phase 0.
- Vertical Slice #1 **implementation** (designed in `vertical-slice-1.md`).
- Full §43 gates: a11y (WCAG 2.2 AA), SAST + secret scan, dependency audit, container scan (Trivy), bundle-size + perf budgets, Playwright VRT — stubbed/TODO in CI.
- Dependency follow-ups (`tech-stack.md`): align `lucide-react` majors; dedup Biome (2.4.16/2.5.0); bump Better-Auth 1.6.11→1.6.20 with `@better-auth/expo`.

**Phase 0 is COMPLETE and locked-in:** CI is green on master, the Docker image builds and boots, and the architecture review + Vertical Slice #1 design are done. A 2026-06-21 audit-only red-team pass (`phase-0-audit.md`) found **zero CRITICAL / zero HIGH** findings (one MEDIUM — a claimed postgres-volume risk — was dismissed on live probe: `postgres:18` uses `PGDATA=/var/lib/postgresql/18/docker` under the mounted `/var/lib/postgresql`). Phase 1 (Identity/Tenant/RBAC/Audit) may begin against this foundation.
