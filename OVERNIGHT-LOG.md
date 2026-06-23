# RetailOS — Overnight Run Log

> **Kareem: read this first.** Every decision, gate result, Codex finding, and ⚠️ MORNING REVIEW flag is here.
> Branch: `phase-3-overnight` (off `phase-3-commit-3` HEAD `fe11d67`). PR #17 NOT merged.
> Master is frozen. This branch accumulates all work for your morning review before any merge.

## Summary (fill as run progresses)

| Item | Status | SHA | Notes |
|------|--------|-----|-------|
| Commit 4 — bonded receiving + INV-3 | ✅ committed + Codex BLOCK review resolved (5 HIGH fixed) | `897f5fe` + `c9e552f` (fix) | db **55/55**, api **19/19**, zero skips; HARD GATE intact (frozen `costing.rls.test.ts` 0-diff vs master; fix touched no frozen file) |
| Commit 5 — bond release + duty (INV-4/5) | ✅ implemented + Codex review (2 HIGH + 1 MEDIUM fixed); committed | `f013e85` | db **65/65**, api **21/21**, zero skips; fresh PG18 0000→0016; HARD GATE intact (`costing.ts`/`costing.rls.test.ts` untouched by commit 5) |
| Commit 6 — RBAC + seed + contracts | pending | — | — |
| Commit 7 — §45 + ADRs | pending | — | — |
| Phase 4 plan docs | pending | — | — |
| Phase 5 plan docs | pending | — | — |
| Phase 6+ plan docs | pending | — | — |

## ⚠️ MORNING REVIEW + 🔒 DECISIONS NEEDING KAREEM (master list)

> Filled in as the run progresses. Read this section first in the morning.

- **🔒 DECISION (commit 5, F1) — bonded release blocks on a tenant/category costing flip.** Bonded stock is AVCO-only in Phase 3. The release now re-resolves the LIVE costing method per SKU and **rejects** if it has drifted to `fifo` since receipt (e.g. a tenant flipped `organization.costing_method` avco→fifo). This is the SAFE behavior (the alternative is silent zero-value moves — see F1 detail), but it means a tenant costing flip will **block all pending bonded releases** for affected SKUs until reconciled. **Two open questions for you:** (1) Is "reject + reconcile" the desired UX, or do you want the release to PROCEED as AVCO from the receipt stamp regardless of live setting (the stamp's original "durable guarantee" intent)? The latter needs a costing-method override threaded through the frozen transfer/`costing.ts` engine — a change-request against frozen code, deliberately NOT done autonomously. (2) Should `organization`/`category` `costing_method` get a set-once-after-movements guard like the #7 product/sku trigger? Today only product/sku are protected, so a tenant CAN flip costing while holding valued stock.
- **NOTE (commit 5):** the `inventory.bond_release_requested` / `inventory.bond_release_approved` events remain RESERVED contract shapes (NOT in `DomainEventType`) — release is RBAC-immediate (one `bond.release` mutation needing both `bond.release`+`bond.approve_release`). The §22 request→approve workflow is deferred; when you build it, those events + the `requested_by`/`approved_by` columns bind additively.

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

### Commit 5 — bond release + duty (INV-4/5) (`f013e85`)
- **Scope:** `bond_release` + `bond_release_line` tables (`schema/bond_release.ts`); `unique(tenant_id, id)` added to `bond_receipt_line` (composite-FK target); `executeBondRelease` service; `bond.release` router; migration `0016_bond_release.sql` (DDL + hand-appended fail-closed RLS, FK targets ordered before dependent FKs); `InventoryBondReleased` added to `DomainEventType`; `tenant_admin` granted `bond.receive/release/approve_release`; DB-gated + router tests.
- **Design (locked-plan compliant):** a release = an approved bonded→released `stock_transfer` (reuses commit-2/3 `createTransfer`→`shipTransfer`→`receiveTransfer`; qty+value conserved, INV-2) + a per-line value-only duty/tax `valuation_adjustment` (qtyDelta=0, valueDeltaMinor=duty+tax) through the EXISTING AVCO value-only seam (`applyValuation`). The duty add is an INTENTIONAL value-ADD (raises released cost basis, INV-5), not conservation. **Zero new costing machinery.**
- **F4-class:** `bond_release` denormalizes `company_id`; source+dest are 3-col composite FKs `(tenant,company,location)→location` (a same-tenant Company-A release can't target Company-B's location). F5: each line enforced against the `bond_receipt_line.costing_method_applied` stamp (AVCO-only).
- **RBAC-immediate:** ONE `bond.release` mutation requiring BOTH `bond.release` + `bond.approve_release`; emits only `inventory.bond_released` (full per-line contract: skuId/qtyBase/releasedValueMinor/dutyMinor/taxMinor/currency/scale + releasedBy/requestedBy/approvedBy, all defaulting to the actor). The request/approve events stay RESERVED (not enumerated).
- **Gates (vs throwaway PG18 `retailos-overnight`, FRESH db `retailos_c5` bootstrapped + migrated 0000→0016 as `retailos_migrator`, tested as `retailos_app`):** mojibake ✓, biome ✓, check-types ✓, **db 65/65**, **api 21/21**, **zero skips**.
- **HARD GATE:** `git diff HEAD(=commit4) -- costing.ts costing.rls.test.ts` EMPTY — commit 5 consumes but does NOT modify frozen costing code (the duty add reuses the existing `applyValuation` value-only path). `git diff master -- costing.rls.test.ts` = 0 (byte-identical).
- **Discovery (DB test caught it):** the original F5 test tried to simulate a post-receipt PRODUCT costing flip — but the **commit-0/1 #7 set-once trigger blocks that** (`costing_method is set-once … already has stock_ledger movements`). A product-level flip is impossible by construction; the stamp protects against CATEGORY/TENANT-level resolution drift, which the trigger does NOT guard. Test reworked accordingly. (lessons-learned entry added.)
- **Codex review (FRESH scoped `codex:codex-rescue` agent, NOT a fork):** 0 CRITICAL; value/duty math, numbering, event contract, RLS/FK-ordering all verified clean. **2 HIGH + 1 MEDIUM, all FIXED on the branch:**
  - **F1 (HIGH) — F5 stamp was only a GATE; `applyValuation` re-resolved costing LIVE.** A tenant-level avco→fifo flip after receipt (not blocked by #7) → gate passes on the 'avco' stamp while valuation resolves 'fifo' → duty `valuation_adjustment` throws, or (no duty) transfer issues from empty FIFO layers and moves ZERO value (silent corruption). **Fix:** `loadReceiptLines` re-resolves the LIVE method via the same exported `resolveCostingMethod` `applyValuation` uses and rejects drift → gate and valuation provably consistent. No frozen-code change. (Surfaced as the 🔒 decision above.)
  - **F2 (HIGH) — TOCTOU over-release** (same class as commit-3 HIGH-1). `stockOnHandForSku` is a lock-free SUM; the transfer issue runs after it → two concurrent releases both pass the check and both issue, driving bonded negative. **Fix:** acquire the same per-cell advisory lock `appendStockMovement` uses (`${tenant}:${location}:${sku}`) BEFORE the on-hand read. Regression: `Promise.allSettled([releaseFull, releaseFull])` → exactly one fulfils, bonded ends at 0 not −5.
  - **F3 (MEDIUM) — order-dependent value attribution.** `buildValueQueues` dequeued transfer `lineValues` by assumed order, but `loadTransfer` has no `ORDER BY` → duplicate-SKU release lines could swap `releasedValueMinor` in the event (total conserved, split wrong). **Fix:** deterministic per-SKU proportional-by-qty largest-remainder split in input order; independent of DB row order. No `transfer.ts` change.
- **Regression tests (db 62→65):** F1 live-drift reject, F2 concurrent over-release serialization, F3 duplicate-SKU proportional split. Plus the `bond.release` ROUTER write-path proof in `vs1.integration.test.ts` (api 19→21): drives receive→release through the router and asserts the avg_cost cells ACTUALLY MOVE (bonded −6000, store +6400 = 6000 conserved + 300 duty + 100 tax), the event carries the full per-line contract, and the release is audited — proving the production path invokes valuation (#8 class), not just the service in isolation. + RBAC reject test (cashier lacks bond perms).
- **Docs:** module-spec INV-4/5 (already accurate); `event-map-phase3.md` reconciled (bond_released ADDED to enum; request/approve marked 🔒 RESERVED + out of enum); 2 lessons-learned entries.

---
