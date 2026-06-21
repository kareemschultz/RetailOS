# RetailOS Glossary (Ubiquitous Language)

Per charter §34. Keep terms consistent across code, specs, and UI. Add terms as modules are built.

## Platform & tenancy
- **Platform Owner / MSP** — the operator of RetailOS; **not** a tenant; data logically separated (§8/§10).
- **Tenant** — a customer organization (maps to a Better Auth organization); owns all its data (`tenant_id`).
- **Company** — a legal/accounting entity within a tenant; numbering, COA, and books are per-company.
- **Location** — a store, warehouse, bonded warehouse, distribution/service/fulfillment center within a company.
- **Entitlement** — fine-grained, resolved access = permission × feature flag × subscription/license × scope × device × approval (§7). Distinct from Better Auth coarse roles.
- **Offline entitlement snapshot** — cached entitlements that govern allowed features while offline (§13).

## Inventory & warehouse
- **Stock ledger** — append-only record of stock movements; the source of truth (never a bare counter) (§18).
- **Stock movement** — opening balance, receipt, sale, return, adjustment, transfer, damage/loss/expiry, bond release, assembly, reservation/release.
- **Bonded vs released stock** — in-bond (duty unpaid) vs duty-paid/released; tracked separately (§18).
- **Landed cost** — unit cost incl. freight, duty, insurance allocated across receipt lines (§18).
- **FEFO/FIFO/LIFO/weighted average** — picking (first-expiry-first-out) and valuation methods (§18).
- **UoM** — unit of measure; multi-UoM conversions (carton ↔ unit) (§18).

## POS & money
- **Shift / X-Report / Z-Report** — cashier session; mid-shift snapshot / end-of-day settlement (§19).
- **Blind shift close** — counted cash entered without showing expected amount; system computes over/short (§19).
- **Minor units** — integer smallest currency unit (amount + currency + scale stored together) (§19/§33).
- **Number block** — a reserved sequential document-number range issued to a terminal/Edge Hub for offline use (§17).
- **Commission / Sales Rep** — rep selected at checkout; flat/percentage/tiered commission (§19).
- **Standalone vs Integrated EFTPOS** — card payment merely recorded vs amount pushed to the terminal (§19).

## Offline & edge
- **Edge Hub** — optional Dockerized LAN sync hub coordinating terminals during WAN outage (§15).
- **Reconnection avalanche** — surge of queued mutations syncing on reconnect; mitigated via Redis queues/backpressure (§14).
- **Idempotency key** — tenant+endpoint+operation key guaranteeing replay-safe, exactly-once effects (§23).
- **Outbox** — table from which versioned domain events are reliably published (§24).

## Compliance & audit
- **Fiscalization** — tax-authority signing/clearance of receipts/invoices via a pluggable provider (§17).
- **Crypto-shredding** — erasure by destroying a subject's PII key while keeping balanced records (§25).
- **Auditor Package** — tamper-evident, scoped export of a fiscal year's books for tax authorities (§25).
- **Data residency** — where DB/files/backups/logs/email live; per-tenant attestable (§9).

## UI / design
- **Surface** — a distinct UI context (POS, warehouse, admin, accounting, dashboards, storefront, auth, MSP).
- **Token** — CSS custom property for color/radius/font; the white-label contract; nothing hardcodes these (§5/§11).
- **Motion budget** — per-surface allowance for animation (near-zero on POS; full on marketing) (§5).
