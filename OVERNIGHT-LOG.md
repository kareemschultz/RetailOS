# RetailOS — Overnight Run Log

> **Kareem: read this first.** Every decision, gate result, Codex finding, and ⚠️ MORNING REVIEW flag is here.
> Branch: `phase-3-overnight` (off `phase-3-commit-3` HEAD `fe11d67`). PR #17 NOT merged.
> Master is frozen. This branch accumulates all work for your morning review before any merge.

## Summary (fill as run progresses)

| Item | Status | SHA | Notes |
|------|--------|-----|-------|
| Commit 4 — bonded receiving + INV-3 | ✅ committed + Codex BLOCK review resolved (5 HIGH fixed) | `897f5fe` + fix | db **55/55**, api **19/19**, zero skips; HARD GATE intact (frozen `costing.rls.test.ts` 0-diff vs master; fix touched no frozen file) |
| Commit 5 — bond release + duty (INV-4/5) | ⏳ WIP set aside (schema+service drafted) | — | resumes after commit-4 review processed |
| Commit 6 — RBAC + seed + contracts | pending | — | — |
| Commit 7 — §45 + ADRs | pending | — | — |
| Phase 4 plan docs | pending | — | — |
| Phase 5 plan docs | pending | — | — |
| Phase 6+ plan docs | pending | — | — |

## ⚠️ MORNING REVIEW + 🔒 DECISIONS NEEDING KAREEM (master list)

> Filled in as the run progresses. Read this section first in the morning.

*(none yet)*

---

## Run detail

### Setup (phase-3-overnight branch)
- **Started from**: `phase-3-commit-3` HEAD `fe11d67`
- **Branch**: `phase-3-overnight`
- **Read**: PROGRESS.md RESUME-HERE, plan §I, module-spec INV-3/4/5, event-map-phase3 bond events, lessons-learned commit-0..3
- **Key locked decisions confirmed**:
  - §I.4: Bonded = AVCO-only. Bond-receipt rejects FIFO SKUs. No speculative FIFO value-only path.
  - F5: Stamp resolved costing method on `bond_receipt_line.costing_method_applied` at receipt; release enforces against the stamp.
  - Bond release = approved bonded→released transfer (reuses commit-2/3 transfer machinery, value conserved) + value-only duty adjustment (intentional value-ADD, NOT conservation).
  - RBAC-immediate release: `bond.release` + `bond.approve_release`; workflow fields RESERVED nullable.
  - Customs/landed-cost = reference seams only (nullable columns; NO allocation behavior, that's Phase 6).
  - Approval seam: In Phase 3 RBAC-immediate (one actor can do both request+approve if they have both permissions). The §22 request→approve workflow row binds additively later.

---

### Commit 4 — bonded receiving + INV-3 separation (`897f5fe`)
- **Scope:** `bond_receipt` + `bond_receipt_line` tables; `createBondReceipt` service; `bond.receive` router; migration 0015 (DDL + fail-closed RLS); INV-3 test.
- **Design:** receipt appends a valued stock movement at the bonded location node and runs AVCO valuation there → bonded value isolated from store locations (INV-3). Reuses the frozen Phase-2 costing engine + stock-ledger; **zero new costing machinery**.
- **Locked-plan compliance:** §I.4 bonded = AVCO-only (FIFO SKUs rejected); F5 method stamped on `bond_receipt_line.costing_method_applied` at receipt; router guards the full H1 cross-tenant FK class (location/product/sku-belongs-to-product/lot).
- **Gates (vs throwaway PG18 `retailos-overnight`, migrated 0000→0015):** mojibake ✓, biome ✓, check-types ✓, **db 51/51**, **api 19/19**, **zero skips**.
- **HARD GATE:** `git diff fe11d67 -- costing.ts transfer.ts costing.rls.test.ts` EMPTY (commit 4 consumes but does not modify frozen/commit-3 code); footprint +100 lines new/additive.
- **Codex review:** prior fork crashed ("Prompt is too long" — inherited bloated context); re-dispatched as a FRESH scoped codex-rescue agent → **BLOCK verdict, 5 HIGH (F1–F5)**. All verified against the actual code (a red-team finding is itself a claim to verify) and FIXED in a follow-up commit:
  - **F4 — location FK was tenant-only (2-col).** A same-tenant Company-A receipt could target Company-B's bonded location. **Fix:** `bond_receipt_location_composite_fk` widened to `(tenant_id, company_id, location_id) → location(tenant_id, company_id, id)` — kills the cross-company hole at the DB layer for ANY caller. Proven by a raw-insert regression (`23503` + constraint name on the pg `cause`).
  - **F3 — lot FK was single-column `(lot_id)→lot(id)`** (global UUID PK) → would accept another tenant's lot id (FK checks bypass RLS). **Fix:** composite `(tenant_id, lot_id) → lot(tenant_id, id)` for cross-tenant; PLUS a `lot↔sku` tuple guard (router `assertLotBelongsToSku` + service `validateBondLine`) because `lot` has no `(tenant_id, sku_id, id)` unique to FK against — the one cross-entity tie a composite FK can't enforce (mirrors `assertSkuBelongsToProduct`).
  - **F2 — router didn't `assertCompanyVisible`.** Cross-tenant company was already blocked by the composite company FK, but the router now also validates company visibility for a clean NOT_FOUND. Added `assertCompanyVisible` helper.
  - **F1 — exported `createBondReceipt` lacked service-level guards.** The strengthened composite FKs are the durable DB backstop for any direct caller; added defense-in-depth service guards (`assertBondedLocation` company-match + `validateBondLine` positive-cost + lot↔sku) so a direct caller gets a clean error before the insert.
  - **F5 — `unit_cost_minor >= 0` allowed a zero cost** → qty>0 with value=0 (the `qty=0⟺value=0` DB CHECK does NOT catch qty>0&value=0), zeroing the duty-on-release basis. **Fix:** CHECK `> 0` + router `.positive()` + service guard. Defensible bonded business rule: dutiable imports carry a positive declared landed cost.
- **Regression tests (db 51→55):** F5 zero-cost reject, F3 cross-sku lot reject, F4 service cross-company reject, F4 DB-layer raw-insert composite-FK reject (bypasses the service guard — proves the durable kill).
- **Refactor note:** the new service guards pushed `createBondReceipt` over biome's cognitive-complexity 20 → extracted `assertBondedLocation` + `validateBondLine` helpers (no behavior change).
- **Migration 0015 regenerated** via `drizzle-kit generate --name=sturdy_hydra` (deterministic snapshot recompute) + RLS DO-block re-appended; verified all 3 constraints in a fresh PG18 (`cost > 0`, lot `(tenant_id,lot_id)`, location 3-col).
- **HARD GATE re-verified:** `git diff master -- costing.rls.test.ts` = **0**; `costing.ts` = **+207/−0**; this fix touched **no** frozen/commit-3 file.
- **Per-commit purity:** trimmed forward-declared commit-5 constants (release events/permissions) out of commit 4 so it's self-contained; they re-land in commit 5.

---
