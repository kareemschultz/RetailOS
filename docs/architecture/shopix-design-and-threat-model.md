# Shopix (Commerce Experience) — Design Doc + Threat Model

> **Status:** DESIGN ARTIFACT. This is the **last planning document before Shopix is built.** After it is
> adversarially gated and owner-approved, we **build** — no further governance/roadmap/architecture docs;
> code drives the next round. The threat model (§1) *is* the security core of this design, not a separate
> artifact.
>
> **Predecessor:** `commerce-experience-capability-map.md` (the build checklist + the 6 folded gaps
> `GAP-1..6`). This doc turns that map + the 7 owner-locked decisions into a concrete, codebase-grounded
> design. Every claim is anchored to a verified `file:line`.
>
> **Scope guard:** v1 demo scope only (decision #3). Do NOT spin up Accounting/Procurement/CRM in parallel —
> one focused gated thing at a time; Accounting (Phase 5) stays explicitly behind Shopix.
>
> **Adversarial review (2026-06-29):** baseline factual claims verified ACCURATE (§2 slug/no-domain, §4
> no-tax-engine, §6 advisory-lock re-entrancy). 1 CRITICAL + 5 HIGH found, **all folded**: (CRIT) stock was
> deducted before mock payment → re-derived so **stock commits only inside the payment-confirmation
> transaction** (§6/§7), no stranded ledger state; (HIGH) multi-cell deadlock → **canonical sorted lock
> ordering** (§6); (HIGH) `sale.created` needs real document identity → checkout **persists a real
> `sale`/`sale_line`/`tender`** the order links to (§7/§8); (HIGH) public idempotency → **server-minted,
> principal-bound, expiring checkout-intent id** (§6/§9); (HIGH) guest PII → **per-subject-key vault**, no
> raw PII columns (§10/§12); (HIGH) checkout error lets stock binary-search → **generic
> `COMMERCE_UNAVAILABLE`** + probing rate-limit + max-qty cap (§1.5/§6).

---

## 0. Owner-locked decisions (the design constraints)

| # | Decision | Design consequence |
|---|---|---|
| **1** | **Oversell = OPTIMISTIC** — validate-and-deduct **atomically at checkout**, not hard-reserve at add-to-cart | A NEW pre-deduct availability gate inside the existing advisory lock (§6). Carting never locks stock. Schema is hard-reservation-*ready* but v1 doesn't reserve. |
| **2** | Availability granularity = **COARSE** (in-stock / low / out) | Public availability DTO returns a band, never `qtyOnHand` or `totalValueMinor` (§3). |
| **3** | v1 scope = catalog + PDP + coarse availability + browsable storefront + real checkout vs shared ledger + guest + `commerce.quote` with real tax + pickup/delivery fulfilment + order→GL events. **Defer** wishlist/reviews/promotions/loyalty/custom-domains/online-returns-flow | Bounds every section below. |
| **4** | Customer identity = **guest + minimal customer row**; do NOT pull Phase-7 CRM forward; **separate principal** from staff auth | §10 + threat-model §1.4. |
| **5** | Payment = **MOCK/MANUAL-CONFIRMATION** for demo (charter §12), not a live PSP; design the seam so a real PSP slots in | §9. |
| **6** | Online returns = schema **return-READY** (additive), defer the **flow** | §7 order schema carries the return seam; no returns UI in v1. |
| **7** | Tax = **REAL**, never a TODO; `commerce.quote` computes real tax via the tenant's storefront tax/jurisdiction policy; **Guyana GRA VAT as the reference** (confirm rate/category vs GRA — do not fabricate) | §4 — the tax engine is genuinely NEW (none exists today). |

---

## 1. Threat model (the hardest surface — design this first)

RetailOS today has **exactly one trust posture**: an authenticated Better Auth **org member** (staff), with
`tenantId = session.activeOrganizationId` (`request-context.ts:37`), every endpoint a `tenantProcedure`
gated on an operational permission, RLS fail-closed. Shopix introduces an **anonymous, internet-facing
surface** that has none of that. This is the single largest new risk and the reason this doc leads with it.

### 1.1 Trust-boundary ladder

Five principals, strictly increasing capability. A lower rung must **never** acquire a higher rung's
capability by any path.

| Principal | Authenticated? | Tenant resolved by | Can do | Must NOT do |
|---|---|---|---|---|
| **Anonymous** | No | **Hostname** (§2) | Browse public catalog/PDP, coarse availability, build a client cart, get a public `commerce.quote` | See cost/margin/qty/other tenants; mutate anything; enumerate uuids |
| **Guest (checkout)** | No (ephemeral) | Hostname | All anonymous + place ONE order (checkout) with contact/fulfilment details | See others' orders; see staff data; gain a role |
| **Authenticated customer** | Yes (customer principal, §10) | Hostname | All guest + view **own** order history | See others' orders; touch any staff/admin surface |
| **Staff** | Yes (Better Auth org member) | `activeOrganizationId` | The existing back-office (CommerceO/Admin) per permissions | — (unchanged) |
| **Admin/Platform** | Yes | — | Platform console | — (unchanged) |

**Load-bearing rule (GAP-5):** the customer/guest principal is a **distinct identity space** from Better
Auth org members. A customer session must never carry a staff role/permission, and a staff session must
never be *required* to shop. The storefront resolves a *customer* under the hostname-resolved tenant; it
does **not** call `assertPermission` against the staff RBAC. The two auth paths share nothing but the
tenant GUC.

### 1.2 Request flow — fail-closed at every hop

```
request (hostname)
  → resolve tenant from hostname           [fail → 404, never a default tenant]
  → set app.tenant_id GUC                   [fail → unset → RLS returns 0 rows]
  → (optional) resolve customer/guest       [staff principal NEVER auto-granted]
  → public read / cart / quote              [allow-list DTO; cost/qty scrubbed]
  → checkout: acquire stock-cell lock       [§6]
       → availability gate (coarse→exact)   [insufficient → clean reject, idempotent]
       → appendStockMovement (deduct)       [frozen primitive; same lock, re-entrant]
       → applyValuation (COGS)              [#8 — invoked, not skipped]
       → order row + order→GL events        [§7/§8, money-quintuple]
  → payment (mock/manual)                   [idempotent per order; webhook-ready seam]
```

Every hop is fail-closed: a failure resolves to *less* access (404 / zero rows / clean rejection), never a
cross-tenant spill or a silent default. This mirrors the existing RLS posture (an unset `app.tenant_id`
GUC → zero rows) and extends it to the public path.

### 1.3 Public-DTO discipline — allow-list, not scrub-list

Public DTOs are **explicit allow-lists** (only these fields ship), with a paired **forbidden-fields test**
(the existing DTO-leak test pattern, tightened for a public audience). The audience is "anyone on the
internet," so the bar is stricter than the authenticated reads.

| Public DTO | Allowed | **FORBIDDEN (asserted absent)** |
|---|---|---|
| `publicCatalogItem` | id(→slug), name, priceMinor, currency, scale, primaryImageUrl, altText, categorySlug, availabilityBand | cost, margin, `totalValueMinor`, `qtyOnHand`, costingMethod, trackingMode, supplier, internal uuids |
| `publicProductDetail` | slug, name, description, images[], priceMinor+currency+scale, availabilityBand, brand/category names | cost, ledger, valuation, `taxRateId` internals, other-tenant refs |
| `publicAvailability` | **band only**: `in_stock` / `low` / `out` | `qtyOnHand`, `totalValueMinor`, per-location breakdown |
| `commerce.quote` (§4) | per-line subtotal/tax/total, order subtotal/tax/total (money triples) | cost, margin, internal tender plumbing, COGS |
| `customerOrderSummary` | order number, status, lines (name/qty/price), totals, fulfilment status | COGS, margin, other customers' orders |

> **Why coarse availability (decision #2):** `inventory.stockByLocation` (`vs1.ts:3436`) returns
> `qtyOnHand` **and `totalValueMinor`** (cost). Exposing exact quantity is a competitive leak; exposing
> value is a cost leak. The public band is computed server-side from on-hand vs the reorder point, never
> the raw number.

### 1.4 The separate customer principal (GAP-5) — concrete

- A `customer` row (minimal, §10) + an **ephemeral guest** identity (a signed, short-lived checkout token,
  not a Better Auth session). v1 default is **guest checkout**; an optional lightweight customer login is a
  separate principal store, never Better Auth `member`/`organization` membership.
- The customer principal resolves **only** a `customerId` under the hostname-tenant; it grants **zero**
  staff permissions. There is no code path where a customer token reaches `assertPermission` /
  `resolveTenantRole`.
- A staff member is never required to shop (the storefront does not gate browse/cart/checkout on a staff
  session). The only shared element is the tenant GUC.

### 1.5 Abuse budgets (GAP-6)

- **Rate-limit keys:** per-hostname (tenant) **and** per-IP, applied on every public read and — tighter —
  on the checkout write and the `commerce.quote`. Reuse the charter §8 per-tenant token-bucket discipline.
- **Concrete starting budgets (tune with real traffic):** public catalog/PDP reads ~60 req/min/IP;
  `commerce.quote` ~20/min/IP; checkout ~5/min/IP + per-hostname global cap. Checkout additionally
  idempotency-keyed (§6) so retries don't multiply orders.
- **Enumeration defense:** public entities addressed by **slug**, never internal uuid; no list endpoint
  returns internal ids; catalog pagination is bounded.
- **Stock-inference defense (folded from the §3/§6 finding):** the checkout availability gate returns a
  **generic `COMMERCE_UNAVAILABLE`** that never reveals the exact threshold (a "need N, have M" error lets an
  attacker binary-search exact on-hand and defeat coarse availability). Pair with a **per-SKU/IP/tenant
  probing rate limit** and a **max-quantity-per-line cap** on storefront requests so repeated varied-qty
  probes are bounded.

---

## 2. Hostname → tenant resolution (the gateway — NEW)

Charter §11 requires the router to resolve `tenant_id` from hostname. **Not implemented today** — the
`organization` table has `slug` (unique, `organization.ts:22`) but **no `domain`/`subdomain`/`customDomain`
column**, and the server only builds context from the session (`request-context.ts:37`).

**Design:**
- **Schema (expand-only):** add `storefront_domain text UNIQUE` (nullable) and reuse `slug` for the platform
  subdomain pattern (`{slug}.shop.retailos.com`). Custom domains (`shop.acme.com`) populate
  `storefront_domain`. Full white-label custom-domain provisioning is Phase 11; v1 supports the subdomain
  form + an optional manually-set domain.
- **Resolver:** a Hono middleware on the **public** router that maps `Host` header → tenant via
  `slug`/`storefront_domain`, then sets the `app.tenant_id` GUC for the request's tenant transaction —
  **fail-closed:** unknown host → 404, never a default tenant; resolution failure → GUC unset → RLS yields
  zero rows.
- **New procedure type:** `publicProcedure` already exists (only `healthCheck`/`privateData` use it). Add a
  `storefrontProcedure` = `publicProcedure` + hostname-tenant resolution + the tenant GUC, with **no**
  session/permission requirement. This is the storefront's analogue of `tenantProcedure`.

This resolver is also the Phase-11 white-label seam — design it once here, reuse later.

---

## 3. Public read models (Layer B — NEW)

New `storefrontProcedure` reads that **project** existing data through the allow-list DTOs (§1.3). They are
new endpoints, not reuse of the staff-gated ones.

| Endpoint | Projects from | Notes |
|---|---|---|
| `commerce.catalog` | `product.catalog` (`vs1.ts:329`) | published + `is_active` only; slug-addressed; `publicCatalogItem` DTO |
| `commerce.productDetail` | `product.detail` (`vs1.ts:389`) | by slug; images from `product_image`; `publicProductDetail` DTO |
| `commerce.categories` | `catalog.categoryList` (`vs1.ts:928`) | published categories/collections |
| `commerce.availability` | `inventory.stockByLocation` (`vs1.ts:3436`) | **band only** (decision #2); computed from on-hand vs reorder point; never raw qty/value |

**Publishing flag (NEW, expand-only):** add `is_published boolean DEFAULT false` (or a storefront-visibility
column) to `product`/`category` so the storefront shows a curated subset, not the entire internal catalog.
A product visible to staff is not automatically public.

All four are tenant-scoped via the hostname-resolved GUC + RLS (`product`/`sku`/`category`/`location` are
all RLS-covered, fail-closed — verified by `tenant-isolation-coverage.test.ts`). A leak test asserts each
DTO contains none of the forbidden fields.

---

## 4. `commerce.quote` with real tax (GAP-1 — the genuinely new domain work)

**Today there is no tax.** `sale.taxMinor`/`sale_line.lineTaxMinor`/`taxRateId` columns exist
(`sales.ts:52,121-122`) but the MSP path writes **zero** (`vs1.ts:4011-4012`); there is **no `tax_rate`
table** behind the `taxRateId` FK, and `pos.quote` returns zero tax. So a customer-facing total **cannot**
reuse `pos.quote` — it would show untaxed prices. This is the most underestimated piece.

**Design — a minimal, correct, data-driven tax engine (charter §19, not hardcoded to Guyana):**

- **Schema (NEW, tenant-owned, RLS):** `tax_rate` table — `id, tenant_id, code, name, kind text enum
  ["standard","zero","exempt"], rate_basis_points integer, jurisdiction text, is_inclusive boolean, …`.
  `rate_basis_points` keeps tax as integer (e.g. 1400 = 14%), consistent with the no-floats money rule.
- **Product tax class (NEW, expand-only):** a `tax_rate_id`/`tax_class` reference on `product` (or
  `category`, resolved via the settings-resolver precedence: product → category → tenant default). This is
  the seam the existing `sale_line.taxRateId` was reserved for.
- **Computation:** `commerce.quote` resolves the applicable rate per line, computes
  `lineTaxMinor = mulDivRound(lineSubtotalMinor, rate_basis_points, 10000, policy)` reusing the Phase-4
  **`mulDivRound`** primitive (the chosen rounding policy — charter §19 consistent rounding;
  per-line, the ERP convention). Tax-inclusive vs exclusive driven by `is_inclusive` (charter §19 supports
  both centrally; v1 default tax-exclusive). Returns a `taxBreakdown[]` (the
  `receipt.ts:114-118` shape, now actually populated).
- **Reuse the line-pricing math, add the tax limb:** `commerce.quote` reuses the **same line subtotal math**
  as `priceMspLines` (no price drift) and adds the tax computation `pos.quote` lacks.

**Tax is the FIRST real tax implementation** — POS can later adopt it through the seams that already exist
(`taxRateId`/`taxMinor` on sale/sale_line). The storefront drives a capability POS reserved.

> **Launch-blocking confirm (NOT fabricated):** the charter mandates a pluggable seam and explicitly warns
> "do not hardcode one country's fiscal rules… confirm Guyana GRA requirements before launch"
> (`charter §17`, `money-fiscal-inventory.md`). The Guyana GRA VAT rate/category treatment
> (standard-rated vs zero-rated vs exempt, and the current standard rate) is the **reference jurisdiction**
> but its concrete values are a **launch-confirm item against GRA**, seeded as tenant config — not asserted
> here.

---

## 5. Cart model (NEW)

- **Client-first cart** for anonymous browsing (no server lock — decision #1: carting never holds stock).
  Persisted server-side only when a guest/customer is identified (a `cart`/`cart_line` table, tenant-owned,
  RLS).
- **Price handling:** the cart shows live prices; the **authoritative total is `commerce.quote`** (re-quoted
  at checkout, never trusted from the client). A client-submitted price is never honored — the server
  re-prices and re-taxes from `product.priceMinor` + the tax engine (§4).
- **Availability at cart-load:** coarse band (§3); the *binding* check is at checkout (§6).

---

## 6. Checkout / reservation seam (§21 — decision #1, the signature-risk surface)

The storefront sells the **same stock the till sells** (one ledger, charter §21). Decision #1 =
**optimistic, atomic validate-and-deduct at checkout.** Carting never reserves.

**Grounded mechanism (reuses the frozen primitive, adds one gate):**

Today `processSaleLine` (`vs1.ts:3934-3998`) deducts **unconditionally** — it calls
`appendStockMovement(qtyDelta:-qty)` with **no pre-check**, then only *emits* a `stock_discrepancy` event
if `balanceAfter < 0` (`vs1.ts:3981-3998`). `appendStockMovement` (`stock-ledger.ts:50-109`) takes a
re-entrant `pg_advisory_xact_lock(hashtextextended(`${tenantId}:${locationId}:${skuId??productId}`,0))`
**before** reading the cell balance.

**LOAD-BEARING INVARIANT (folded from the CRITICAL review finding): stock commits ONLY inside the
payment-confirmation transaction, atomically with the availability gate.** A `payment_pending` order holds
**zero** stock and has posted **zero** COGS. There is therefore never deducted-but-unpaid stock to strand,
and the immutable ledger needs no reversal in v1. This preserves decision #1 (optimistic, no add-to-cart
reservation, atomic validate-and-deduct) by binding the atomic deduct to **payment success**, not order
placement. For the mock/manual provider the confirm is synchronous, so "at checkout" and "at payment
capture" are the same moment; for a future async PSP the deduct binds to the capture webhook (see §9 for the
post-capture-out-of-stock compensating path).

**The new checkout path** (a customer-facing sibling of `createSale`, NOT a reuse of the cashier-gated
endpoint):

*At order placement (`payment_pending`):* coarse, **non-binding** availability check only (§3 band). NO
lock, NO deduction, NO COGS. The order + a server-minted checkout-intent id are created (§9).

*At payment confirmation (`paid`) — one tenant transaction:*
1. **Aggregate requested quantity by stock cell** (`(locationId, skuId)`), then **acquire every cell's
   advisory lock in a canonical deterministic order** (lexicographic by lock key) — folded from the §6
   deadlock finding: per-line unordered locking lets two writers touching the same cells in opposite order
   deadlock. Canonical ordering removes the cycle. *(POS today locks per-line in input order
   (`vs1.ts:4107-4115`) and has the same latent risk — ticket it; Shopix must sort.)*
2. **Availability gate, under the locks:** read each cell on-hand (the same `SUM(qty_delta)` query
   `appendStockMovement` uses); if any `on_hand < qty` → **reject with a GENERIC `COMMERCE_UNAVAILABLE`
   error that does not reveal the threshold or exact stock** (folded from the stock-probing finding — a
   distinguishable "need N, have M" error lets an attacker binary-search exact stock and defeat coarse
   availability). Combined with per-SKU/IP rate limits + a max-qty cap (§1.5).
3. Call the **frozen** `appendStockMovement` (re-acquires the same xact lock, re-entrant → no self-deadlock,
   PostgreSQL-documented) to deduct, then **`applyValuation` unconditionally** (#8 — the write path
   *invokes* valuation, never skips it; COGS stamped on the **sale_line**, §8).
4. Persist the **real financial document** (sale + sale_line + tender) AND the **fulfilment document**
   (order + order_line linking to the sale) — see §8; allocate the order/sale numbers; emit the GL events.

**Idempotency (folded from the §9 finding):** do NOT key on a client-supplied id. Use a **server-minted,
high-entropy checkout-intent id, bound to the guest/customer token + hostname tenant, with expiry**, then
run the confirm through `services.runIdempotent` (the `(tenant_id, idempotency_key)` mechanism,
`vs1.ts:5613`) on that server id — so a double-clicked confirm / retry / mock-callback replay collapses to
**one** paid order, one deduction, one charge, with sensitive fields redacted from the replayed response.

> This is the project's signature defect class on a customer surface. The design's load-bearing claim: the
> confirm write **invokes** the availability gate + valuation inside the canonically-ordered cell locks —
> proven by a test that drives the confirm endpoint and asserts (a) a concurrent POS-sale + checkout-confirm
> on one cell cannot both succeed past available stock, (b) opposite-order multi-cell confirms do not
> deadlock, and (c) the sale_line carries a COGS stamp (valuation was invoked).

---

## 7. Order schema + state machine (NEW; return-ready GAP-4; fulfilment GAP-3)

Reference shape = the verified `sale`/`sale_line`/`tender`/`invoice` schema (`sales.ts:33-237`).

**The order is the FULFILMENT/customer document; the `sale` is the FINANCIAL document (folded from the §8
GL-identity finding).** An online checkout that reaches `paid` persists a **real `sale` + `sale_line` +
`tender`** (the same financial truth POS writes) **and** an `order` + `order_line` that link to it. The GL
consumes the `sale`/`tender` ids it already requires (POST-1/POST-2), channel-agnostic; the order layer adds
fulfilment + customer + delivery on top. The valuation/COGS stamp lives on `sale_line` (§6 step 3), and
`order_line` references `sale_line_id`.

**`order` (NEW, tenant-owned, RLS, expand-only):** `id, tenant_id, sale_id (nullable until paid → the linked
financial document), location_id (fulfilment source), number, customer_id (nullable → guest), total_minor,
currency, scale, status, checkout_intent_id, created_at/by, …` plus:
- **Fulfilment (GAP-3):** `fulfilment_type text enum ["pickup","delivery"]`, `delivery_address_subject_id`
  (a **PII-vault subject reference, NOT raw address** — folded from the PII finding, §10/§12; geodata is a
  future seam), `fulfilment_location_id` (the stock-source location, from the sellable set —
  `pos.locationList` `vs1.ts:6027`), `fulfilment_status`.
- **Return-ready (GAP-4):** the same `originalSaleId`/`originalSaleLineId` self-link pattern `sale` already
  uses (`sales.ts` composite self-FK) so a `return`/refund branch is **additive** — no row-rewrite
  migration later. v1 writes only forward orders.

**`order_line` (NEW):** `order_id, sale_line_id (nullable until paid), product_id, sku_id, qty, …` — the
money/COGS/tax truth lives on the linked `sale_line` (`sales.ts:92-161`, with the
`cogsMinor/.../costingMethodApplied` stamps from §6 and `taxRateId/lineTaxMinor` now **populated**, §4); the
order_line is the customer-facing projection.

**State machine** (each transition idempotent + audited + event-emitting):
```
created → payment_pending → paid → fulfilling → fulfilled → completed
              ↘ payment_failed / expired → cancelled   [NO stock was deducted — deduction binds to `paid` (§6) → nothing to release]
              ↘ confirm-time out-of-stock → unavailable [generic; no sale/ledger row was written]
   [return-ready seam: fulfilled → return_requested → approved → restocked+refunded]  (DEFERRED past v1)
```
**Stock + sale + COGS are created ONLY at the `paid` transition (§6 invariant).** A `payment_pending` order
holds no stock, no sale row, no COGS — so `payment_failed`/`expired`/`cancelled` have nothing to reverse
(this is what dissolves the CRITICAL). If the `paid`-transition availability gate fails, the order goes
`unavailable`, no `sale`/ledger row exists, and the mock payment is voided (§9).

**Order numbering:** reuse the `allocateSaleNumber` pattern (`vs1.ts:4027-4036`) — advisory-locked
`docnum:${tenantId}`, count-based → `ORDER-{seq}`. (The `number_lease` tables exist for offline numbering
but are not wired to the MSP flow; orders are online-only, so the simple allocator suffices.)

---

## 8. Order → GL events (GAP-2 — money-quintuple, mirror POS)

A paid/fulfilled online order must emit the **same** financial events POS does, with the **same POST-1/POST-2
shape** (`event-map-phase4.md`, `posting-model.md`): every monetary quantity as the full quintuple
(`*Minor` + currency + scale + `*FunctionalMinor` + `fxRateToFunctional`), every journal dimension on the
event, COGS stamped at transaction time. Two implementation options:

- **(Chosen) Persist a REAL financial document and emit the existing POS events.** At the `paid` transition
  (§6) the checkout writes a real `sale` + `sale_line` + `tender` (the order links to them, §7) and emits
  `sale.created` + `payment.received` **carrying the real `saleId`/`saleLineId`/`tenderId`** the GL contract
  requires (`event-map-phase4.md:45-47,66-68`; POS emits real tender ids at `vs1.ts:4120-4150`), with an
  `order`/storefront channel marker. The Phase-5 GL consumes online and till **identically, with zero new
  consumer code** — folded from the §8 finding that a decomposition emitting `sale.created` without a
  persisted sale/tender identity could not post.
- **(Rejected for v1) New `order.*` events** — would require their own GL journal spec in
  `posting-model.md` + `event-map-phase4.md`. Unnecessary: an online order *is* a sale through the same
  ledger/valuation, so the real-sale-document approach reuses the locked POST-1/POST-2 contract verbatim.

This keeps §21 honest at the *accounting* layer: one shared ledger AND one shared financial-event contract;
the storefront is a channel on the same `sale`, not a parallel posting path.

---

## 9. Payment seam (decision #5 — mock/manual for the demo)

- **v1 = mock/manual confirmation** (charter §12 manual payment confirmation): order placement records
  `payment_pending` (no stock, no sale — §6); a manual/mock confirm runs the **atomic availability-gate +
  deduct + sale/COGS write** (§6) and emits `payment.received`. The full browse→cart→checkout→order flow is
  demonstrable with **no live PSP**, and stock binds to payment.
- **Server-minted, principal-bound checkout intent (folded from the §9 finding):** the idempotency identity
  is a high-entropy server-generated `checkout_intent_id` bound to the guest/customer token + hostname
  tenant, with expiry — never a client-supplied key (replay/leak/DoS-sensitive on a public surface).
  Confirm runs through `runIdempotent` on that id; replayed responses redact sensitive fields.
- **Design the provider seam now** (so a real PSP slots in without reshaping orders): a provider interface
  (charter §10/§23) with **signed, idempotent, out-of-order-tolerant inbound webhooks** keyed on
  `(tenant, provider_event_id)` — the **consumer-side idempotency** lesson (a redelivered webhook must not
  double-settle). The mock provider implements the same interface so the seam is exercised end-to-end.
- **Two idempotency boundaries:** (a) the confirm/deduct write keyed on the server `checkout_intent_id`
  (§6); (b) the PSP webhook keyed on `(tenant, provider_event_id)`.
- **Async-PSP compensating path (future, not v1).** With a real PSP, authorize→capture is asynchronous, so
  the deduct binds to the **capture** webhook. In the rare case capture succeeds but the atomic gate then
  finds stock gone (it was coarse-checked at placement, not locked), the order must **compensate**: an
  explicit restock movement (the existing `return`/restock valuation primitive, `vs1.ts:4435`
  `applyTransferInValuation`) + a refund + events. v1's synchronous mock avoids this entirely (gate + deduct
  + settle share one transaction), but the order schema + state machine are designed so the compensating
  branch is additive, not a rewrite.

---

## 10. Customer / guest identity (decision #4)

- **v1 = guest checkout + a minimal `customer` row** (NEW, tenant-owned, RLS). The `sale`/`order` already
  carry a nullable `customerId` (`sales.ts:48` / §7); v1 finally gives it somewhere to point. Do **NOT**
  pull the full Phase-7 CRM model forward.
- **Erasable PII goes through the vault, not raw columns (folded from the §7/§10 PII finding, charter §25).**
  Customer name/contact and the **delivery address** are erasable PII subject to right-to-erasure. They are
  stored in a **per-subject-key PII vault**; the operational `customer`/`order` rows reference a
  `pii_subject_id` (e.g. `delivery_address_subject_id`, §7), **never raw PII columns**. Erasure =
  crypto-shredding the subject key while the balanced operational/financial records (sale, ledger, GL)
  survive. This reuses the charter §25 model; it is not new policy, but it MUST be wired from line one rather
  than retrofitted (retrofitting PII out of operational columns is a painful migration).
- **Separate principal store** (§1.4): customer auth (if any) is its own identity space; it never becomes a
  Better Auth org member and never gains staff RBAC.

---

## 11. Operations dimension (keep OUT of commerce domain logic)

Genuinely operational/infrastructure services, isolated from commerce truth. **Tax is NOT here** (it is
domain logic — §4). **There is NO "inventory sync"** — §21 means one shared ledger; there is nothing to
sync between POS and storefront (listing it would contradict the architecture).

| Operational service | v1 treatment |
|---|---|
| Product images / CDN | reuse `product_image` (already owned, served); CDN/preconnect per UI guardrails |
| Emails / notifications (order confirmation) | a notification seam (charter §22) — mock/log in v1 |
| Webhooks (payment, future PSP) | the §9 signed/idempotent dispatcher seam (charter §23) |
| Analytics | event-fed projections later (charter §27) — not v1 |
| Search indexing | PostgreSQL FTS for v1 (charter §27 threshold), Typesense/Meili later |
| Shipping | pickup/delivery captured on the order (§7); carrier integration is post-v1 |

---

## 12. Schema additions (all expand-only + fail-closed RLS in the same commit)

Every new tenant-owned table gets ENABLE+FORCE+`tenant_isolation` in the same migration (the
`tenant-isolation-coverage` gate enforces this). All additions are expand-only (nullable columns / new
tables; no drops/retypes).

- `organization`: + `storefront_domain text UNIQUE` (nullable) — hostname resolution (§2).
- `product`/`category`: + `is_published boolean DEFAULT false` (§3); + `tax_rate_id`/`tax_class` ref (§4).
- **NEW tables:** `tax_rate` (§4), `cart` + `cart_line` (§5), `order` + `order_line` (§7, linking to a real
  `sale`/`sale_line` at `paid`, §8), `customer` (§10). Each tenant-owned, RLS-covered, money columns as
  `bigint(mode:number)` + currency + scale, composite `(tenant_id, id)` FK targets per the H1 discipline.
- **PII vault (charter §25, §10):** customer name/contact + delivery address live in the per-subject-key
  vault; `customer`/`order` reference `pii_subject_id` only — **no raw PII columns** on operational rows.
- **No new financial-event tables:** online checkout writes the existing `sale`/`sale_line`/`tender`
  (§8) — the order links to them; the GL contract is unchanged.

---

## 13. Build sequence (after this doc is approved)

1. Hostname→tenant resolver + `storefrontProcedure` + `storefront_domain` column + fail-closed GUC +
   rate-limit (§2, §1.5).
2. Public read models + `is_published` + allow-list DTOs + leak tests (§3).
3. Tax engine (`tax_rate` + product tax-class + `commerce.quote` with `mulDivRound`) + tax tests (§4).
4. Cart (§5) + customer/guest principal (§10, §1.4).
5. Checkout: the atomic availability gate + frozen `appendStockMovement` + `applyValuation` + idempotency
   + order/order_line + state machine + order numbering (§6, §7) — **prove the write path invokes the gate
   + valuation** (#8 test).
6. Order→GL events via sale.created/payment.received decomposition (§8).
7. Mock payment provider behind the real seam + idempotent confirm (§9).
8. Storefront UI assembled per the **Assembly Law** — Studio ecommerce blocks (product-list, product-overview,
   product-quick-view, category-filter, shopping-cart, checkout-page, order-summary, mega-footer) → owned,
   tokens-themed `packages/ui` components (compose `DataTableCard` where it fits); Magic UI for tasteful
   storefront motion only; never recreate a block; account for the `base-lyra` square-radius strip — only
   after the reads/writes are stable + approved (frontend-strategy.md).

Each step: build → adversarial gate → prove invariant-on-write-path (#8) → live-verify in a real browser.

---

## 14. Launch-blockers / open items (carry, do not fabricate)

- **GRA VAT specifics** (§4) — concrete standard rate + zero-rated/exempt category treatment must be
  confirmed against Guyana GRA before go-live; seeded as tenant config, not hardcoded (charter §17).
- **Custom-domain provisioning** (§2) — full white-label custom domains are Phase 11; v1 = subdomain +
  optional manual domain.
- **Hard-reservation mode** (decision #1) — schema is reservation-ready; the actual reservation/expiry
  engine is a post-v1 option if contention warrants.
- **POS canonical lock ordering** (ticket, from the §6 finding) — POS `createSale` locks cells per-line in
  input order (`vs1.ts:4107-4115`), a latent deadlock risk that Shopix's concurrent writes amplify. Apply
  the same aggregate-by-cell + sorted-acquire fix to the POS path (separate change, not Shopix-blocking).

---

> **Next action:** adversarial review of THIS design doc → fold CRITICAL/HIGH → owner approval → **then
> build** (no more planning docs). Accounting (Phase 5) stays planned-not-built behind Shopix.
