# RetailOS — Agent Entry Point (Codex / AGENTS.md)

> This mirrors `CLAUDE.md` for Codex and any AGENTS.md-reading agent. `CLAUDE.md` is the canonical entry point; keep the two in sync. **Read the charter, `lessons-learned.md`, and `PROGRESS.md` before planning or implementing anything** (charter §40/§48).

## Read first (every task)

- `docs/architecture/retailos-master-charter.md` — governing charter (source of truth).
- `docs/architecture/lessons-learned.md` — append-only verified mistakes; never repeat them; append after any task with a correction/surprise.
- `docs/architecture/PROGRESS.md` — live cross-agent state (branches/PRs, current step, locked decisions). Update it in the same commit as a change.
- `docs/architecture/phase-roadmap.md` — phase status / scope.
- `.claude/CLAUDE.md` — Ultracite/Biome code standards + shadcn/MCP workflow rules.

## Current state (2026-06-22)

- **Phase 1 / VS#1 done** — PR #1 merged to master (tenant-isolation spine: fail-closed RLS, 3-role model, `withTenant`, audit/outbox/idempotency, money=bigint minor units).
- **Phase 2 (Inventory) in progress** on branch `phase-2-implementation` — plan approved; D1–D7 locked (ADR-0007 + `module-specs/inventory.md`); schema/RLS/seed/services/inventory routers/catalog CRUD/product Phase-2 create+list/update/archive fields/variant lifecycle/lot lifecycle/reorder-rule CRUD/discrepancy review/revaluation/import preview/mixed-catalog router e2e are implemented. **No P0 backend gaps remain for approved scope; phase-close audit is next.** Docs: `phase-2-implementation-plan.md`, `event-map-phase2.md`, `inventory-screen-map.md`, `phase-2-api-contracts.md`, `phase-2-gap-analysis.md`.
- Active reviewer loop: **Codex adversarial review** per commit (CRITICAL/HIGH only). Do NOT trigger other reviewers or a review gate unless asked.

## Non-negotiable rules (charter §33/§39/§40)

- Drizzle (not Prisma); strict TypeScript; Zod validation. **Extensible value sets** (tracking_mode, costing_method, oversell/expiry policy, barcode parser type, reason codes, UoM roles, movement types) use `text({ enum: [...] })` + CHECK/Zod — **never native `pgEnum`**.
- **Every new tenant-owned table gets fail-closed RLS in the same commit;** the `packages/db` `tenant-isolation-coverage` test mechanically blocks any uncovered tenant table.
- Every query tenant-scoped (via `withTenant`); every mutation audited; every inventory move is a ledger entry; every POS sale idempotent.
- Money = integer minor units (amount + currency + scale); never floats. Inventory value follows quantity (qty=0 ⟺ value=0); AVCO carries exact-integer remainders, FIFO is division-free; rounding only at display/GL (D-money mode still open, Phase 5).
- No hard deletes for operational data. Server time authoritative; device clocks untrusted.
- Never commit secrets/registry tokens (env vars only). No architecture change without an ADR. Small, reviewable commits.
- **Never edit Markdown/text docs with `perl`/`sed`/`awk`** (UTF-8 mojibake) — use editor/native fs; the `scripts/check-mojibake.mjs` pre-commit guard enforces this.
- Run `bun run check` + `check-types` + `test` before claiming done. Never `--no-verify` past a failing gate. Verify external tool/registry facts against official docs + a live probe.

## Workflow

- Branch per phase (`phase-N-*`); **all work = PRs to master, never push to master directly; never merge without owner approval.** For stacked PRs, retarget the child to master before deleting the parent branch (deleting a base branch *closes* the child PR, it does not retarget — see lessons-learned).
- Per-phase build order (Phase 2 onward): schema → migrations → RLS → ROBUST seed → services → routers → validation → RBAC → audit/outbox → tests → API contract docs.
- **No production UI** until APIs are stable + approved; later UI pulls strictly from `docs/architecture/ui-inventory/` + configured MCP registries (shadcn Studio / Magic UI / ReUI), re-themed to RetailOS tokens — never hand-rolled generic React.
