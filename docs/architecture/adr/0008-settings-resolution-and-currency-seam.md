# ADR 0008 — Strategy/settings resolution model + currency seam

- **Status:** Accepted (Phase-2 schema-and-seams pass, 2026-06-22)
- **Context:** charter §7 (entitlements/config), §8 (tenant model), §19 (money); Phase 2 §6 (resolver) + §7 (currency). Relates: ADR 0007 (costing), `module-specs/inventory.md` (D1–D7).
- **Scope:** the resolution *mechanism* + depth rules + the historical-integrity seam, and the single-currency-per-tenant seam. Service adoption (rewiring existing lookups) is deferred to the behavior pass.

## Decision — one reusable settings resolver (`packages/db/src/services/settings-resolver.ts`)

- **Resolution order (most specific wins):** `product → category → location → tenant → platform default`. Implemented as a pure `resolveSetting(values, allowedLevels)` — services must route config lookups through it, not scatter ad-hoc joins.
- **Depth rules:**
  - **Operational/physical settings** (tracking mode, UoM, expiry policy, removal strategy, reorder policy, oversell policy) resolve at **any** level (product → category → location → tenant → platform).
  - **Financial-consistency settings** (`costingMethod`, `valuationBehavior`) **MAY resolve to product/sku level too** (per D1 — a FIFO pharmacy SKU beside an AVCO grocery SKU in one tenant is a standard, valid catalog). The integrity rule is **NOT a depth cap** — it is **set-once-immutable** (below).
- **Set-once integrity rule (REPLACES the earlier category-cap, 2026-06-22):** `costingMethod` is **immutable for a product/sku once that item has ANY `stock_ledger` movement.** Enforced at the service/validation boundary (`assertCostingMethodSetOnce` in the catalog routers): a change attempt on an item with existing ledger rows is rejected with a structured `CONFLICT`. The hazard was never per-item costing — it is **changing an item's method after it has ledger history** (which would re-value the past). Set-once removes that hazard while keeping item-level costing.
- **Historical integrity (seam #2 — load-bearing):** the resolver returns the **current** effective setting and must **never** re-interpret historical movements. The financial strategy actually applied is **stamped on the movement row at write time** — `stock_ledger.costing_method_applied`, written by `applyValuation` after it resolves the method. This makes a set-once violation **detectable after the fact** and guarantees a later config change cannot silently re-value committed history. (Alternative considered: effective-dated settings-history table — heavier; the stamp + set-once is sufficient.)

### RESOLVED — D1 vs ADR-0008 (owner decision 2026-06-22)
Reconciled **toward D1**: financial settings keep **product/sku-level** selectability; the `FINANCIAL_LEVELS` category-cap in `settings-resolver.ts` is retained only as an *optional* `allowedLevels` argument callers may pass, **not** the default policy for costing. The integrity guarantee is **set-once-after-first-movement** (enforced + tested), not a depth cap. `costing.ts`'s `resolveCostingMethod` (product→category→tenant) is therefore **correct as-is** and is no longer in conflict. The product/sku `costing_method` columns and their seed/test coverage are **kept**.

## Decision — currency seam (§7)

- **Single currency per tenant is assumed** for Phase 2, but money is **never currency-ambiguous**: every monetary value is stored as the triple **`*_minor` (integer) + `currency` + `scale`** on its own row (product price, ledger cost, avg_cost, valuation_layer, sale/invoice). Currency is resolved **from the row's stored `currency`**, not inferred globally.
- **Interpretation:** a `*_minor` value means `value × 10^(-scale)` units of `currency` (e.g. `12345` + `USD` + scale `2` = \$123.45). bigint minor units; JS-number precision caveat tracked in issue #6.
- **Reserved:** multi-currency inventory/accounting (per-currency layers, FX revaluation, realized/unrealized gain-loss) is a **Phase 5/6 seam** — not built now. Because currency already travels with every money value, adding multi-currency later does not require reinterpreting existing rows.

## Consequences
- Services gain a single, testable resolver (pure unit-tested) instead of scattered lookups.
- History is immutable under config change (write-time stamp on the movement + set-once enforcement).
- The D1/depth conflict is **RESOLVED toward D1** (2026-06-22): item-level costing is kept; the integrity guarantee is **set-once-after-first-movement** (enforced in `assertCostingMethodSetOnce` + tested), not a depth cap. `costing.ts` resolution is unchanged and no longer in conflict.
