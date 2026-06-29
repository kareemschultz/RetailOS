# Commerce Experience (Shopix) — Capability Map

> **Status:** PLANNING ARTIFACT ONLY. No code. No governance rewrite. No architecture refactor.
> This is a build checklist that answers "what can Shopix reuse, what public read models are missing,
> and which customer-facing workflows need new backend" — produced *before* any storefront component is
> written, the same plan-first discipline used for every other phase.
>
> **Mental-model lens (not new architecture):** RetailOS is one shared domain backend serving multiple
> **experiences** — Admin, POS, **Commerce (Shopix)**, Mobile, API, (future) Marketplace. Every experience
> *consumes existing backend capability*; none duplicates inventory / products / pricing / customers /
> accounting / receipts / numbering (charter §21: "Ecommerce uses the same inventory database and stock
> ledger as POS. Never create separate ecommerce inventory."). New experiences add **read models** and
> **experience-specific workflows**, never a second commerce system.
>
> **Next step after this map:** adversarial review → fold CRITICAL/HIGH → owner review → **STOP. Do not
> build Shopix yet.**

All facts below are grounded in the live codebase (endpoint names + `file:line` verified 2026-06-29), not
assumed. Where a capability is missing, it is labelled **NEW**.

> **Adversarial review (2026-06-29):** a fresh review verified all 5 factual claims against the live codebase
> (no public catalog/hostname path; operationally-gated reads; no customer/cart/order/pricing-engine tables;
> `createSale` idempotency + #8 valuation; `stockByLocation` cost-leak) — **all PASS**. It found 6 gaps
> (4 HIGH, 1 MED, 1 LOW), all **folded** into this map and tagged `GAP-1..6`: (1) `pos.quote` is staff-gated,
> shift-aware, and returns **zero tax** → need a public `commerce.quote` with real tax; (2) online order→GL
> events aren't mapped (POST-1 money-quintuple); (3) fulfilment pickup-vs-delivery underspecified;
> (4) online returns/refunds absent; (5) storefront customer principal must not bleed into staff auth;
> (6) concrete rate-limit budgets.

---

## 0. The three layers (keep these separate)

Every row in this map belongs to exactly one layer. Conflating them is how storefronts accrete commerce
logic into presentation code.

| Layer | What it is | Authority | Audience |
|---|---|---|---|
| **A — Backend domain logic** | Stock ledger, valuation, pricing, orders, payments, idempotency, events | The RetailOS server (single source of truth) | Internal |
| **B — Public read models** | Anonymous, hostname-tenant-scoped, internal-scrubbed projections of A | The server, exposed via **new `publicProcedure` endpoints** | Anyone on the internet |
| **C — Presentation / CMS** | Homepage, hero, collections, nav, footer, SEO, promo banners, landing pages | Content config + Studio/Magic UI blocks | Anyone on the internet |

The honest weight distribution (correcting "the storefront is mostly done"): **Layer A's read paths already
exist** and are the light part. **Layer B is a new security boundary** (it does not exist today). The
**customer-facing *write* workflows in Layer A (cart reservation, checkout, order) are the real weight and
the real risk** — they are exactly the project's recurring defect class (a guarantee that holds in
isolation but the integration path routes around it) on a surface where the failure mode is *overselling a
real customer*. Layer C is content work, lighter than A-writes but non-trivial.

---

## 1. Existing backend capabilities Shopix can consume UNCHANGED

These exist and work today. **Critical caveat:** every one is a `tenantProcedure` — authenticated +
active-organization + gated on an **operational** permission. So they are consumable **unchanged only by an
authenticated back-office experience (CommerceO)**, *not* by an anonymous storefront. For the public
storefront they are the **data source behind** the Layer-B public read models (§2), not directly callable.

| Capability | Endpoint | `file:line` | Gate (permission) | Returns (display fields) |
|---|---|---|---|---|
| Product catalog | `product.catalog` | `vs1.ts:329` | `products.create` | id, sku, name, trackingMode, priceMinor, currency, scale, primaryImageUrl?, primaryImageAltText? |
| Product detail + images | `product.detail` | `vs1.ts:389` | `products.create` | full product + `images:[{id,url,altText,isPrimary,sortOrder}]` |
| Sale-line-ready search | `pos.itemSearch` | `vs1.ts:5931` | `pos.create_sale` | productId, skuId, priceMinor, currency, scale, displayName, sellable, trackingMode, matchedBarcode? |
| Categories | `catalog.categoryList` | `vs1.ts:928` | `products.create` | id, name, code?, createdAt |
| Brands | `catalog.brandList` | `vs1.ts:1047` | `products.create` | id, name, code? |
| SKU catalog (named) | `catalog.skuCatalogList` | `vs1.ts:1481` | `products.create` | productName, productSku, code, name, baseUomCode, trackingMode |
| Barcodes | `catalog.barcodeCatalogList` | `vs1.ts:1690` | `products.create` | value, symbology, isPrimary + sku/product names |
| **Stock availability** | `inventory.stockByLocation` | `vs1.ts:3436` | `reports.view` | skuId, qtyOnHand, locationId, locationName (AVCO ∪ FIFO) — **contains `totalValueMinor` (cost) — MUST be scrubbed for public** |
| Cart-total preview (read-only) | `pos.quote` | `vs1.ts:6062` | `pos.create_sale` | line totals + payment summary — reuses the exact `priceMspLines`+`settleTenders` as `createSale`. **⚠ NOT directly usable for a public cart:** it is staff-gated, **shift-aware**, and **returns ZERO tax today** (MSP path, `vs1.ts:3879/3913`). A public cart needs a NEW `commerce.quote` (see §2 / GAP-1). |
| Sellable locations | `pos.locationList` | `vs1.ts:6027` | `pos.create_sale` | sellable locations only (excludes archived / bonded / transit) |
| Receipt model | `pos.receipt` | `vs1.ts:6102` | `pos.create_sale` | display-safe receipt (no COGS/margin) |

**Reference write path** (the template a customer checkout will mirror, *not reuse as-is* — it's gated on
`pos.create_sale`, a cashier permission):

- `pos.createSale` (`vs1.ts:5574` → `runCreateSaleMsp` `vs1.ts:4038`): idempotent via
  `services.runIdempotent(tx, ctx, idempotencyKey, …)` keyed on `(tenant_id, idempotency_key)`; prices via
  `priceMspLines`; settles tenders via `settleTenders`; per line calls `appendStockMovement(qtyDelta:-qty)`
  **then `applyValuation` unconditionally** (#8 closed — COGS stamped on the line); emits `sale.created` +
  `payment.received`; flags `inventory.stock_discrepancy` if balance goes negative.
- `pos.refund` (`vs1.ts:5626`) / `pos.void` (`vs1.ts:5656`): locked-row, value-conserving reversals.

**RLS:** `product`, `sku`, `category`, `brand`, `location`, `avg_cost`, `valuation_layer` are all
tenant-owned with ENABLE+FORCE+`tenant_isolation` policy (fail-closed; verified by
`tenant-isolation-coverage.test.ts`). A read with no `app.tenant_id` GUC returns zero rows.

---

## 2. Public read models still REQUIRED (Layer B — NEW, all of it)

None of these exist today. **There is no public/unauthenticated catalog read** — `product.catalog` is gated
on `products.create`. The two only `publicProcedure`s are `healthCheck` and `privateData`. Building Layer B
is a **new security boundary**, not a projection chore.

| Public read model | Projects from | NEW work | Must NEVER expose |
|---|---|---|---|
| Public catalog list | `product.catalog` | `publicCatalogList` `publicProcedure`; tenant resolved by **hostname** (§4), not session; only `is_active` + storefront-published products | cost, margin, `totalValueMinor`, other tenants' rows, internal flags |
| Public category / collection | `catalog.categoryList` | `publicCategoryList`; published categories only | internal `costingMethod`/`trackingMode` |
| Public product detail (PDP) | `product.detail` | `publicProductDetail` by **slug** (not internal uuid); images + description + price | supplier, cost, ledger, internal ids where avoidable |
| Public availability | `inventory.stockByLocation` | `publicAvailability`; **return a coarse signal** (in-stock / low / out), **NOT `qtyOnHand` or `totalValueMinor`** — exposing exact stock + value is a competitive/security leak | exact qty, cost, value, per-location internals |
| Public price | `product.priceMinor` | folded into catalog/PDP; per-product base price only (no price-list/promo engine yet — §5) | — |
| **Public cart quote** (GAP-1) | `priceMspLines` + tax engine | **`commerce.quote` `publicProcedure`** — hostname tenant context, **no shift requirement**, and **real tax computation** (the storefront tax/jurisdiction policy, since `pos.quote` returns zero tax today). Must reuse the same line-pricing math as `createSale` to avoid drift, but add the tax limb the MSP quote lacks. | cost, margin, internal tender plumbing |

**Layer-B DTO discipline is *stricter* than the authenticated reads.** The audience is "anyone on the
internet," not "an authenticated cashier." Each public DTO is an explicit allow-list of fields, asserted by
a test that the response contains no `cost`/`margin`/`value`/`totalValue`/internal-id keys (the project's
existing DTO-leak test pattern, tightened). This is the same `objectKey`-leak / cost-leak class that the
adversarial gate has already caught twice on authenticated endpoints — on a public surface it is a CRITICAL.

---

## 3. Customer-facing backend WORKFLOWS still required (Layer A — NEW, the real weight)

This is where the work and the risk concentrate. Each item is new backend domain logic, gated by a phase
decision, and must be designed + adversarially reviewed before code.

| Workflow | Depends on | NEW backend | Risk class |
|---|---|---|---|
| **Customer identity** | Phase 7 CRM (`customer` table does **not exist** today) | `customer` master + guest-checkout identity; a `sale` already carries optional `customerId` but there is nowhere to store one | Identity/PII; gates everything customer-scoped |
| **Cart** | reservation strategy (§5) | `cart` + `cart_line` tables; price snapshot vs live-price decision | Stale-price / lost-cart |
| **Reservation / hold** | shared ledger (§5) | a reservation seam so a cart can hold stock against the **one** ledger | **§21 oversell — signature defect class** |
| **Checkout (write)** | reservation + payment | a customer-facing write that mirrors `createSale` but is **idempotent per cart/order**, not per cashier action | Double-submit → double-charge/deduct |
| **Payment** | provider seam (charter §10/§23) | online payment (callback/webhook, idempotent, signed) — distinct from POS tender capture | Double-charge, webhook replay |
| **Order lifecycle** | checkout | `order` state machine (§7) | Stuck/duplicated orders |
| **Order → GL events** (GAP-2) | order lifecycle + Phase-5 GL | online order paid/fulfilled must emit the **same money-quintuple events** POS does (POST-1/POST-2: `*Minor`+currency+scale+`*FunctionalMinor`+`fxRateToFunctional`, COGS stamped) — **`cross-phase-dependencies.md` + `posting-model.md` currently name only the reservations seam for ecommerce, not order events** | Unbalanced/duplicated GL postings |
| **Fulfilment** (GAP-3) | order | **pickup vs delivery** distinction, delivery address, fulfilment-location selection + stock-source rules — *not* just "resolve a location" | Wrong stock source / undeliverable orders |
| **Online returns / refunds** (GAP-4) | order + payment | customer-initiated return → approval → restock → payment reversal; POS refunds are staff-gated workflows and GL refund postings are first-class in `posting-model.md` — the online path is **distinct** | Unhandled returns; GL refund gap |
| **Order tracking** | order | customer-scoped read of own orders | Cross-customer leak |

---

## 4. Public security boundary analysis (the part most underestimated)

Every read in RetailOS today sits behind an authenticated, tenant-scoped, RLS-gated session. A public
storefront is reachable **without any login**. That is a boundary that **does not exist yet**.

1. **Tenant resolution without a session.** Charter §11 requires the router to resolve `tenant_id` from
   **hostname** (e.g. `acme.retailos.com` / a custom domain → tenant). **This is not implemented today**
   (the Explore confirmed `tenantId = session.activeOrganizationId`, no hostname logic in `apps/server`).
   A storefront request has no session, so it needs a **hostname → tenant_id resolver** that sets the
   `app.tenant_id` GUC for RLS *before* any public read. This is the gateway for the entire experience and
   is also the Phase-11 white-label seam — design it once, here.
2. **What must NEVER be public.** Cost, margin, `totalValueMinor`, valuation layers, other tenants' data,
   internal flags/ids, supplier data, exact on-hand quantities. The public availability signal is coarse
   (§2). Enforced by allow-list DTOs + leak tests.
3. **Abuse surface.** Public endpoints need rate-limiting (charter §8 noisy-neighbor / token-bucket per
   tenant), bot/scrape protection, and no enumeration of internal uuids (use slugs).
4. **The GUC must be set fail-closed for public reads too.** If hostname resolution fails → no tenant → zero
   rows, never a cross-tenant spill. Same fail-closed posture as the authenticated path.
5. **Storefront customer is a SEPARATE principal from internal org-members (GAP-5).** Today the only
   authenticated principal is a Better Auth **org member** (staff), and `tenantId = session.activeOrganizationId`.
   A storefront customer/guest must be a **distinct principal model** that resolves a `customer` identity
   (or guest) under the hostname-resolved tenant — it must **never** bleed into the internal tenant-member
   auth path (a customer must not gain a staff role/permission, and a staff session must not be required to
   shop). Design this boundary explicitly when customer identity (§3) lands.
6. **Concrete abuse budgets (GAP-6).** Rate-limit keyed per-hostname (tenant) AND per-IP on public reads
   and especially the checkout write; scrape-control on catalog enumeration; slug-only (no internal uuid
   enumeration). Set real token-bucket numbers in the boundary design (charter §8 per-tenant token-bucket).

> This section is **not** a formatting task. It is the single largest new design surface in Shopix.

---

## 5. Shared inventory / reservation strategy (§21 — signature risk)

The storefront sells the **same stock the till sells** (one ledger, charter §21). The hard question:
**when a customer has items in a cart or checks out online, what stops them buying stock the POS just sold?**

- **Today there is no reservation seam.** `appendStockMovement` deducts at *sale*, not at *cart*. The
  `cross-phase-dependencies.md` map already reserves a "reservations seam (cart hold)" as a future seam —
  it lands here or in Phase 4.
- **Oversell policy is a per-tenant charter §14 decision** (allow-with-backorder / hard-reservation /
  optimistic-with-correction). The same policy already governs offline POS. Shopix must resolve through the
  **same** policy, not invent its own — otherwise online and till disagree.
- **The reservation must go through the one ledger / valuation stack** (`appendStockMovement` +
  `applyValuation`), never a parallel ecommerce counter. A web order at fulfilment emits the **same**
  valuation events POS emits, so the Phase-5 GL consumes both identically (POST-1/POST-2 invariants).
- **This is the #8 / "write path routes around the invariant" class on a customer surface.** The design
  must prove the checkout write *invokes* the reservation + valuation, not merely that a reservation service
  exists. Failure mode = overselling a paying customer.

**Open decision (for owner):** which §14 oversell policy is the Shopix default, and does cart hold stock
(hard reservation) or only validate at checkout (optimistic)? This is the load-bearing decision of the
whole experience.

---

## 6. Checkout idempotency strategy

`createSale` is already idempotent per `(tenant_id, idempotency_key)` via `runIdempotent`. The customer
checkout reuses that **mechanism**, with a different **key source**:

- **Key = the cart/order, not a cashier action.** A double-clicked "Place order", a network retry, or a
  payment-callback replay must collapse to **one** order, one stock deduction, one charge.
- **Two idempotency boundaries, not one** (the consumer-side lesson, crossing a process boundary):
  1. `client checkout → order write` keyed on the cart/order id.
  2. `payment provider webhook → order settle` keyed on `(tenant, provider_event_id)` — the inbound webhook
     must verify signature + dedupe + tolerate out-of-order/duplicate delivery (charter §23).
- A payment that succeeds but whose order write fails (and vice-versa) needs a reconciliation path — design
  the order state machine (§7) to make every transition idempotent and replayable.

---

## 7. Order lifecycle

NEW (`order` table does not exist). Minimum viable state machine for a demo + correctness:

```
created → (reserved) → payment_pending → paid → fulfilling → fulfilled → completed
                           ↘ payment_failed → cancelled (release reservation)
                  cancelled / expired (release reservation, restock if deducted)
```

- Each transition idempotent + audited + event-emitting (mirrors POS: an order at `paid`/`fulfilled` emits
  the **same money-quintuple revenue/COGS/tax events** POS does — POST-1/POST-2 — for the Phase-5 GL
  (GAP-2). These ecommerce/order events must be **added to `cross-phase-dependencies.md` + `posting-model.md`**
  (which today name only the reservations seam for ecommerce), or online checkout must be explicitly
  decomposed into the existing `sale.created`/`payment.received` events with identical field shape.
- Reservation released on `cancelled`/`expired`; stock deducted at the policy-decided point (§5).
- **Fulfilment (GAP-3):** capture **pickup vs delivery**, a delivery address (delivery geodata is a future
  seam), the **fulfilment location** (from `pos.locationList` sellable set, charter §21), and the
  **stock-source rule** (which location's ledger the reservation/deduction hits). "Resolve a location" is
  not enough.
- **Online return/refund (GAP-4):** a customer-initiated branch (`fulfilled → return_requested → approved
  → restocked + refunded`) distinct from the staff-gated POS refund; emits the first-class GL refund
  postings (`posting-model.md`). Decide its lifecycle before the order/checkout schema freezes, or defer it
  with an explicit cost-of-change acknowledgement (§9).

---

## 8. UX / CMS layer (Layer C — presentation, keep OUT of commerce logic)

Storefronts are not just backend + checkout; they are content. This layer is **presentation/content**, must
not carry commerce truth, and is sourced per the **Assembly Law** (frontend-strategy.md): import a Studio
block → normalize → adapt to RetailOS tokens → own it in `packages/ui` → wire to oRPC. Never recreate a
block; account for the `base-lyra` square-radius strip.

| Surface | Source (per `ui-source-registry.md`) | Notes |
|---|---|---|
| Homepage composition | CommerceO + Studio | content-config driven, not hardcoded |
| Hero / featured products | Magic UI (motion ok on storefront) + Studio | featured = a curated read model over published products |
| Collections / category browse | Studio `product-list`, `category-filter` | reads Layer-B public category/catalog |
| Product list / grid | Studio `product-list`, `product-overview`, `product-quick-view` | reads Layer-B public catalog |
| PDP | Studio `product-overview` + custom availability badge | reads Layer-B public PDP + coarse availability |
| Cart | Studio `shopping-cart` | reads Layer-B; totals via a public quote projection |
| Checkout | Studio `checkout-page`, `order-summary` | the Layer-A checkout write (§3, §6) |
| Reviews | Studio `product-reviews` | **defer past v1** (needs review backend) |
| Nav / mega-footer | Studio `mega-footer` | content-config |
| Promo banners / announcements | Magic UI `marquee` + content-config | **no pricing/promo engine yet (§5)** — banners are content, not priced promotions |
| SEO / metadata | TanStack head + per-product metadata | slugs, not uuids |
| Landing pages | Magic UI Pro marketing sections | marketing, fully motion-allowed |

CMS-driven content (homepage layout, hero copy, collection curation, banners) is **configuration over the
shared backend**, consistent with `vertical-presets.md` (platform-not-product: a channel + settings, never
a fork).

---

## 9. Recommended v1 demo scope (surfaces the hard parts honestly)

For the client demo, scope v1 to prove the platform thesis without building a full commerce suite:

**IN v1:** hostname→tenant public resolver (§4) · public catalog + PDP + coarse availability (Layer B) ·
**public `commerce.quote` with real tax** (GAP-1) · browsable storefront (Layer C: home/collections/PDP/cart) ·
a **real checkout that writes an order against the one shared ledger** with reservation + idempotency
(§5, §6, §7) · guest checkout identity (separate principal, GAP-5) · **pickup-or-delivery fulfilment with
stock-source** (GAP-3) · **order → GL events** matching POS (GAP-2).

**DEFER past v1 (with explicit cost-of-change acknowledgement):** wishlist · reviews ·
promotions/price-lists/customer-group pricing · loyalty · custom domains (Phase 11) · full CRM customer
accounts (Phase 7 — v1 uses guest + minimal customer row) · **online returns/refunds** (GAP-4 — design the
order schema so the return branch can be added without a migration that rewrites order rows; if returns are
needed for the demo, pull GAP-4 into v1).

Rationale: catalog+cart+real-checkout is a strong demo *and* it forces the two genuinely hard parts (public
boundary §4 + shared-inventory checkout §5) into the open, instead of a skin that hides them.

---

## 10. Build sequence (when approved — NOT now)

1. **Hostname → tenant resolver** + public-procedure scaffold + fail-closed GUC + rate-limit (§4). *Gate
   for everything.*
2. **Layer-B public read models** + allow-list DTOs + leak tests (§2).
3. **Reservation seam** through the one ledger, per the §14 policy decision (§5).
4. **Customer/guest identity + cart** (§3) — minimal customer row; full CRM is Phase 7.
5. **Checkout write** (idempotent, mirrors `createSale`, invokes reservation+valuation) + **order lifecycle**
   (§6, §7).
6. **Online payment** seam + idempotent webhook (§6, charter §23).
7. **Layer-C storefront** assembled from Studio ecommerce blocks (§8) — *only after the reads/writes are
   stable + approved* (frontend-strategy.md: "No production UI until APIs stable + approved").

Each step: design → adversarial gate → owner review → build → prove the write path invokes the invariant
(#8 discipline) → live-verify in a real browser.

---

## Open decisions for owner (this map's output)

1. **Oversell / reservation policy (§5)** — which charter §14 policy is the Shopix default, and does cart
   hold stock or only validate at checkout? *(Load-bearing.)*
2. **Public availability granularity (§2/§4)** — coarse signal (in-stock/low/out) confirmed, or expose
   exact qty? *(Recommend coarse — exact qty is a competitive/security leak.)*
3. **v1 scope (§9)** — confirm catalog+cart+real-checkout; defer wishlist/reviews/promotions/custom-domains.
4. **Customer identity for v1 (§3)** — guest-only + minimal customer row now (full Phase-7 CRM later), or
   pull Phase-7 customer master forward first?
5. **Payment provider for the demo (§6)** — which provider seam (Stripe/Paddle/…); or a mock/manual
   confirmation flow for the demo (charter §12 manual payment confirmation) so checkout is demonstrable
   without a live PSP.
6. **Online returns/refunds (§3/§9, GAP-4)** — in v1, or deferred (with the order schema designed so the
   return branch is additive)? *(Recommend: design schema return-ready, defer the UI/flow past v1 unless
   the demo needs it.)*
7. **Public cart tax (§2, GAP-1)** — confirm the public `commerce.quote` computes tax via the tenant's
   storefront tax/jurisdiction policy (the MSP `pos.quote` returns zero tax). *(Tax cannot be a TODO on a
   real checkout — a customer-facing total must be correct.)*

> After adversarial review of THIS map and your answers to the above, the next artifact is a Shopix design
> doc (reservation seam + public boundary + order state machine) — still **planned, not built**. Accounting
> (Phase 5) remains planned-not-built and follows; it is foundational but invisible until operating, whereas
> the storefront is the demo.
