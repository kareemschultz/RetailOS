# Phase 2 Behavior Pass — PLAN (no code yet)

- **Status:** PLAN ONLY — stop for owner approval before any behavior code.
- **Branch:** `phase-2-behavior` (off master `d39428d`, post PR #4 merge).
- **Scope:** wire the seams that the schema/close-out passes deliberately left as contracts. **Phase 2 schema is FROZEN** (further inventory *schema* work is a change request) — this pass is behavior over the existing schema. No UI.

## Sequenced work

1. **Single source of truth for settings resolution.** Route the services that read config through `settings-resolver.ts`, and **REPLACE** `costing.ts`'s inline `product → category → tenant` SQL resolution with it — **remove the duplicate path** (do not leave two resolvers to drift). Resolver stays pure; services pass it the fetched level values. Re-run the resolver + costing suites unchanged. (Operational settings — removal strategy, oversell/expiry policy, return policy, UoM — adopt the same resolver.)

2. **`inventory.cost_reconciliation` emit (negative→non-negative).** Emit on the receipt path when a SKU×location crosses from negative on-hand to ≥0 and the receipt establishes actual cost. **Hard dependency: ticket #6** (rounding-mode / `mulDivRound`) — `reconciliationAmountMinor` is the largest single value-injection (≈ full receipt cost of previously-unvalued units on the zero/unvalued basis), so it cannot land correctly until the rounding mode is chosen. **Sequenced AFTER** an end-to-end re-confirm that the Gap-B `costing_method_applied` stamp writes on every valued movement in the live flow (not just unit tests). Payload per the locked event-map contract.

3. **M1 event-contract normalization.** Make emitted events match `event-map-phase2.md`: inject **`occurredAt`** (server time) in `emitEvent`; align field names on `inventory.adjusted` / `inventory.received` / `inventory.count_posted`; emit `inventory.valuation_updated` from `adjust`; reconcile mapped-but-unemitted (`lot_expiring`/`lot_expired`/`uom_converted`) and emitted-but-unmapped (`revalued`, `stock_discrepancy_reviewed`) — either emit or remove from the map. Goal: the "payload shapes locked" claim becomes true before any consumer (Phase 5) is built.

4. **Fractional quantities — pin `qty_scale` at SKU / base-UoM level, not per-movement.** When fractional/weight UoM is built, the scale belongs to the SKU's base UoM (one definition per item), not stamped per ledger row. The existing `stock_ledger.qty_scale` column stays as a denormalized echo for audit, but the source of truth is SKU/base-UoM. (Design only here.)

5. **Re-confirm set-once coverage for any new write path.** Any new service that can write `product/sku.costing_method` must go through `assertCostingMethodSetOnce` (or the planned DB trigger, #7). Re-run the set-once router test; if the behavior pass adds a service-level costing setter, add it to the guard + the test harness.

## Hard dependencies / order
- #2 depends on #6 (rounding) **and** a live Gap-B stamp re-confirm.
- #1 should land first (single resolver) so #2/#3 build on one config path.
- #7 (DB-level set-once trigger) is the durable backstop for #5 — Phase 3, not required to start this pass.

## Out of scope (still)
UI, GL/accounting postings, returns workflow, landed-cost allocation, FIFO value-only allocation (OPEN — must carry its own qty>0 guard when built), multi-currency, offline/Tauri POS, read-model/star-schema reporting.

**STOP here for owner approval before writing behavior code.**
