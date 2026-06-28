# Module Entitlements — Design Draft (owner-gated; NOT a decision, NOT implementation)

> **Status: DRAFT for owner review.** This document maps the design space for *tenant module
> entitlements* — which licensable modules a tenant may enable, and what must happen at the boundaries
> where an enabled module depends on one that is absent. It adds **zero entitlement code** and **zero
> module-awareness to any component**. It does not decide the open questions in §7; it frames them so the
> owner can. Entitlements implementation is **Phase 11** scope (`phase-roadmap.md:18`, "Not started").
>
> Authored from a read-only module-dependency recon of the current codebase (every cited edge has
> `file:line` evidence). The single most important finding: **every module integration today is a HARD,
> unconditional call** — there is no `if (moduleEnabled)` seam anywhere — so "module entitlements" is not a
> filter over existing soft seams; those seams do not exist. That is why this is a design problem first.
>
> **Governance dependency (read this first):** this draft builds on the product/platform governance
> introduced by **PR #40** (`product-platform-roadmap.md` + engineering principles **#19–#20**), which is
> **pending merge and not yet on `master`** (master's `engineering-principles.md` has principles 1–18 only).
> Every reference below to the five-layer separation, the "components stay token-based / never
> module-aware" law, the frozen-governance rule, and **principle #20 (Action Availability)** is a forward
> reference to **PR #40 (pending)** — the content this doc relies on is restated inline so the doc stands
> alone regardless of merge order. If PR #40 changes or is abandoned, these references must be re-homed;
> they are not yet governing law on `master`.

## 0. Why this is design-first, not a toggle

The owner's framing, restated and now evidence-backed: backend modules **integrate at the data layer**.
`pos.createSale` does not "show a POS screen" — it appends a stock-ledger movement and runs the costing
engine, unconditionally, inside one transaction (`packages/api/src/routers/vs1.ts:3112`, `:3125`). So
"POS without inventory" is not "which sidebar renders" — it is *"what does a sale physically do when there
is no inventory to deduct from?"* That is the project's recurring defect class (a guarantee that holds in
isolation but the integration path routes around it), applied to licensing: a naive "disable inventory"
toggle would leave POS calling a service that is no longer there, and the sale would error or corrupt.

**This doc therefore does NOT propose toggles. It proposes (a) the dependency graph that makes a module
set coherent-or-not, (b) the bundles that closure produces, and (c) a stance on absent-module behavior at
every boundary — to be ratified by the owner before any Phase-11 code.**

## 1. What "module entitlements" is — and the four layers it must not be conflated with

Per the product/platform governance in **PR #40** (`product-platform-roadmap.md`, *pending merge*), five
concerns are deliberately separated — restated here so this doc is self-contained. Entitlements is exactly
one of them:

| Layer | Question it answers | Exists today? |
|---|---|---|
| **Engineering dependency graph** | which modules technically require which | implicit in code (this doc makes it explicit) |
| **Module entitlements** (THIS DOC) | which modules a *tenant* has licensed / may enable | ❌ **greenfield** — no schema, no service |
| **Commercial product packages** | which bundles are *sold* (POS Starter, Retail Pro, …) | ❌ commercial planning, not architecture |
| **Licensing / feature flags** | enforcement mechanism + usage limits | ❌ deferred (`entitlements.ts:5–8`) |
| **Deployment profiles** | single-store / self-hosted / MSP / offline-first / HA | ❌ operational axis (charter §9) |

And critically, **module entitlement ≠ RBAC**:

- **RBAC** (exists) — *what a user role may do*: `pos.create_sale`, `inventory.receive`, `bond.release`.
  Resolved from `membership.role` (`packages/db/src/services/entitlements.ts`, `ROLE_PERMISSIONS`).
- **Module entitlement** (greenfield) — *what a tenant has licensed*: "this tenant has the Inventory
  module provisioned." A cashier with `pos.create_sale` (RBAC ✓) still cannot sell if the tenant never
  licensed POS (entitlement ✗). **Two different layers; both must pass; both enforced server-side.**

`entitlements.ts:5–8` is explicit that the *full* Entitlements Service (feature flags, license limits,
approval rules, company/location access) is **deferred**; what exists is user-role RBAC only. There is no
`feature_flag`, `subscription`, or `license` table (`packages/db/src/schema/organization.ts` carries only
operational settings; `membership` carries only `role`).

## 2. The module dependency graph (HARD vs SOFT edges)

### 2.1 Modules that exist as code (P1–P4 shipped)
Stock-ledger, costing, inventory, transfer, bond, bond-release, audit, idempotency, shift, receipt,
number-lease, outbox, money, rounding, settings-resolver (`packages/db/src/services/`). Single API router
`packages/api/src/routers/vs1.ts`.

### 2.2 Modules planned, not built
GL/Accounting (P5), Procurement (P6), CRM (P7), Ecommerce (P8), Hardware (P9), Edge Hub (P10),
SaaS/Licensing/**Entitlements** (P11), Analytics (P12) — `phase-roadmap.md:12–20`.

### 2.3 The edges (HARD = caller errors / corrupts if target absent; SOFT = degrades gracefully)

| From | To | Type | Evidence | Break mode if target absent |
|---|---|---|---|---|
| POS `createSale` | Stock-Ledger | **HARD** | `vs1.ts:3112` (`appendStockMovement`, unconditional per line) | tx errors → **sale impossible** |
| POS `createSale` | Costing | **HARD** | `vs1.ts:3125` (`applyValuation`, unconditional per line) | tx errors → sale impossible |
| POS `createSale` | Numbering | **HARD** | `vs1.ts:3226` (`allocateSaleNumber`) | no document number → sale impossible |
| POS `createSale` | Audit | **HARD** | `vs1.ts:3363` (`recordAudit`) | audit insert fails → sale impossible |
| POS `createSale` | Outbox | **HARD** | `vs1.ts:3304,3372` (`emitEvent`) | event lost → GL never sees the sale |
| POS `createSale` | Shift | **SOFT** | `vs1.ts:3208–3214`; `organization.ts:41–43` | `shiftId = null` when shift enforcement optional; **sale still succeeds** |
| Inventory (valuation) | Costing | **HARD** | `costing.ts:121–319` | no valuation tables → costing queries fail |
| Stock-Ledger | avg_cost / valuation_layer | **HARD** | `schema/inventory.ts:30–61,190–236` | no cost cell → COGS uncomputable |
| Transfer ship/receive | Stock-Ledger + Costing | **HARD** | `transfer.ts:9–20` header; `:93–170` | value stranded / tx errors |
| Bond receive/release | Stock-Ledger + Costing (AVCO) | **HARD** | `bond.ts`, `bond_release.ts` | tx errors |
| Inventory count posting | Stock-Ledger + Costing | **HARD** | `inventory.ts:279,294` | variance can't post |
| **GL *inventory-driven* postings (P5)** | POS + Inventory events | **HARD** (consumer) | `event-map-phase4.md`, `cross-phase-dependencies.md §1` | no producer ⇒ no auto COGS / inventory-asset posting (GL's *standalone* primitives — manual journals / AR/AP / banking — still work; see §3) |
| **Procurement (P6, planned)** | Inventory | **HARD** | `phase-6-implementation-plan.md` (GRN → valued receipt) | receipts have nowhere to land |

### 2.4 The irreducible core (substrate, not licensable "modules")
Identity/Auth + RBAC, Tenant context, Money, Audit, Outbox, Numbering, Settings-resolver. Every module
depends on these; they are the platform substrate, **always provisioned**, never an entitlement choice.

## 3. The owner's three sharp questions, answered from the code

**Q: Can POS exist without Inventory?**
**A: No.** A "sale" is not a UI event; it is, atomically, a stock-ledger movement + a valuation. With the
Inventory/Costing module absent, `appendStockMovement`/`applyValuation` have no service/schema to call, the
transaction errors and rolls back, and **no sale row is ever created** (`vs1.ts:3112,3125`). There is no
degraded "POS-only" path in the code.

**Q: What does a sale do with no inventory to deduct from?** Two distinct cases — keep them separate:
- **(a) Inventory MODULE absent** (schema/service not provisioned): hard error, sale impossible (above).
- **(b) Inventory module present, item has NO valuation basis** (never received): the sale **completes**
  with `cogsMinor = 0` and `unvaluedQty = qty`; stock balance goes negative (oversell); an
  `inventory.stock_discrepancy` event is emitted as a management warning (`vs1.ts:3134–3149`;
  `costing.ts` issue paths return `cogsMinor:0, unvaluedQty` when no `avg_cost`/`valuation_layer` exists).
  This is *correct* under the perpetual model (charter §20 C4: COGS recognized on issue) — there simply is
  no cost basis to consume — and the GL handles it as a **no-COGS line plus a later true-up**, not an
  unbalanced journal (`posting-model.md:40,46`).
  **Case (b) is an operational state, not a module-absence; entitlements must not conflate them.**

**Q: Does COGS / GL function without Inventory?**
**A: Partly — and the distinction is load-bearing for entitlements.** Accounting is **not** a single module
that stands or falls with Inventory:
- **Inventory-DRIVEN postings** (automatic COGS on sale, inventory-asset reconciliation) **do** require
  Inventory — they are computed by Costing from Inventory's valuation tables and reach the GL as
  POS/Inventory events (`cross-phase-dependencies.md §1`). With no Inventory there is no valuation, so these
  particular journals have no producer.
- **Standalone accounting primitives** — chart of accounts, manual journals, AR/AP, bank/cash, tax,
  expenses, P&L / balance sheet — are built by Phase 5 from scratch
  (`phase-5-implementation-plan.md:13,17,35`) and function **without** Inventory.

So a GL-only / bookkeeping install is **architecturally coherent** (just not RetailOS's primary retail
target), and a sale with no cost basis posts a no-COGS line + true-up, not an unbalanced book. The accurate
dependency is narrow: ***automatic COGS / inventory-asset posting* needs Inventory; *accounting as a whole*
does not.** ("Accounting is incoherent without Inventory" — the earlier framing — was overbroad.)

## 4. Coherent bundles (what dependency-closure produces)

A bundle is coherent iff it contains the HARD-dependency closure of every module it enables. Examples
(illustrative, owner ratifies the actual catalog — that's the *commercial packages* layer, not this one):

| Bundle | Modules (+ always-on core) | Coherent? | Note |
|---|---|---|---|
| **Minimum sellable POS** | POS + Inventory + Costing | ✅ | the irreducible retail unit — **POS cannot be licensed alone** |
| **Inventory-only** (warehouse / wholesale, no retail till) | Inventory + Costing (+ Transfers, Bond) | ✅ | valid: receive/transfer/count without sales (recon "MAYBE" — technically works) |
| **Retail + back-office accounting** | POS + Inventory + Costing + GL (P5) | ✅ | GL consumes the POS/Inventory event stream |
| **Distribution** | Inventory + Costing + Transfers + Bond + Procurement (P6) | ✅ | Procurement feeds Inventory receipts |
| **Accounting / GL-only** (manual bookkeeping) | GL (COA, journals, AR/AP, banking) | ⚠️ **coherent, not a target retail bundle** | standalone primitives work without Inventory; the inventory-driven COGS/asset postings just have no producer (additive once Inventory is added) — `phase-5-implementation-plan.md:13`, `posting-model.md:40,46` |
| **POS without Inventory** | POS only | ❌ **invalid** | sale path calls Inventory+Costing unconditionally |
| **Transfers/Bond without Costing** | Transfers/Bond, no Costing | ❌ **invalid** | both call `applyValuation` unconditionally |

**The minimum sellable bundle implied by dependency-closure = core + POS + Inventory + Costing.** Numbering,
Audit, Outbox are core (always-on), so they need no separate license but ARE hard prerequisites of POS.

## 5. Absent-module seam behavior — the heart of the design problem

For every boundary where a present module expects an absent one, *something* must happen. Today it is
always "hard error." The design must pick a stance **per edge type**:

### 5.1 HARD edges — two stances
- **(A) Mandatory-bundle (dependency-closure) — the lower-risk option (owner ratifies — §7, question 1).**
  Entitlement enforces that a module cannot be enabled without its transitive HARD dependencies:
  provisioning POS provisions Inventory + Costing (+ core). No new graceful seam is needed because the
  incoherent combination is simply *not representable* — you can't license POS-without-Inventory. This
  matches the current code reality (HARD unconditional calls) and is the cheapest, safest path: it adds a
  *provisioning constraint*, not a new code path through the sale. **Lowest risk of re-opening the #8
  write-path class.**
- **(B) Graceful-seam.** Build a real "Inventory-absent" code path — e.g. a *non-stock line type* so a
  service business can sell labor/fees with no stock deduction. This is a **designed feature**, not a
  toggle: it needs its own line model, its own (zero/none) valuation behavior, its own GL posting, and its
  own adversarial review — precisely because making the sale path conditionally skip `applyValuation` is
  the #8 hazard ("a write path that routes around the invariant"). Only build a graceful seam where a
  genuine product need exists (a service-only vertical), and treat it as a first-class feature slice.

### 5.2 SOFT edges — already graceful
POS→Shift is the existing model: when shift enforcement is optional, `shiftId` is `null` and the sale
succeeds (`vs1.ts:3208–3214`). Soft edges need no entitlement work beyond honoring the existing setting.

### 5.3 Planned-consumer edges (GL, Analytics)
A consumer module (GL) absent is **inherently graceful for the producer**: POS/Inventory already emit to
the outbox unconditionally; if no GL is provisioned, events simply accumulate unconsumed (no producer
change). So "POS+Inventory without Accounting" is coherent *today* (ops work, nothing posts) — the only
requirement is that enabling GL later can replay the backlog (the outbox already supports this).

## 6. What Phase-11 implementation would need (design space, when ratified)

1. **Module-provisioning schema** — a tenant → enabled-module-set record (the licensable catalog + per-tenant state). New tenant-owned table ⇒ fail-closed RLS in the same commit (charter rule).
2. **Dependency-closure checker** — provisioning a module provisions its transitive HARD deps; refuses incoherent sets (the §4 invalid rows). Sourced from the §2.3 edge table as data, not scattered conditionals.
3. **Server-side enforcement at the write path** — an entitlement gate *beside* the RBAC gate (both must pass). Per **principle #20 (Action Availability), introduced by PR #40 (pending merge)**: the backend decides available modules/actions, the frontend renders them, and **every write is independently re-authorized server-side**. UI visibility is never the enforcement.
4. **An explicit per-edge stance** (§5) — e.g. mandatory-bundle for HARD edges; graceful-seams only where a real vertical needs one, each as its own feature slice. (Which stance is §7's open question 1, owner-gated.)
5. **Components stay token-based, never module-aware** — the component law from **PR #40** (`product-platform-roadmap.md`, *pending merge*). No `if (moduleEnabled)` conditionals scattered through components; entitlement is resolved server-side and surfaced as data (available actions/modules), exactly like `availableActions`.

## 7. Open questions for the owner (this doc does NOT decide these)

1. **Per-edge stance:** accept mandatory-bundle as the default for all HARD edges, or is there a near-term vertical (service-only business) that needs a designed graceful "non-stock POS" seam in the catalog?
2. **Licensable granularity:** is the catalog unit a *module* (Inventory, POS, Accounting) or a finer *capability* (Bonded warehousing as a sub-feature of Inventory)? Finer granularity multiplies the dependency graph.
3. **Inventory-only legitimacy:** is "warehouse without a till" a product we sell (recon says it technically works), and if so does it need its own package?
4. **GL-only / bookkeeping legitimacy:** §3 shows standalone accounting (manual journals, AR/AP, banking) is architecturally coherent without Inventory — is "bookkeeping-only" a bundle RetailOS offers, or explicitly out of scope for a retail/inventory ERP?
5. **Relationship to commercial packages:** packages (POS Starter / Retail Pro / …) are *sold bundles* layered **on top of** these coherent technical bundles — confirm the catalog is "package → set-of-modules → closure," so commercial naming never produces an incoherent technical set.
6. **Enforcement granularity vs deployment profiles:** self-hosted/enterprise tiers may license "all modules" flat; SaaS tiers license subsets. Confirm entitlement resolution is per-tenant data (works across all deployment profiles) and not hardcoded per deployment.

## 8. Non-goals / guardrails (restated)

- This is a **draft for review**, not a decision and not implementation.
- **Zero entitlement code; zero module-awareness added to any component** by this document.
- Entitlement ≠ RBAC ≠ commercial packages ≠ feature-flag mechanism ≠ deployment profiles (§1).
- When built, **enforcement is server-side at the API/service boundary** (principle #20, per PR #40, *pending*); hiding UI is presentation, never security.
- Governance remains frozen (per **PR #40**, `product-platform-roadmap.md`, *pending merge*); this doc is the one pre-authorized design artifact because module entitlements was already queued **design-first**. It introduces no new roadmap/principle.
