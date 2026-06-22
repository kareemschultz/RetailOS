# Phase 2 Behavior Pass — PLAN (no code yet)

- **Status:** PLAN ONLY — stop for owner approval before any behavior code.
- **Branch:** `phase-2-behavior` (off master `d39428d`, post PR #4 merge).
- **Scope:** wire the seams that the schema/close-out passes deliberately left as contracts. **Phase 2 schema is FROZEN** (further inventory *schema* work is a change request) — this pass is behavior over the existing schema. No UI.

## Sequenced work

1. ✅ **DONE (2026-06-22) — Single source of truth for settings resolution.** `costing.ts`'s inline `product → category → tenant ?? "avco"` precedence is **DELETED**; `resolveCostingMethod` now fetches the per-level values and delegates the winner to `resolveSetting` (platform default `'avco'` encoded as the platform level). **Exactly one resolution path.** costing + resolver DB-gated suites pass **unchanged** (no test edits → behavior-preserving). Per-setting: **costingMethod → routed**; **removal/oversell/expiry/return → deferred** (no service consumer yet — seam columns only; `decideOversell` takes policy as a param); **UoM → not routed** (it's a most-specific **row-scope** lookup over sku/product/category in `convertUom`, a different shape than the scalar resolver, which has no `sku` level — unifying it would need a resolver extension = out of item-1 refactor scope; flagged as a distinct pattern).

2. **`inventory.cost_reconciliation` emit (negative→non-negative).** Emit on the receipt path when a SKU×location crosses from negative on-hand to ≥0 and the receipt establishes actual cost.
   - **⛔ UPSTREAM BLOCKER — POS↔costing boundary (ticket #8) DECIDED Phase 4 (owner-ratified 2026-06-22).** Reconciliation true-ups COGS on the valuation projection, but the primary sale path (`pos.createSale`) does **not** update it (no `applyValuation`; `avg_cost.qty_on_hand` diverges; no FIFO consumption, no COGS). Since the POS↔costing wiring is now scoped to **Phase 4**, this `cost_reconciliation` emit is **also Phase-4-gated** — it can't reconcile on a projection POS sales won't maintain until Phase 4. (Was "pending"; now decided.)
   - **Hard dependency: ticket #6** (rounding-mode / `mulDivRound`) — `reconciliationAmountMinor` is the largest single value-injection (≈ full receipt cost of previously-unvalued units on the zero/unvalued basis), so it cannot land correctly until the rounding mode is chosen.
   - **Sequenced AFTER** an end-to-end re-confirm that the Gap-B `costing_method_applied` stamp writes on every valued movement in the live flow (not just unit tests) — which itself requires #8, since today the sale path produces unstamped movements. Payload per the locked event-map contract.

3. ✅ **DONE (2026-06-22) — M1 event-contract normalization.** Emitted events now match `event-map-phase2.md`; the "payload shapes locked" claim is now TRUE.
   - **`occurredAt`** injected in `emitEvent` (server time, applied LAST in the payload spread so a producer can't override it) → carried by **every** event. Locked by two new `services.rls.test.ts` assertions (present + server-overrides-producer).
   - **Field-name alignment (decide → make both match):** `inventory.received` — code carries `productId` (product-level receipts) + reserved `serialIds: null`; map updated to match. `inventory.adjusted` — **kept `cogsMinor`** (the value actually moved through valuation, what P5 posts) over a raw `unitCostMinor`; `approvedBy` deferred until a §22 approval workflow; map updated to match. `inventory.count_posted` — code aligned to the locked base/Minor line shape + top-level `locationId`/`currency`/`scale` (added to `postStockCount` return; service `adjustments` keep their own names, only the event is normalized).
   - **valuation_updated / stock_discrepancy (emitted+mapped, divergent):** map aligned to as-built. `valuation_updated` carries `cogsMinor`+`unvaluedQty` now; `totalValueMinor`/`qtyOnHandBase` enrichment **deferred to Phase-5** (needs a `ValuationResult` extension). `stock_discrepancy` is **product-level (pre-#8)** — moves to `skuId`/expected-actual only when POS↔costing is wired in Phase 4 (#8); not changed here.
   - **Mapped-but-unemitted:** `lot_expiring`/`lot_expired` marked **DEFERRED** (need a Phase-12 scheduled evaluator; no Phase-2 producer); `uom_converted` marked **FOLDED** (captured in receive/sale base-unit qty; not standalone). All kept as locked contracts, none in `DomainEventType`.
   - **Emitted-but-unmapped:** `inventory.revalued` (AVCO + FIFO variants) and `inventory.stock_discrepancy_reviewed` added to the catalog + consumer matrix.
   - **Money fields:** every touched payload is `_minor`-suffixed (`cogsMinor`/`unitCostMinor`/`totalValueMinor`/`varianceValueMinor`).
   - Gates: check 157/0 · check-types 6/6 · test 7/7 · DB-gated db **45/45** (44 + 1 new occurredAt test) · api **11/11**. No existing test broke; the only test edit is the additive occurredAt contract guard (expected — the contract intentionally changed).

4. **Fractional quantities — pin `qty_scale` at SKU / base-UoM level, not per-movement.** When fractional/weight UoM is built, the scale belongs to the SKU's base UoM (one definition per item), not stamped per ledger row. The existing `stock_ledger.qty_scale` column stays as a denormalized echo for audit, but the source of truth is SKU/base-UoM. (Design only here.)

5. **Re-confirm set-once coverage for any new write path.** Any new service that can write `product/sku.costing_method` must go through `assertCostingMethodSetOnce` (or the planned DB trigger, #7). Re-run the set-once router test; if the behavior pass adds a service-level costing setter, add it to the guard + the test harness.

## Hard dependencies / order
- #2 depends on #6 (rounding) **and** a live Gap-B stamp re-confirm.
- #1 should land first (single resolver) so #2/#3 build on one config path.
- #7 (DB-level set-once trigger) is the durable backstop for #5 — Phase 3, not required to start this pass.

## Out of scope (still)
UI, GL/accounting postings, returns workflow, landed-cost allocation, FIFO value-only allocation (OPEN — must carry its own qty>0 guard when built), multi-currency, offline/Tauri POS, read-model/star-schema reporting.

**STOP here for owner approval before writing behavior code.**
