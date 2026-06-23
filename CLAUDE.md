# RetailOS — Agent Entry Point

> Lean entry point per charter §34. Read this, the charter, and `lessons-learned.md` **before** planning or
> implementing anything (§40, §48). Do not build the whole ERP at once; work one bounded module at a time.

## Read first (every task)

- @docs/architecture/retailos-master-charter.md — the governing charter (source of truth).
- @docs/architecture/lessons-learned.md — append-only verified mistakes; never repeat them. Append after any task with a correction/surprise/contradiction.
- @docs/architecture/phase-roadmap.md — phase status and what's in scope now.
- `docs/architecture/PROGRESS.md` — live cross-agent task board + changelog (a `SessionStart` hook surfaces a lean view automatically). **Claim a lane before writing**; `git pull --rebase` before committing (multiple agents share the branch).
- `docs/architecture/phase-2-implementation-plan.md` — approved Phase 2 build order and costing/RLS/seed/test design; **Commit 0 gate first, resolver later**.
- `docs/architecture/event-map-phase2.md` and `docs/architecture/inventory-screen-map.md` — downstream event/API/screen planning docs; planning only, no UI implementation.
- @.claude/CLAUDE.md — code standards (Ultracite/Biome) and shadcn/studio MCP workflow rules.

## Architecture references (read the relevant ones for your task)

- Architecture review & gaps: `docs/architecture/architecture-review.md`
- Domain model & ERD: `docs/architecture/domain-model.md`
- Auth & authorization: `docs/architecture/auth-authz.md`
- Tenancy, RLS, deployment, residency: `docs/architecture/tenancy-deployment.md`
- Offline, Edge Hub, hardware: `docs/architecture/offline-edge-hardware.md`
- Money, fiscal, inventory, POS: `docs/architecture/money-fiscal-inventory.md`
- Accounting, CRM, ecommerce: `docs/architecture/accounting-crm-ecommerce.md`
- Platform/SaaS/integrations/events: `docs/architecture/platform-saas-integrations.md`
- Quality, security, ops: `docs/architecture/quality-security-ops.md` and `docs/architecture/security-baseline.md`
- Docker images & CI/CD (source of truth): `docs/architecture/docker-and-cicd.md`
- Tech stack & verified dependency versions: `docs/architecture/tech-stack.md`
- Folder structure, conventions, env matrix: `docs/architecture/folder-structure-conventions.md`
- UI/UX & component sourcing: `docs/architecture/ui-ux-plan.md` + `docs/architecture/ui-inventory/INDEX.md`
- Vertical Slice #1 design: `docs/architecture/vertical-slice-1.md`
- Phase 2 (Inventory) — ✅ COMPLETE/FROZEN (merged `72b2100`): `docs/architecture/phase-2-complete.md` (archive) · `phase-2-implementation-plan.md` · `event-map-phase2.md` · `phase-2-api-contracts.md` · `phase-2-gap-analysis.md` (D1–D7 locked; ADR-0007/0008)
- Phase 3 (Locations/Warehouses/Bonds) — PLANNING (no code; awaiting owner approval): `docs/architecture/phase-3-implementation-plan.md` · `phase-3-gap-analysis.md` · `module-specs/locations-warehouses-bonds.md` · `event-map-phase3.md` · `competitive/locations-warehouses-bonds.md` (parked debt #5 composite-FK + #7 set-once DB-trigger paid first; unified self-referential `location` tree + flags; two-step intra-company-only transfers; bond-release duty reuses the value-only `valuation_adjustment` seam; transfer value-conservation is the load-bearing design question — AVCO reuses seams, only FIFO needs an additive costing touch)
- Decisions: `docs/architecture/adr/` · Module specs: `docs/architecture/module-specs/` · Competitive: `docs/architecture/competitive/`
- Phase-0 lock-in scoreboard: `docs/architecture/phase-0-checklist.md`

## Non-negotiable rules (charter §33/§39/§40)

- Drizzle (not Prisma); strict TypeScript; Zod validation. For **extensible** value sets (tracking_mode, costing_method, oversell/expiry policy, barcode parser type, reason codes, UoM roles, movement types) use `text({ enum: [...] })` + CHECK/Zod — **never native `pgEnum`**.
- New tenant-owned table ⇒ add fail-closed RLS in the same commit; the `tenant-isolation-coverage` test (packages/db) mechanically blocks any uncovered tenant table.
- Every query tenant-scoped; every mutation audited; every inventory move is a ledger entry; every POS sale idempotent.
- Money = integer minor units (amount + currency + scale together); never floats; one rounding policy.
- Phase 2 schema convention: do not use native Postgres `pgEnum` for extensible inventory values; use Drizzle `text({ enum: [...] })` plus CHECK/Zod validation.
- No hard deletes for operational data (crypto-shredding for erasure). Server time authoritative for accounting/fiscal; device clocks untrusted.
- Secrets via envelope encryption; never commit secrets or registry tokens (env vars only); never log decrypted secrets.
- No architecture change without an ADR. Small, reviewable commits. Run `check-types`, `check`, `test` before claiming done.
- Verify external tools/registries against official docs + a live probe before asserting facts; fix contradictions in the same change and record them.

## Working agreement (this session's verified preferences)

- Live-verify registry/endpoint facts; do not trust marketing counts (state only enumerated counts).
- Consolidate docs; don't create overlapping checklist files.
- Keep commits small and grouped by deliverable; summarize impacted files.
- **Progress protocol:** update `PROGRESS.md` (task board + changelog, or `scripts/log-progress.sh log "…"`) and any affected docs in the **same commit** as a major/long change — so docs, state, and code never drift. Keep this CLAUDE.md lean: link to docs, don't inline them.
- Use subagents / parallel workflows for independent work (doc drafting, enumeration, audits); partition via the PROGRESS.md Work-lanes table to avoid collisions.
