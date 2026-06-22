# Inventory & Product Engine — Specification

- Status: **Draft** (pre-implementation planning for Phase 2 — Products & Inventory Ledger)
- Charter refs: §18 (inventory/warehouse/bond/procurement/product engine), §19 (money), §12 (Caribbean/developing-market), §13/§14 (offline & conflict), §17 (numbering), §27 (reporting), §33/§35/§39 (engineering rules / DoD / AI safety)
- Competitive analysis: `docs/architecture/competitive/inventory.md` (required before build, §41)
- Builds on: `docs/architecture/vertical-slice-1.md` (VS#1 shipped a minimal `product` + append-only `stock_ledger` with a `StockLedger.append` sole-mutator service; Phase 2 **extends**, it does not rebuild).

> This spec covers **Phase 2 scope only**: products/variants/SKUs/barcodes, the multi-UoM model, serial/batch/lot/expiry tracking, inventory **costing & valuation**, reorder points, stock counts/adjustments, and kits/bundles/BOM **catalog modelling**. Multi-location transfers, warehouse bin/zone operations, bonded warehouse, landed cost, and procurement are **Phase 3/6** — modelled here only at the seam level to avoid later redesign (§32). POS-side offline queue is Phase 4.

---

## ⛔ Business decisions required before implementation (HARD STOP)

> The charter fixes the **architecture** (ledger-based inventory, money in minor units, multi-tenant, audit-everything) but deliberately leaves a number of **product/business policy** choices to the owner. **Implementation of Phase 2 must not begin until each decision below is made by the product owner.** Each item lists the options, trade-offs, a **recommended default (a recommendation, not a decision)**, and what the decision **blocks**. Record the full resolution set as an ADR before coding.

> **Decision status (updated 2026-06-22):**
> - ✅ **D1 — costing method: DECIDED** (owner directive) — AVCO default, FIFO per tenant/category/product, no LIFO. See D1 below.
> - ✅ **D5 — negative-stock / oversell: DECIDED** (owner directive) — allow-oversell-with-flagging default, hard-block configurable per tenant/category/product. See D5 below.
> - ⏳ **D-money — rounding mode: STILL OPEN** (owner directive) — do **not** pick a mode; pending verification of the Guyana/GRA VAT rounding rule and other target-country tax rules. Do not assume banker's or half-up. (Not needed until Phase 5 tax/FX division; tracked in the deferred-decisions log.)
> - ⏳ **D2, D3, D4, D6, D7 — STILL OPEN** — awaiting owner decision at the Phase-2 approval gate. No Phase-2 schema/costing code until resolved.

### D1 — Inventory costing method ✅ DECIDED (2026-06-22, owner directive)
**The charter (§18) lists "FIFO, LIFO, weighted average" as *supported valuation methods* but does not say which is the default, nor whether it is per-tenant / per-company / per-SKU configurable.** This is the single highest-impact decision in the module — it changes the `stock_movement` valuation engine, COGS posting (§20), and every valuation report.

| Option | Pros | Cons |
|---|---|---|
| **Weighted-average (moving average / AVCO)** | Simplest correct ledger model (one running average cost per SKU×location); no cost-layer table; stable margins; IFRS- and GAAP-acceptable; what most SMB tools default to (Zoho, inFlow). | Loses per-lot cost granularity; less precise for high-value serialised goods. |
| **FIFO (cost layers)** | Most intuitive for perishable/retail; matches physical flow; IFRS- and GAAP-acceptable; best COGS accuracy; correct for expiry/batch/lot-tracked goods. | Requires a `valuation_layer` cost-layer table + layer-consumption logic; more complex offline (layer state must reconcile on sync). |
| **LIFO** | Tax advantage in high-inflation markets (defers tax). | **Disallowed under IFRS** (IAS 2) — most Caribbean/Commonwealth jurisdictions (incl. Guyana) follow IFRS, so LIFO is generally **not legally usable** for statutory accounts. US-GAAP-only. |
| **Standard cost** | Predictable; good for manufacturing; variance analysis. | Needs variance accounts + periodic revaluation; overkill for retail Phase 2. |

**✅ DECISION (owner directive, 2026-06-22):**
- **Default platform method = Weighted-Average Costing (AVCO).**
- **FIFO must remain available** and selectable **per tenant / per category / per product** where appropriate — **especially** for pharmacy, expiry/batch/lot-tracked inventory, and regulated goods.
- **LIFO is NOT supported** by default (not IFRS-aligned). Reserve the enum value only behind an explicit feature flag if a future US-GAAP-only tenant ever requires it; not built in Phase 2.
- **Standard cost** deferred to a manufacturing phase.
- **Do NOT hardcode AVCO as the only method.** Costing is a **per-tenant/category/product strategy** — the `StockLedger` resolves the effective costing method for each movement via a strategy interface (AVCO running-average vs FIFO cost-layer), so a single tenant can run AVCO for general merchandise and FIFO for its lot-tracked pharmacy SKUs simultaneously.
- **Still to confirm at the approval gate (mechanics, not the method):** (a) resolution precedence when product / category / tenant settings differ (recommend most-specific-wins: product → category → tenant default); (b) whether changing a SKU's method after movements exist is allowed (recommend: **locked once movements exist**; change only via an explicit, audited revaluation event); (c) AVCO is computed per **SKU×location** (location-scoped average), confirm vs company-wide average.
- **Blocks (now unblocked for design, pending the mechanics above):** the `valuation_layer` table (needed for FIFO), the AVCO running `avg_cost` per SKU×location, the costing-strategy resolver + config columns on `tenant`/`category`/`product`/`sku`, the `StockLedger` valuation/COGS computation, every valuation report, and the §20 COGS posting interface. **Both** the FIFO `valuation_layer` table **and** the AVCO `avg_cost` projection must exist (a tenant can use both), so neither is gated away.

### D2 — Multi-UoM model (how conversions are defined & stored) ⏳ OPEN (owner decision required)
**Charter §18 requires "buy cartons, stock units, sell cartons or units" (multi-UoM) but does not specify the conversion model.** The ledger must store quantities in **one canonical base unit** (so on-hand math is unambiguous), with display/transaction UoMs converting to/from it.

**Competitor evidence** (`competitive/inventory.md`, cited): **NetSuite forbids fractional/decimal base conversions**; **ERPNext allows decimal factors but with documented rounding bugs** (and a "Must be Whole Number" flag); **Zoho** supports up to 6 decimal places; **Odoo** converts only within a shared UoM *category* (reference unit + ratio); **Cin7 Core** makes each alternate UoM its **own SKU** (SKU explosion); **Finale** has **no auto UoM conversion on POs**. RetailOS's exact integer-minor-unit base + scaled conversion is a **parity-plus** (avoids both the fractional-rounding bugs and the SKU explosion).

| Option | Pros | Cons |
|---|---|---|
| **Single base unit + integer conversion factors** (e.g. base = "each"; carton = 24 each) | Exact integer math (no float drift); ledger always in base units; simple. | Cannot represent fractional/weight UoM (e.g. 0.35 kg) — needs the next option for weighed goods. |
| **Base unit + rational/scaled conversions** (factor + scale, e.g. 1 kg = 1000 g) | Handles weight/volume goods (deli, hardware-by-length, supermarket scale items). | More complex; rounding policy on conversion must be defined (§19 one-rounding-policy rule). |
| **Per-SKU UoM set with one flagged `is_base`** | Flexible per product; matches Cin7/Fishbowl. | More tables; validation that exactly one base exists. |

- **Recommended default:** a **`unit_of_measure` + `uom_conversion`** model where each SKU declares one **base unit** and N **alternate units** with a `factor` + `factor_scale` (integer numerator/denominator or scaled-integer) so both discrete (carton↔each) and weighed (kg↔g) goods work without floats. Ledger `qty` is **always base-unit minor** (mirrors money's minor-unit discipline). Conversions apply the **single tenant rounding policy** (§19).
- **Decide:** (a) is UoM defined per-SKU or shared catalog-wide with per-SKU base assignment; (b) are fractional/weight UoMs in Phase 2 scope or deferred; (c) rounding direction on conversion (recommend: round-half-even, consistent with the money policy once D-money is set).
- **Blocks:** `unit_of_measure`/`uom_conversion` schema, every `inventory.receive`/`pos.createSale` quantity field, barcode→qty parsing for weight-embedded codes (see D6), and reorder-point units.

### D3 — Serial / batch / lot tracking scope for Phase 2 ⏳ OPEN (owner decision required)
**Charter §18 requires serial/batch/lot/expiry across verticals (pharmacy/supermarket FEFO, electronics serials) but does not say which is mandatory in Phase 2 vs which capture point (at-receive vs at-sale).** Tracking mode is a **per-SKU** property.

**Competitor evidence** (`competitive/inventory.md`, cited): **Zoho** forces an item to be serial **XOR** batch (never both); **NetSuite, Odoo, ERPNext, Cin7, Fishbowl, Finale** all support lot/batch + expiry and serial, with serial captured at **receive** (and again at sale/fulfillment); RMA/warranty serial flows are confirmed in **NetSuite/ERPNext** and unverified elsewhere. Supports modelling all modes now, shipping lot+expiry in Phase 2, and stubbing serial for the Phase-4 POS / electronics vertical.

| Option | Pros | Cons |
|---|---|---|
| **Phase 2 = none tracked (mode = `none` only)** | Smallest slice; fastest. | Punts the hardest invariant (lot/serial-aware ledger) to a later phase, risking redesign — violates §32 "interfaces now to avoid redesign". |
| **Phase 2 = model all three modes, implement `batch/lot` + `expiry`, stub `serial`** | Delivers the highest-value Caribbean need (pharmacy/supermarket batch+expiry+FEFO) and locks the ledger shape so serial drops in later without migration churn. | More work than the minimal slice. |
| **Phase 2 = full serial + batch + lot + expiry** | Complete. | Large; electronics-serial capture-at-sale + RMA flows pull in POS/warehouse concerns that belong to later phases. |

- **Recommended default:** **per-SKU `tracking_mode ∈ {none, lot, serial}` modelled now**; **implement `lot` (with batch number + expiry) + FEFO in Phase 2**, and **stub `serial`** (column + ledger seam present, capture flows deferred to Phase 4 POS / electronics vertical). Capture point: **lot captured at receive** (and selected at sale); **serial capture-at-receive vs at-sale** is itself a sub-decision deferred with the serial stub.
- **Decide:** (a) which modes ship functional in Phase 2; (b) for lots — is expiry mandatory when `tracking_mode = lot` or optional; (c) serial capture point (receive vs sale) when serial is implemented.
- **Blocks:** the `lot`/`serial` tables, the `stock_movement` lot/serial FK, FEFO picking (D4), expiry alerts/reporting, and the receive/sale router payload shape.

### D4 — Expiry / FEFO enforcement policy ⏳ OPEN (owner decision required — do NOT assume a universal hard-block)
**Charter §18 names "FEFO picking, batch/expiry tracking, expiry alerts" for pharmacy/supermarket but does not set the *enforcement* strength.** Two related-but-distinct questions: (1) **FEFO picking order** — does the system *suggest* vs *force* the soonest-expiry lot? and (2) **expired-lot handling** — what happens when someone tries to sell an already-expired lot? **Per owner directive, RetailOS must NOT assume a universal hard-block** — pharmacy/regulated goods may require hard-block, while supermarket/general retail typically needs warn-and-override.

**Competitor evidence** (`competitive/inventory.md`, cited): automated FEFO is confirmed in **Cin7 Core (with explicit warn-OR-enforce validation), Odoo, NetSuite (SuiteApp), ERPNext** (its `Pick Serial/Batch Based On` is configurable to FIFO/LIFO/**Expiry**); FEFO is **manual or unverified** in Zoho, inFlow, Finale, Fishbowl. **No competitor imposes a universal hard-block** — the market norm is advisory or configurable. This validates the directive.

The three policy options (apply independently to FEFO ordering and to expired-lot sale):

| Option | Pros | Cons | Fits |
|---|---|---|---|
| **Hard-block** (reject the out-of-FEFO-order pick and/or the expired-lot sale outright) | Strongest shrinkage/safety/compliance control; no expired product leaves the door. | Rigid; blocks legitimate edge cases (damaged/quarantined lots, manager judgment); poor general-retail UX. | Pharmacy, controlled/regulated goods. |
| **Warn-and-override-with-permission** (system warns + suggests soonest-expiry; a user with permission may override, audited) | Flexible; keeps the human in the loop; matches real-world (skip damaged/quarantined lots). | Allows selling near/at-expiry stock when overridden — relies on the audit trail + permission gate. | Supermarket, general retail. |
| **Per tenant / category / product configurable** (resolve hard-block vs warn-override most-specific-wins) | One platform serves pharmacy *and* supermarket; matches the D1/D5 strategy pattern. | More config surface; clear surfacing required. | Mixed-vertical tenants (the RetailOS norm). |

- **Recommendation (recommendation only — NOT a decision):** make D4 **configurable per tenant/category/product** (option 3), with the **platform default = warn-and-override-with-permission** (`inventory.override_expiry`) for general retail, and **hard-block selectable** for pharmacy/controlled/regulated categories. This mirrors the D1 costing and D5 oversell strategy pattern (policy resolved above a neutral ledger). **It deliberately does NOT bake in a universal hard-block.**
- **Decide (OPEN — owner):** (a) FEFO picking strength default (advisory vs enforced); (b) expired-lot handling default (warn-and-override vs hard-block) and whether it is per tenant/category/product; (c) the permission that gates an override (`inventory.override_expiry`); (d) whether near-expiry (not yet expired) is warned at a configurable horizon.
- **Blocks:** picking/allocation logic, the POS lot-selection UX (Phase 4), expiry-alert thresholds, the `inventory.override_expiry` permission, and the per-tenant/category/product policy resolver.

### D5 — Negative-stock / oversell policy ✅ DECIDED (2026-06-22, owner directive)
**Charter §14 defines three oversell policies (allow+backorder / hard reservation via Edge Hub / optimistic deduction+compensation) but the *choice* was explicitly deferred in VS#1.** Phase 2 inventory needs the **on-hand-can-go-negative?** decision even before the full offline policy lands.

| Option | Pros | Cons |
|---|---|---|
| **Never allow negative on-hand (hard block)** | Ledger integrity is obvious; no negative balances. | Blocks legitimate sales when receipts lag (common in fast retail); poor cashier UX. |
| **Allow negative + flag** (§14 option 1) | Business continues; ledger reconciles later. | Negative balances must be visible, alerted, and reconciled; valuation of negative on-hand needs a defined cost. |
| **Per tenant/category/product policy** | Pharmacy/serialized strict, supermarket lenient. | Config + clear surfacing. |

**✅ DECISION (owner directive, 2026-06-22):**
- **Default POS policy = "Allow Oversell with Flagging."** The stock ledger **may go negative**; on a sale that drives on-hand below zero the system **emits a stock-discrepancy domain event** (`inventory.stock_discrepancy`) for **manager review / cycle count** (surfaced on a manager dashboard, §22/§26/§27). The sale is **not** blocked.
- **Hard-block oversell is configurable per tenant / category / product** — required for **serialized goods, controlled goods, regulated inventory, and high-risk items**. When hard-block is in effect, a sale that would go negative is rejected with a structured `INVENTORY_INSUFFICIENT` error (with available qty).
- **The ledger stays policy-neutral.** `StockLedger.append` **records the movement faithfully and never enforces a policy** (it can represent a negative balance) — exactly as VS#1 shipped. The oversell policy is a **decision layer applied ABOVE the ledger** at the sale/issue boundary: resolve effective policy (product → category → tenant default) → either allow+flag (emit discrepancy event) or hard-block (reject). This keeps the append-only ledger reusable by offline sync, transfers, and adjustments without baking in a POS rule.
- **Consistency:** this is the **same policy** that the eventual §14 offline oversell reconciliation must honor — the offline queue replays movements through the same policy layer. Negative on-hand is **valued at the last known cost** until corrected by a receipt/adjustment.
- **Still to confirm at the approval gate (mechanics):** (a) default config granularity surface (we model per tenant/category/product; confirm location-level too); (b) precedence (recommend most-specific-wins: product → category → tenant); (c) whether the discrepancy event also auto-opens a cycle-count task or just alerts.
- **Blocks:** the oversell **policy resolver** (separate from `StockLedger.append`, which stays neutral), POS sale acceptance, the `inventory.stock_discrepancy` event + manager-dashboard consumer, `inventory.override_negative` permission for manual overrides, valuation of negative on-hand, and the §14 offline reconciliation design.

### D6 — Barcode symbologies + weight/price-embedded barcode format ⏳ OPEN (owner decision — keep Phase 2 build conservative)
**Charter §18 requires "weight/price embedded barcode parsing and scale integration" for supermarkets but the embedded-barcode *format is region/retailer-specific* and not specified.** EAN-13 prefixes `20–29` are reserved for in-store/variable-measure items, but the digit layout (which digits are item code vs weight vs price vs check digit) **varies per retailer/region** and must be configurable, not hardcoded (§12 "country configuration must be data-driven"). Standard symbologies to support: **GS1, EAN-13, UPC-A, EAN-8, Code-128, QR**.

**Competitor evidence** (`competitive/inventory.md`, cited): **only Cin7 Core and Odoo natively parse weight/price-embedded barcodes** (Cin7 via POS GS1/weight/price barcodes; Odoo via a configurable EAN-13 nomenclature with "Weight/Price Barcodes N Decimals"); **Finale** is partial (Bluetooth-scale weight capture, not retail price-embedded EAN-13); **NetSuite, ERPNext, Zoho, inFlow, Fishbowl have none**. So variable-weight parsing is both a **real differentiator** and **not** table-stakes — it can be **modelled now and built conservatively** (the data-driven format config + parser *interface* in Phase 2; the live scale/parser implementation with the Phase-4 POS / hardware bridge, §16). **Phase 2 build scope stays conservative**: standard-symbology `barcode` table + the configurable embedded-format seam, no live scale integration.

| Option | Pros | Cons |
|---|---|---|
| **Support a fixed common layout only** (e.g. `2 IIIII WWWWW C`) | Simple. | Breaks for any retailer using a different layout; violates §12 data-driven rule. |
| **Configurable embedded-barcode parser** (tenant defines prefix + field map: item-code / weight / price positions + check) | Works across regions/retailers; future-proof. | More config + a parser interface. |
| **Defer weight-embedded parsing to a later POS/scale phase** | Smaller Phase 2. | Supermarket vertical can't pilot. |

- **Recommended default (recommendation only):** Phase 2 ships **standard symbology support (EAN-13/UPC-A/EAN-8/Code-128/QR) on the `barcode` table**, and **models a configurable weight/price-embedded barcode parser interface (tenant-defined prefix + field map)** but **defers the live scale-integration + parser implementation to the Phase 4 POS / hardware-bridge work** (§16). The *format config* is decided now so the schema seam exists.
- **Decide:** (a) which symbologies are in Phase 2 scope; (b) whether the embedded-barcode parser ships in Phase 2 or Phase 4; (c) the default embedded-barcode field-map template for the launch market (GRA/Guyana) — must be data-driven, overridable per tenant.
- **Blocks:** the `barcode` table format, the embedded-parser interface, scale integration (§16), and the POS scan path.

### D7 — Reorder-point automation (suggest vs auto-PO) ⏳ OPEN (owner decision required)
**Charter §18 lists "reorder levels, min/max stock" and "reorder suggestions" but does not say whether reorder triggers *suggest* a PO or *auto-create* one.**

**Competitor evidence** (`competitive/inventory.md`, cited): per-location reorder points are near-universal (Cin7, inFlow, Finale, NetSuite, Odoo); demand-based/auto reordering exists in **Finale (sales-velocity), Cin7 (AI Smart Reorder), Fishbowl (MRP), NetSuite (Demand/Supply Planning), ERPNext (auto Material Request), Odoo (auto-trigger PO/MO)** — but every one of these depends on supplier/cost data and an approval workflow. Since RetailOS procurement (suppliers, POs, landed cost, approvals) is **Phase 6**, auto-PO cannot land in Phase 2 without that data — supporting suggest-only now.

| Option | Pros | Cons |
|---|---|---|
| **Suggest only** (low-stock alert + a "create PO" suggestion the buyer confirms) | Human-in-the-loop; safe; matches §18 "reorder suggestions" wording. | Requires manual action. |
| **Auto-create draft PO** (system drafts, human approves) | Faster replenishment; still gated. | Needs supplier/cost data + approval wiring (Procurement, Phase 6). |
| **Fully automatic PO** (auto-create + auto-approve) | Hands-off. | Risky; bypasses the §22 approval workflow; not recommended. |

- **Recommended default:** **suggest only in Phase 2** (low-stock alert via §22 notifications + a reorder-suggestion report), with **auto-draft-PO deferred to Procurement (Phase 6)** where supplier/landed-cost data exists, and always gated by the §22 PO-approval workflow. **Never fully automatic.**
- **Decide:** (a) Phase 2 = suggest-only confirmation; (b) reorder-point math (fixed min/max vs demand-based / lead-time aware — recommend fixed min/max in Phase 2, demand-based later); (c) per-SKU/per-location reorder points.
- **Blocks:** the `reorder_rule` schema (min/max + location), the low-stock alert event (§22/§24), and the Procurement auto-draft seam (Phase 6).

> **Summary of HARD-STOP decisions:** ✅ **D1** costing method *(DECIDED: AVCO default + FIFO per tenant/category/product, no LIFO)* · ⏳ **D2** multi-UoM model · ⏳ **D3** serial/batch/lot scope · ⏳ **D4** expiry/FEFO enforcement · ✅ **D5** negative-stock/oversell *(DECIDED: allow-with-flagging default + per tenant/category/product hard-block)* · ⏳ **D6** barcode symbologies + weight-embedded format · ⏳ **D7** reorder automation · ⏳ **D-money** rounding mode *(OPEN — pending GRA/target-country VAT rounding verification; do not assume a mode)*. The ⏳ items still need an owner decision; all resolutions (decided + pending) are recorded in an ADR before Phase 2 coding.

---

## Vision

Give every RetailOS tenant a **single, ledger-true inventory engine** that the whole ERP shares — POS, ecommerce, procurement, warehousing, and accounting all read and move the *same* stock (§3). On-hand is never a stored counter; it is a projection of an append-only movement ledger, so stock is always auditable, reconcilable, and replay-safe offline (§18, §33). Phase 2 turns the VS#1 proof-of-spine into a real product catalog (variants, SKUs, barcodes, multi-UoM, batch/serial/expiry) with correct **costing & valuation**, so later phases (POS, accounting, procurement) post against a trustworthy inventory core.

## Personas

- **Inventory/stock manager** — defines products, UoMs, reorder points; runs counts, adjustments, valuation reports.
- **Warehouse/receiving clerk** — receives stock (creates receipt movements), captures lots/expiry/serials.
- **Cashier (downstream, Phase 4)** — sells stock (creates sale movements); needs accurate on-hand, lot selection, weight-embedded scans.
- **Accountant** — relies on valuation (inventory asset) + COGS postings being correct (§20 seam).
- **Buyer/procurement (downstream, Phase 6)** — consumes reorder suggestions.
- **Tenant admin** — configures costing method, tracking modes, barcode formats (the HARD-STOP decisions, per-tenant).
- **Platform/MSP admin** — monitors inventory data-quality and reconciliation health across tenants.

## User stories

- As an **inventory manager**, I want to create a product with variants and SKUs (each with barcodes and a base UoM), so that the catalog reflects what we actually sell.
- As an **inventory manager**, I want to define alternate UoMs (buy carton of 24, sell each), so that purchasing and selling units differ but the ledger stays consistent.
- As a **receiving clerk**, I want to receive stock with a batch number and expiry date, so that perishable/pharmacy stock is tracked and FEFO works.
- As an **inventory manager**, I want a valuation report by SKU×location using the configured costing method, so that the inventory-asset figure ties to accounting.
- As an **inventory manager**, I want to run a stock count and post the difference as an adjustment, so that physical and system stock reconcile with an audit trail.
- As an **inventory manager**, I want a low-stock alert when on-hand drops below the reorder point, so that I can replenish before stockout.
- As a **tenant admin**, I want to set the costing method and tracking modes for my company, so that inventory behaves correctly for my vertical (pharmacy vs hardware vs electronics).
- As an **accountant**, I want every stock movement to carry a unit cost and post inventory-asset/COGS journals, so that the books are correct (§20 seam, real GL in Phase 5).

## Business rules

- **Ledger is the sole truth (§18, §33):** stock changes **only** via `StockLedger.append` (the VS#1 sole-mutator). On-hand = sum of base-unit `qty` deltas per SKU×location×status. No table stores a mutable on-hand counter.
- **Every movement is typed and audited (§18, §25):** movement types — opening_balance, receipt, sale, return, refund, adjustment, transfer_out/in, damage, loss, expiry, reservation, reservation_release (bond_release/assembly deferred to Phase 3/manufacturing). Every movement writes an audit-log entry and emits an outbox event (§24).
- **Quantities in base UoM minor units (§19 discipline applied to qty):** ledger `qty` is always the SKU's base unit; UoM conversion happens at the edge (receive/sale), never inside the ledger.
- **Costing per the configured strategy (D1 — DECIDED):** each movement carries `unit_cost` (minor units + currency + scale, §19); valuation derives from the **effective costing strategy resolved per product → category → tenant** (AVCO default; FIFO where configured; never LIFO). No floats.
- **Oversell policy sits above the ledger (D5 — DECIDED):** `StockLedger.append` is policy-neutral and may record a negative balance; the **oversell policy resolver** decides allow-with-flagging (emit `inventory.stock_discrepancy`) vs hard-block at the sale/issue boundary.
- **One rounding policy (§19) — mode OPEN:** all UoM conversions and cost computations will use the tenant's single rounding policy; **the rounding *mode* is not yet chosen** (pending GRA/target-country VAT rounding verification — do not assume banker's or half-up). Not needed until division (tax/FX, Phase 5).
- **Inventory states are explicit (§18):** available / reserved / damaged / lost / in_transit / bonded / released / returned / quarantined / expired — modelled as ledger `status` (bonded/released active in Phase 3).
- **No hard deletes (§8/§33):** products/SKUs soft-delete (`deleted_at`); movements are append-only (corrections are compensating movements, never edits).
- **Tenant-scoped + RLS (§8/§29):** every table carries `tenant_id`; RLS fail-closed (inherits the VS#1 `app.tenant_id` GUC pattern).
- **Idempotent movements (§23):** each movement carries an idempotency key (tenant+endpoint+op); replay yields one effect.
- **Numbering for documents (§17):** adjustments/counts that produce documents draw from `number_block` (gapless, tamper-evident) — reuses the VS#1 allocator seam.

## Permissions / entitlements (§7)

- `products.view` / `products.create` / `products.edit` / `products.archive`
- `inventory.view` / `inventory.adjust` / `inventory.receive` / `inventory.transfer` / `inventory.approve_adjustment`
- `inventory.count` (run/post stock counts) · `inventory.override_expiry` (D4) · `inventory.override_negative` (D5)
- Feature flags (§10): `multi_currency_enabled` (multi-currency cost), `warehouse_enabled` (counts/transfers UI), `advanced_reporting_enabled` (valuation analytics).
- Approval workflows (§22): inventory adjustments and (later) bond releases route through approval; large adjustments require `inventory.approve_adjustment`.
- Cashiers must **not** get inventory-adjust/receive by default (§7 least privilege).

## Data model (tables touched; tenant-scoped + audit fields per §8)

**Extends VS#1** (`product`, `stock_ledger` append-only, the `StockLedger`/`Money`/`AuditLog`/`Idempotency`/`Outbox` services). New/expanded:

- **Catalog:** `product`, `variant`, `sku`, `barcode`, `category`, `brand`, `unit_of_measure`, `uom_conversion`, `bundle`/`bom`/`bom_line` (kit/assembly catalog modelling only — build/disassembly movements deferred).
- **Tracking:** `lot` (batch number, expiry, manufactured date), `serial` (stub per D3); `stock_movement` gains nullable `lot_id`/`serial_id` FKs and `tracking_mode` awareness.
- **Costing (D1 DECIDED — BOTH storage paths are required, not either/or):** costing method is **strategy-selected per tenant/category/product** (AVCO default, FIFO opt-in, no LIFO), and a single catalog may be **mixed** (e.g. AVCO general merchandise + FIFO lot-tracked pharmacy SKUs). The schema therefore ships **both** storage paths and implementation must omit **neither**:
  - `avg_cost` (running weighted-average cost per SKU×location) — backs the **AVCO** default. Updated in place by the AVCO strategy on each receipt/issue.
  - `valuation_layer` (FIFO cost-layer table per SKU×location, consumed oldest-first) — backs **FIFO**-enabled tenants/categories/products. Layer rows are created on receipt and consumed on issue.
  - `costing_method` config columns on `tenant` / `category` / `product`(/`sku`) + a **costing-strategy resolver** (most-specific-wins: product → category → tenant default) that picks which path a given movement uses. A movement under an AVCO-resolved SKU updates `avg_cost`; under a FIFO-resolved SKU it writes/consumes `valuation_layer`. **The ledger stays the single source of truth; these are valuation projections beside it.**
- **Reorder:** `reorder_rule` (sku_id, location_id, min, max) — D7.
- **Counts/adjustments:** `stock_count`, `stock_count_line`; adjustments are movements of type `adjustment` referencing the count.
- All tenant-owned; RLS predicate `tenant_id`; append-only tables (`stock_movement`) carry no `updated_at`/`deleted_at` (corrections = new rows). See `domain-model.md` §5 for the full table map.

## Offline behavior (§13/§14)

- **Reads from cache:** `cached_products`, `cached_prices`, cached on-hand snapshot (form-factor store engine, §4 — Dexie web / SQLite Tauri+mobile).
- **Movements queue locally** and replay sequentially with idempotency keys on reconnect (§14); **never silently discarded** (§33).
- **On-hand & valuation are mutable shared state** → **must not** use blind last-write-wins; ledger truth + reconciliation dominate (§14). Conflicts (e.g. negative on-hand on sync, oversell) are surfaced and alerted, governed by the **D5** policy and the eventual §14 oversell choice.
- **Device clocks untrusted (§14):** movements carry device/terminal/monotonic-counter/local-ts/payload-version/idempotency-key; **server time is authoritative** for posting/valuation order.
- Phase 2 itself is server-side; the offline *queue* lands in Phase 4 (POS) but the **ledger and idempotency seams here must be replay-safe** so Phase 4 drops in without redesign.

## Money / fiscal (§17/§19)

- All costs/valuations as **integer minor units + currency + scale** (§19); never floats. **Multi-currency cost** supported (imported goods) → FX to base currency at valuation; realized/unrealized gain/loss is an accounting concern (§20, deferred).
- **One rounding policy** applied to every UoM conversion and cost calc — **rounding mode still OPEN** (GRA/target-country VAT rule to be verified; not assumed). First needed at division (Phase 5 tax/FX).
- Stock-count/adjustment documents draw gapless numbers from `number_block` (§17); the fiscal seam is reserved (no fiscalization in Phase 2).

## Reporting (§27)

- **Operational:** on-hand by SKU/location/status; low-stock; reorder suggestions; expiring-batch (FEFO horizon); dead/slow stock; stock-movement history; count variance.
- **Valuation:** inventory valuation by SKU/location (per configured costing method); valuation roll-forward (opening + receipts − issues = closing) tying to the inventory-asset account.
- **Data-quality (§26):** duplicate SKU/barcode, missing cost, negative margin, negative on-hand, invalid UoM, expiring/expired batch.
- **Read-model discipline (§27):** valuation/analytics run off event-fed read models / replicas, **never heavy joins on the OLTP movement table**. Phase 2 may ship a direct query for small catalogs; the read-model is Phase 12.

## Integrations / import / migration (§23/§41/§42)

- **Import wizard (§28):** CSV/Excel import of products, SKUs, barcodes, opening stock, costs, UoMs, reorder points — with mapping, preview, validation, duplicate detection, rollback, audit, background job.
- **Migration-in from competitors (§41):** mapping templates for **Cin7 Core (DEAR), Fishbowl, Zoho Inventory, inFlow, Finale** product/SKU/UoM/opening-stock/cost exports → RetailOS catalog + opening-balance movements. Costing method on import must be reconciled to the tenant's configured method (D1) — opening stock imports as `opening_balance` movements with stated unit cost.
- **Events (§24):** emits `product.created/updated`, `inventory.received/adjusted/transferred`, `inventory.low_stock`, `inventory.count_posted`, and `inventory.stock_discrepancy` (D5 — oversell/negative-on-hand flag for manager review/cycle count) via the outbox; consumers (procurement reorder, accounting posting, notifications, manager dashboard) subscribe — no direct coupling.
- **Idempotency (§23):** every receive/adjust/count-post is idempotent; import batches carry batch IDs.

## Edge cases & error states (§25)

- Receiving with an expiry already in the past → warn/block per D4.
- UoM conversion producing a fractional base unit when SKU is discrete-only → reject with a structured error.
- Selling more than on-hand → governed by D5 (DECIDED): **default allows the sale, drives the ledger negative, and emits `inventory.stock_discrepancy`** for manager review; where hard-block is configured (serialized/controlled/regulated/high-risk), it is rejected with a structured `INVENTORY_INSUFFICIENT` error and available qty.
- Negative on-hand discovered on offline sync → conflict surfaced + alerted (§22), reconciled, not overwritten.
- Costing a SKU with no prior cost (first issue before first receipt) → defined fallback (recommend: zero-cost with a data-quality flag, or block per policy).
- Duplicate SKU/barcode on create or import → rejected with the conflicting record surfaced.
- Adjustment exceeding the approval threshold without `inventory.approve_adjustment` → blocked, routed to approval (§22).
- All errors: friendly message + structured code + request/correlation ID, never raw stack traces (§25).

## Observability (§26)

- Metrics: movement throughput, valuation-job latency, reconciliation lag, count-variance rate, negative-on-hand count, low-stock alert volume.
- Logs: structured inventory log (movement append, adjustment, count post, import batch) with correlation IDs.
- Alerts (§22/§26): low stock, expiring batch, numbering gap, negative on-hand, failed valuation job, unsynced terminal, duplicate fiscal/SKU number.

## Acceptance criteria / Definition of Done (§35)

- Types pass · Tests pass · Tenant scoping verified **+ RLS-bypass check** (cross-tenant inventory read denied; fail-closed unset GUC ⇒ zero rows) · Audit written for every movement/catalog mutation · Errors friendly + structured · Logs structured · Permissions/entitlements enforced (cashier ≠ inventory-adjust) · **Money & quantity in integer minor units** · **Stock-ledger invariant tested** (sum of deltas == on-hand projection; never negative beyond D5 policy) · **Costing/valuation tested** against the chosen method (D1) · UoM-conversion rounding tested (single policy) · Idempotent receive/adjust tested · Outbox event emitted in same tx · Import rollback tested · Docs (this spec + competitive + ADR for HARD-STOP decisions) updated · Rollback plan (expand/contract) noted.

## Rollback plan (§8)

- All schema changes via **expand → backfill → switch → verify → contract-later** (§8 / `domain-model.md` §7). New columns nullable/defaulted; no `NOT NULL` without default; no in-place renames.
- The `valuation_layer` / `avg_cost` shape (D1) and `lot`/`serial` tables ship additively; if a costing decision changes, revaluation is an additive movement event, never a destructive migration.
- Append-only ledger means corrections are compensating movements — there is nothing to "un-write"; a bad release is reverted by ceasing to write the new shape and (if needed) a backfilled correction batch.

## Known limitations / intentionally deferred

| # | Item | Why deferred | Charter ref |
|---|---|---|---|
| 1 | **Multi-location transfers (functional)** | Transfer movement types modelled; full transfer workflow (in-transit, two-sided) is Phase 3. | §18 |
| 2 | **Warehouse bin/zone, pick/pack/dispatch** | Phase 3 (Locations, Warehouses, Bonds). | §18 |
| 3 | **Bonded warehouse + landed cost** | Phase 3/6; bonded/released ledger statuses reserved now. | §18 |
| 4 | **Serial capture flows + RMA** | `serial` stubbed (D3); capture/RMA is Phase 4 POS / electronics vertical. | §18 |
| 5 | **Live scale integration + weight-embedded parsing** | Parser *interface/format config* decided now (D6); live impl is Phase 4 / hardware bridge (§16). | §18, §16 |
| 6 | **Offline POS queue** | Phase 4; ledger/idempotency seams here are replay-safe so it drops in. | §13/§4 |
| 7 | **Real GL / COGS posting** | Accounting posting is a placeholder interface (VS#1); real double-entry is Phase 5. | §20 |
| 8 | **Reporting read models / star schema** | Phase 12; Phase 2 uses direct queries for small catalogs. | §27 |
| 9 | **Auto-draft PO from reorder** | Phase 6 Procurement (D7 suggest-only in Phase 2). | §18 |
| 10 | **Standard-cost & manufacturing build/disassembly** | Deferred to a manufacturing phase (D1); BOM is catalog-modelling only here. | §18/§21 |
