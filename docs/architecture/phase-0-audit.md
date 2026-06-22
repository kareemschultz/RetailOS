# Phase 0 — Audit-Only Red-Team Pass (vs Charter v4.1)

> **Date:** 2026-06-21 · **Scope:** entire Phase-0 deliverable set (governance docs, architecture-review
> doc set, Vertical Slice #1 design, foundation config) audited against the charter
> (`retailos-master-charter.md` v4.1). **Method:** 5 independent read-only auditors partitioned by charter
> concern — governance/§46-completeness, foundation config/gates, architecture-doc fidelity, slice-1 +
> foundation-before-features discipline, secrets/security/contradictions. **No implementation during the audit**
> (charter §1/§45 reassessment loop).

## Verdict

**Zero CRITICAL · Zero HIGH.** Phase-0 lock-in is **not blocked**. Every §33/§39 non-negotiable is correctly and
non-contradictorily encoded in the doc that owns it; all 39 §49 plan-mode outputs are covered on disk; no
committed secrets; no premature feature code (codebase is at exact scaffold baseline). Findings are stale
governance metadata (since fixed) plus deferred engineering items (queued).

| Severity | Count | Disposition |
|---|---|---|
| CRITICAL | 0 | — |
| HIGH | 0 | — |
| MEDIUM | 7 (1 dismissed on verification) | 5 doc-sync fixed now; 1 engineering queued; 1 dismissed |
| NICE-TO-HAVE | ~9 | queued / no-action |

## MEDIUM findings

| # | Finding | Charter § | Disposition |
|---|---|---|---|
| M1 | `quality-security-ops.md` gate table marked `test`/`lint`/CI/Vitest as TODO — stale; they are wired and CI is green | §43/§46 | **Fixed** (gate table updated, cross-ref to `docker-and-cicd.md`) |
| M2 | `phase-roadmap.md` said Phase 0 "In progress" + listed only ADRs 0001–0003 — contradicts checklist/PROGRESS | §34/§40 | **Fixed** (status → Complete/locked-in; ADRs 0001–0005) |
| M3 | `phase-0-checklist.md` Docker-hardening row understated (multi-stage distroless image + CI size gate now exist) | §28 | **Fixed** (row updated; lessons 14→16; ADR list) |
| M4 | `adr/README.md` index omitted ADRs 0004 + 0005 (both exist + substantive) | §34 | **Fixed** (index updated) |
| M5 | `CLAUDE.md` Architecture-references list did not link `docker-and-cicd.md` / `tech-stack.md` (orphaned) | §34 | **Fixed** (both added) |
| M6 | turbo `test` task is dead (`dependsOn ^test`, but no workspace package defines a `test` script); only root `vitest run` actually gates | §43 | **Queued** (test-architecture decision; harmless today, CI green) |
| M7 | Postgres named volume mounts `/var/lib/postgresql` not `…/data` — claimed data-loss risk | §47 | **Dismissed** — false positive. Live probe: `postgres:18-alpine` sets `PGDATA=/var/lib/postgresql/18/docker` and `VOLUME /var/lib/postgresql`; our mount is the **correct parent** for PG18. (Recorded as a lessons-learned entry.) |

## NICE-TO-HAVE findings (queued / no-action)

- **§43 gates deferred** (a11y/WCAG 2.2 AA, Trivy container scan, dependency audit, SAST/secret-detection,
  bundle-size, Playwright VRT) — honestly documented as TODO in CI + `docker-and-cicd.md`; land Phase 1+. (§43/§28)
- **§44 performance budgets** documented but no enforcing CI gate (only the Docker image-size budget is enforced). Phase 1+. (§44)
- **Slice-1 build-time reminders:** make the "every mutation audited" wiring explicit on `product.create` /
  `inventory.receive` / `company.create` (not just `pos.createSale`); enumerate a logger/error-code interface
  alongside the other utils. Belongs to the Phase-1 implementation of `vertical-slice-1.md`. (§25/§33/§42)
- **`domain-model.md` ERD diagram** omits the membership table (present in the §5 table map) — cosmetic diagram gap. (§7)
- **turbo `lint` task** is also a no-op (only `apps/fumadocs` defines `lint`); CI lints via root `ultracite check`. Config cleanup with M6. (§43)
- **Vendored `.agents/skills/hono/SKILL.md`** contains a textbook `basicAuth({username,password})` example — third-party skill docs, not RetailOS code; no action. (§25)

## What was verified clean (no findings)

- **Secrets (§25):** only `.env.example`/`.dev.vars.example` tracked; all tokens are `${ENV}` placeholders;
  `components.json` (root + `packages/ui`) byte-identical and lesson-#1 compliant; `.gitignore` complete.
- **Security baseline (§29):** `security-baseline.md` is actionable (headers, default-deny CORS, tenant-keyed
  rate limits, request-size/JSON-depth limits, cookie policy, dep-audit/SAST/Trivy-in-CI, tokenized-card-only,
  session/device revocation, zero-trust Edge mTLS) with honest deferral notes.
- **Architecture-doc fidelity (§33/§39):** ledger-based inventory, integer-minor-unit money + one rounding
  policy, `tenant_id` + audit on every tenant-owned table, no-hard-delete, append-only ledgers/audit,
  RLS (`FORCE` + `WITH CHECK`, non-`BYPASSRLS` role, fail-closed on missing GUC), coarse-BetterAuth /
  fine-Entitlements boundary, idempotency keys scoped tenant+endpoint+operation, Outbox-in-transaction,
  self-hostable webhook-dispatcher seam, server-authoritative posting time — all stated, no contradictions.
- **Foundation-before-features (§47):** codebase at exact scaffold baseline — auth-only Drizzle schema, **no
  domain migrations**, 2 demo oRPC procedures, Better Auth = email/password + `[expo()]` only. No premature
  tenant/RBAC/audit/RLS/product/inventory/POS/accounting code.
- **Slice-1 design (§32):** full flow covered with Drizzle schema additions, oRPC signatures, Hono tenant-guard,
  RLS design, and the four util interfaces (audit-log, idempotency, stock-ledger, accounting-posting) + test list.
- **Config/gates:** root scripts present; husky pre-commit runs `lint-staged` + `check-types` (no bare-`bun test`
  zero-test error); `bun run test` passes (3 smoke tests); CI YAML valid, step commands match script names,
  Playwright artifacts upload on failure; both compose files validate; Dockerfile 3-stage distroless-bun, non-root.

## Coverage

- **39 of 39 §49 plan-mode outputs** covered on disk (#38 per-module competitive matrices intentionally
  template-only per §41 just-in-time deferral).
- **14 §49 architecture-review docs** + glossary, all substantive.
- **ADRs 0001–0005** present and substantive.

## Backlog created by this audit (for Phase 1+)

1. Resolve the turbo `test`/`lint` no-op tasks (decide per-package test scripts vs keep root-only invocation) — M6.
2. Wire the deferred §43 gates: a11y, Trivy, dependency audit, SAST/secret-scan, bundle-size, VRT.
3. Add a §44 performance-budget CI gate (POS load/search, admin first-load, warehouse scan).
4. At Slice-1 implementation: explicit per-mutation audit wiring + a structured logger/error-code interface.
5. Add the membership table to the `domain-model.md` Mermaid ERD.

> Per the standing instruction, only CRITICAL findings were to be fixed before Phase 1. There were none; the
> stale-metadata MEDIUMs were nonetheless resolved in the same pass (charter §40 forbids leaving a known
> contradiction in place, and they were drift created by this session's own Docker/dep work). All engineering
> items above are queued, not silently dropped.
