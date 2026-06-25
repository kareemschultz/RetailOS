# Phase 4 · Commit 3 — Returns / Refunds / Voids — Implementation Dependency Map

> **Purpose:** maximize reuse, build Returns *on top of* the MSP (Commit 2, merged `a02e60b`), not beside it.
> One-page work-planning aid — **not** new architecture (contracts are already locked in `event-map-phase4.md`).
> Scope: **Returns / Refunds / Voids** (Shift/cash, payments-maturity, commission, numbering-lease, offline
> queue, fiscal seam are LATER commits).
>
> **`pos.exchange` DEFERRED (owner decision, this session).** An exchange needs **net-difference settlement**
> (pay only the difference; an excess return credit becomes **store credit**, not cash) — which requires the
> stored-value / store-credit seam (a later commit). The exchange **contract** stays locked in
> `event-map-phase4.md` (decomposition = a linked `sale.refunded` + `sale.created` sharing one
> `exchangeGroupId`); only the **producer** is deferred. The `sale.exchange_group_id` column and the
> reserved-nullable `exchangeGroupId` event field remain in place for it.

## 1. APIs already available from Commit 2 (reused as-is, no change)

| API | Reused for |
|---|---|
| `pos.createSale` | The **outbound leg of an exchange** is literally a `createSale` (shares `exchangeGroupId`). Refund reuses its line/tender shaping. |
| `pos.productSearch` | Refund-by-search (find the original sale's items) and exchange-cart. |
| `reports.salesBasic` | Sales list/detail surfaces now show return/void status (status filter). |

## 2. New APIs required (this commit)

| API | Shape | Notes |
|---|---|---|
| `pos.refund` | `{ originalSaleId, idempotencyKey, lines:[{ originalSaleLineId, qty }], refundReason, tenders[] }` | First-class `saleType="return"`; **partial** (per-line qty ≤ original). Emits `sale.refunded`. |
| `pos.void` | `{ saleId, idempotencyKey, voidReason }` | Full reversal; emits `sale.voided` (parks on `originalSaleId`, **no amounts** by design). Distinct from refund. |
| `pos.exchange` | `{ originalSaleId, returnLines[], newLines[], tenders[], idempotencyKey }` | **DEFERRED to a later commit** (needs the stored-value seam for net settlement / excess store credit). Contract stays locked: decomposes into a linked `sale.refunded` + `sale.created` sharing one `exchangeGroupId` — NOT a new event; P5 needs no exchange-specific posting. |

## 3. Existing services reused (zero new low-level primitives)

| Service | Role in Returns |
|---|---|
| `services.appendStockMovement` | **Restock** = a `movementType:"return"` **positive** `qtyDelta` (the sole ledger mutator). |
| `services.applyValuation` | Called on the restock movement (#8 discipline — write path MUST invoke it). ⚠️ **Returns `cogsMinor:0` on a positive/restock movement** (COGS is computed on *issue*). |
| **`restockedValueMinor` derivation** | **Codex HIGH-4 (locked):** take it from the **original sale line's stamped `cogsMinor`+`cogsCurrency`+`cogsScale`+`costingMethodApplied`** (via `originalSaleLineId`), proportional to refunded qty — so the refund reverses **exactly** what the sale posted. NEVER from `applyValuation` on the restock leg. |
| `services.runIdempotent` | Refund/void/exchange are idempotent end-to-end (replayed offline refund collapses to one). |
| `services.emitEvent` | `sale.refunded` / `sale.voided` (+ `payment.received` for refund tenders). Server-stamped `occurredAt`. |
| `services.recordAudit` | `pos.refund` / `pos.void` / `pos.exchange` actions. |
| `allocateSaleNumber` (local helper) | Return/void docs get sequential numbers (credit-note is a fiscal **document type** layered later, not a new entity). |
| `assertSaleLocation` (INV-P4-7) | Refund/exchange location must be sellable. |
| `assertSkuBelongsToProduct` / composite-FK guards | H1 tuple discipline on every FK input (the original sale + its lines must be tenant-visible). |
| money primitives (`money`/`addMoney`/`multiplyMoney`) | Proportional refund amounts; `mulDivRound` for proportional splits (qty-fraction of original). |

## 4. Existing tests reused / extended (not rewritten)

| Test asset | Extension |
|---|---|
| `vs1.integration.test.ts` **#8 write-path gate** | Add: refund **restocks** the ledger (AVCO value rises / FIFO layer returns) and **stamps `restockedValueMinor` from the original line** — prove the router invokes valuation/derivation, not just the service. |
| `vs1.integration.test.ts` **H1 cross-tenant harness** (parameterized `cases[]`) | Add a row: `pos.refund` with a cross-tenant `originalSaleId` / `originalSaleLineId` rejects. |
| Tender-settlement tests | Refund-tender path (cash-out refund) reuses the `settleTenders` invariants. |
| `tenant.rls.test.ts` | No new tenant table expected (returns reuse `sale`/`sale_line`/`tender`); if a `credit_note`/movement-link table is added, append it to `TENANT_TABLES`. |

## 5. Schema reuse (expand-only; mostly already reserved by Commit 2)

Already present from MSP — **no new columns likely needed** for the core return:
- `sale.saleType` (`sale`|`return`|`exchange`, CHECK) · `sale.originalSaleId` · `sale.status` (add `"void"` value via the existing `status` text col).
- `sale_line` carries the COGS stamp (`cogsMinor`/`cogsCurrency`/`cogsScale`/`costingMethodApplied`) — the restock-value basis.
- **New seam (if needed):** `sale_line.originalSaleLineId` (the per-line link the refund derives restock/commission from) and `sale.exchangeGroupId` — both **nullable, expand-only**. Add `SaleRefunded`/`SaleVoided` to `DomainEventType`.

## 6. Frontend surfaces that extend naturally (for the future UI session)

Built on Commit-2 surfaces, no new backend phase needed:
- **Sale detail → "Refund" / "Void"** action (sales list/detail already unlocked).
- **Refund dialog** — reuses the cart/line components, capped at original qty.
- **Credit-note / return receipt preview** — reuses the receipt/invoice preview surface.
- *(Exchange flow — return-cart + new-cart side by side — comes with the deferred `pos.exchange` commit.)*

## 7. Out of scope (explicitly deferred — do NOT pull forward)

**`pos.exchange`** (net-difference settlement + excess-credit-as-store-credit) — deferred to a later commit with the stored-value seam; contract stays locked, column/event field reserved. Commission clawback **fields** ride the events (reserved-nullable, derived from the original line's stamp) but the **commission engine** is a later commit; functional-currency twins stay reserved-null (single-currency MSP); stored-value issue/redeem is its own commit; fiscal credit-note numbering is the fiscal seam.
