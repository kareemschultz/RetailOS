# ADR 0007 — Inventory costing strategy (AVCO default, FIFO per scope, mixed catalogs)

- **Status:** Accepted (owner directive 2026-06-22) — pre-Phase-2 decision lock.
- **Date:** 2026-06-22
- **Context:** charter §18 (inventory/valuation), §19 (money), §12 (Caribbean/IFRS), §20 (COGS posting); Phase 2 (Products & Inventory Ledger).
- **Relates:** `module-specs/inventory.md` (D1 + "Costing Strategy Examples"); `competitive/inventory.md` (§41); ADR 0006 (RLS spine the costing tables inherit).
- **Deciders:** product owner (directive); recorded by the implementation agent.

> Decision record only — **no schema/migration/code in this ADR**. It freezes D1 so a future reader (or agent) treats it as settled and does not re-litigate or implement a narrower variant.

## Decision

Inventory costing is a **per-tenant / per-category / per-product strategy**, not a single global method.

1. **AVCO (weighted-average / moving-average) is the platform default.** A tenant that configures nothing gets AVCO everywhere.
2. **FIFO is selectable** per tenant, per category, or per product — especially for pharmacy, expiry/batch/lot-tracked inventory, regulated goods, and high-value serialized items.
3. **LIFO is prohibited.** It is not IFRS-aligned (IAS 2), and the target Caribbean/Commonwealth markets follow IFRS. The enum value may exist behind an explicit feature flag only if a future US-GAAP-only tenant ever requires it; it is **not** built in Phase 2 and is never a default.
4. **Standard cost** is deferred to a future manufacturing phase (out of Phase 2 scope).

### Both storage paths exist simultaneously — neither may be omitted

The schema ships **both** valuation projections, and an implementation that builds only one is **wrong**:

- **`avg_cost`** — a running weighted-average cost per **SKU × location**. Backs **AVCO** SKUs; updated in place by the AVCO strategy on each receipt/issue.
- **`valuation_layer`** — FIFO cost layers per **SKU × location**, consumed oldest-first. Backs **FIFO** SKUs; layer rows created on receipt, consumed on issue.

Both are **valuation projections beside the append-only stock ledger**, which remains the single source of truth (ADR 0006 / §18).

### Mixed catalogs are supported

A **single tenant's catalog may mix methods** — e.g. AVCO for general merchandise and FIFO for lot-tracked pharmacy SKUs **at the same time**. The effective method is resolved **per stock movement**; an AVCO-resolved movement updates `avg_cost`, a FIFO-resolved movement writes/consumes `valuation_layer`. (See the worked examples — supermarket / pharmacy / hardware / mixed-tenant — in `module-specs/inventory.md`.)

### Resolver order

**Most-specific-wins: product → category → tenant default.**
1. If the **product** sets a costing method, use it.
2. else if its **category** sets one, use it.
3. else use the **tenant default** (AVCO if unset).

The same resolver pattern is reused by D2 (UoM), D4 (expiry/FEFO), and D5 (oversell) for one consistent configuration model.

### Method change after movements exist

A SKU's costing method is **locked once stock movements exist** for it. Changing it is permitted **only** via an explicit, **audited revaluation event** (§25) — never a silent edit and never a destructive migration. (Improves on NetSuite/ERPNext/Fishbowl, which lock the method permanently after creation; see `competitive/inventory.md`.)

## Consequences

- The Phase-2 schema **must** include: `avg_cost` (AVCO projection), `valuation_layer` (FIFO layers), `costing_method` config columns on `tenant`/`category`/`product`(/`sku`), and a costing-strategy resolver invoked per movement.
- The `StockLedger` stays policy-neutral; valuation is computed by the resolved strategy alongside it.
- COGS posting (§20, real GL in Phase 5) reads from whichever projection the SKU's method uses.
- Monetary **rounding mode** remains **OPEN** (pending GRA/target-country VAT verification); it is not required by costing until division appears (tax/FX, Phase 5).

## Verification

The first implementation diff that earns a line-by-line read is the **costing resolver**: green tests prove the arithmetic, but only a human read confirms a mixed AVCO+FIFO catalog routes each movement to the correct projection (product → category → tenant).
