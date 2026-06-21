# Phase 0 — Lock-In Checklist (§46 scoreboard)

> Charter §46 gate for Phase-0 completion. Status as of 2026-06-21 on branch `phase-0-architecture-foundation`.
> Legend: ✅ done · ⚠️ partial/deferred · ❌ missing.

## Required artifacts (§46)

| Requirement | Path | Status |
|---|---|---|
| Master charter | `docs/architecture/retailos-master-charter.md` | ✅ (v4.1, 1429 lines) |
| Agent entry point | `CLAUDE.md` (root) + `.claude/CLAUDE.md` | ✅ lean + linked |
| ADRs | `docs/architecture/adr/` | ✅ template + 0001 base-ui, 0002 no-feature-code, 0003 baseline-stack |
| Module specs | `docs/architecture/module-specs/` | ✅ README + template |
| Competitive | `docs/architecture/competitive/` | ✅ README + matrix template (matrices deferred per-module, §41) |
| Phase roadmap | `docs/architecture/phase-roadmap.md` | ✅ |
| Glossary | `docs/architecture/glossary.md` | ✅ |
| Lessons learned | `docs/architecture/lessons-learned.md` | ✅ (14 entries) |
| UI inventory | `docs/architecture/ui-inventory/` | ✅ 10 files, live-verified |
| CI workflow | `.github/workflows/ci.yml` | ✅ check-types/lint/test/build + e2e (artifact upload) |
| Vitest config | `vitest.config.ts` | ✅ happy-dom + smoke test |
| Playwright config | `playwright.config.ts` | ✅ + `e2e/` placeholder |
| Env/config matrix (§36) | `docs/architecture/folder-structure-conventions.md` | ✅ |
| Docker hardening plan (§28) | `.dockerignore` + `docs/architecture/quality-security-ops.md` | ⚠️ `.dockerignore` + plan documented; multi-stage/distroless + Trivy scan to wire in CI/CD phase |

## Architecture-review doc set (§49)

`architecture-review.md` ✅ · `domain-model.md` ✅ · `auth-authz.md` ✅ · `tenancy-deployment.md` ✅ · `offline-edge-hardware.md` ✅ · `money-fiscal-inventory.md` ✅ · `accounting-crm-ecommerce.md` ✅ · `platform-saas-integrations.md` ✅ · `quality-security-ops.md` ✅ · `folder-structure-conventions.md` ✅ · `ui-ux-plan.md` ✅ · `security-baseline.md` ✅ · `vertical-slice-1.md` ✅ · `tech-stack.md` ✅ — each ends with "Known limitations / intentionally deferred" (audited).

## Quality gates (§46 completion criteria)

| Gate | Command | Status |
|---|---|---|
| Types pass | `bun run check-types` | ✅ green |
| Lint/format pass | `bun run check` (Ultracite/Biome) | ✅ green |
| Tests exist & pass | `bun run test` (Vitest) | ✅ 3 tests pass |
| CI green | `.github/workflows/ci.yml` | ⚠️ workflow valid; runs on push/PR (confirm first run green) |
| Docker build verified | `docker compose config` / `docker:build` | ⚠️ `docker compose config` validates; full image build verify pending |
| Charter/ADRs/specs committed | git | ✅ on branch (merging to master) |

## Deferred to Phase 1+ (intentional, §47)

- Feature/domain code: tenant model, RBAC/entitlements, audit, RLS, Better Auth plugins (organization/admin/2FA/SCIM/device-auth), Redis client lib, object-storage client — design only in Phase 0.
- Vertical Slice #1 **implementation** (designed in `vertical-slice-1.md`).
- Full §43 gates: a11y (WCAG 2.2 AA), SAST + secret scan, dependency audit, container scan (Trivy), bundle-size + perf budgets, Playwright VRT — stubbed/TODO in CI.
- Dependency follow-ups (`tech-stack.md`): align `lucide-react` majors; dedup Biome (2.4.16/2.5.0); bump Better-Auth 1.6.11→1.6.20 with `@better-auth/expo`.

**Phase 0 is complete** once CI's first run is green and a Docker image build is verified; the architecture review and Vertical Slice #1 design are done, so Phase 1 (Identity/Tenant/RBAC/Audit) may begin against this foundation.
