# RetailOS — Agent Entry Point (Codex / AGENTS.md)

> This mirrors `CLAUDE.md` for Codex and any AGENTS.md-reading agent. `CLAUDE.md` is the canonical entry point; keep the two in sync. **Read the charter, `lessons-learned.md`, and `PROGRESS.md` before planning or implementing anything** (charter §40/§48).

## Read first (every task)

- `docs/architecture/retailos-master-charter.md` — governing charter (source of truth).
- `docs/architecture/lessons-learned.md` — append-only verified mistakes; never repeat them; append after any task with a correction/surprise.
- `docs/architecture/engineering-principles.md` — the constitution (backend-owns-truth, one-owner-per-invariant, write-path-through-owning-service, Money primitives, stamp-irreproducible-facts, imported-blocks-become-owned, verify-against-docs, gate-by-kind, per-phase finish loop, products-not-phases).
- `docs/architecture/PROGRESS.md` — live cross-agent state (branches/PRs, current step, locked decisions). Update it in the same commit as a change.
- `docs/architecture/phase-roadmap.md` — phase status / scope.
- `.claude/CLAUDE.md` — Ultracite/Biome code standards + shadcn/MCP workflow rules.

## Current state (2026-06-22)

- **Phase 1 / VS#1 done** — PR #1 merged (tenant-isolation spine: fail-closed RLS, 3-role model, `withTenant`, audit/outbox/idempotency, money=bigint minor units).
- **Phase 2 (Inventory) ✅ COMPLETE / 🔒 FROZEN** — schema (PR #4 `d39428d`) + behavior pass (PR #9 `72b2100`) merged to master; CI 4/4 green. Narrative archived in `phase-2-complete.md`. D1–D7 locked (ADR-0007/0008 + `module-specs/inventory.md`). "Frozen" = further Phase-2 work is a change request. **Parked → later phases:** #8 POS↔costing + `cost_reconciliation` (Phase 4); #6 precision/`mulDivRound` + `valuation_updated` enrichment (Phase 5); #7 set-once DB-trigger + #5 composite-FK (Phase 3).
- **Phase 3 (Locations / Warehouses / Bonds) — PLANNING (revised).** Packet drafted (`phase-3-implementation-plan.md`, `phase-3-gap-analysis.md`, `module-specs/locations-warehouses-bonds.md`, `event-map-phase3.md`, `competitive/locations-warehouses-bonds.md`). **Parked debt paid FIRST:** #5 composite-FK (`UNIQUE(tenant_id,id)` on company/location/product/sku/lot; new tables born `FK (tenant_id, x_id)`) **+** #7 set-once costing-method DB-trigger, before any new table. **Unified self-referential `location` tree** (`parent_location_id`) + flags (`is_sellable/is_quarantine/is_bonded/is_transit`) + bin capacity seam. **Two-step intra-company-only transfers** (in-transit node; inter-company blocked → P5 GL). **Bond-release duty reuses the existing value-only `valuation_adjustment` seam** (no new costing). Transfer VALUE conservation: AVCO reuses receipt + value-only seams (no frozen change); only FIFO needs an additive `transfer_in` primitive. **No Phase-3 schema/code until owner answers the 6 open decisions** (plan §I).
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
- **No production UI** until APIs are stable + approved; later UI pulls strictly from `docs/architecture/ui-inventory/` + the gitignored template sources + configured MCP registries (shadcn Studio / Magic UI / ReUI), re-themed to RetailOS tokens — never hand-rolled generic React. **Governance:** `docs/architecture/frontend-strategy.md` (RetailOS **UI Platform**, the **7-layer stack** AdminCN shell → **CommerceO** commerce → shadcn **Studio Blocks** → shadcn **Studio Components** → shadcn/ui → Magic UI → custom; every block becomes owned code in `packages/ui`, wired to oRPC, re-themed, stripped of mock/Next/auth/routing; AdminCN + CommerceO = visual targets, backend authoritative). Per-module registry + Screen Composition = `docs/architecture/ui-source-registry.md`; per-component source = `docs/architecture/component-preference-matrix.md`; vertical presets = `docs/architecture/vertical-presets.md`; design law = the `retailos-design-language` skill.
