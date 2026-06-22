# ADR 0008 — Strategy/settings resolution model + currency seam

- **Status:** Accepted (Phase-2 schema-and-seams pass, 2026-06-22)
- **Context:** charter §7 (entitlements/config), §8 (tenant model), §19 (money); Phase 2 §6 (resolver) + §7 (currency). Relates: ADR 0007 (costing), `module-specs/inventory.md` (D1–D7).
- **Scope:** the resolution *mechanism* + depth rules + the historical-integrity seam, and the single-currency-per-tenant seam. Service adoption (rewiring existing lookups) is deferred to the behavior pass.

## Decision — one reusable settings resolver (`packages/db/src/services/settings-resolver.ts`)

- **Resolution order (most specific wins):** `product → category → location → tenant → platform default`. Implemented as a pure `resolveSetting(values, allowedLevels)` — services must route config lookups through it, not scatter ad-hoc joins.
- **Depth rules:**
  - **Financial-consistency settings** (`costingMethod`, `valuationBehavior`) resolve at **category / tenant / platform only** (`FINANCIAL_LEVELS`) — arbitrary per-product/per-location costing overrides are **not** honored for financial integrity.
  - **Operational/physical settings** (tracking mode, UoM, expiry policy, removal strategy, reorder policy, oversell policy) may resolve at **any** level.
- **Historical integrity (seam #2 — the load-bearing rule):** the resolver returns the **current** effective setting and must **never** be used to re-interpret historical movements. The financial strategy actually applied is **stamped on the movement row at write time** — `stock_ledger.costing_method_applied` (nullable column added this pass). A later config change therefore cannot silently re-value committed history. (Alternative considered: effective-dated append-only settings-history table — heavier; the write-time stamp is sufficient and cheaper, and is the chosen seam. A settings-history table remains a future option without conflicting with the stamp.)

### OPEN — conflict with locked D1
D1 (ADR 0007) decided costing is selectable **per tenant/category/product**. The depth rule here restricts *financial* settings to **category max**. These conflict on the product level. **Resolution deferred to the owner:** either relax the depth rule to include product (honoring D1 literally) or amend D1 to category-max. Until resolved, the resolver utility *defaults* financial settings to category-max (seam-#2 guidance), and `costing.ts`'s existing `resolveCostingMethod` (still product→category→tenant per D1) is **unchanged this pass** — it will adopt the resolver + the agreed depth in the behavior pass. Flagged in PROGRESS deferred-decisions.

## Decision — currency seam (§7)

- **Single currency per tenant is assumed** for Phase 2, but money is **never currency-ambiguous**: every monetary value is stored as the triple **`*_minor` (integer) + `currency` + `scale`** on its own row (product price, ledger cost, avg_cost, valuation_layer, sale/invoice). Currency is resolved **from the row's stored `currency`**, not inferred globally.
- **Interpretation:** a `*_minor` value means `value × 10^(-scale)` units of `currency` (e.g. `12345` + `USD` + scale `2` = \$123.45). bigint minor units; JS-number precision caveat tracked in issue #6.
- **Reserved:** multi-currency inventory/accounting (per-currency layers, FX revaluation, realized/unrealized gain-loss) is a **Phase 5/6 seam** — not built now. Because currency already travels with every money value, adding multi-currency later does not require reinterpreting existing rows.

## Consequences
- Services gain a single, testable resolver (pure unit-tested) instead of scattered lookups.
- History is immutable under config change (stamp on the movement).
- The D1/depth conflict is explicit and owner-deferred, not silently resolved.
