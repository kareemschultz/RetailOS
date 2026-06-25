# Phase 4 · Commit 4 — Configurable Cash Control — Implementation Dependency Map

> **Purpose:** the generic retail **cash-control spine** — Shift · Cash Drawer · Blind Close · Over/Short · X/Z — built **configurable** (default broadest, specialize through config, never through architecture forks; `engineering-principles.md` Group F). One-page locked-design artifact; the `shift.opened`/`shift.closed` event contracts are already gate-hardened in `event-map-phase4.md` and the postings are enumerated in `posting-model.md` §7/§8.
>
> **Platform-first (owner directive 2026-06-24):** this is the **generic retail core**, not a per-vertical build. Every capability ships with a **toggle resolved through the settings resolver** so a single-store owner-operator can simplify/disable what a multi-register chain enables — **same code, different config.** No `RestaurantEdition`/`PharmacyEdition`; vertical packs layer on later.

## 1. Config toggles (the platform seam — resolved via the existing settings resolver)

New **operational** settings keys (`text({ enum })` + CHECK; resolved per tenant/company/location; defaults = broadest common denominator):

| Key | Values | Default | Effect |
|---|---|---|---|
| `shift_enforcement` | `required` · `optional` · `disabled` | **`optional`** | `required` → a sale needs an open shift; `optional` → sale attaches to the open shift if one exists, else `shiftId=null` (MSP already allows null); `disabled` → shifts off entirely. |
| `blind_close` | `on` · `off` | **`on`** | `on` → cashier never sees `expectedCash` before counting (shrinkage control); `off` → "simple close" (UI may reveal expected). Backend computes + stores both either way. |
| `cash_drawer` | `on` · `off` | **`on`** | `off` → non-cash business; cash-movement/float endpoints disabled, no drawer reconciliation. |

> Defaults are owner-delegated "sensible defaults" (broadest applicability), confirmable at PR review — NOT a guessed business rule. The resolver is the single owner of this behavior (no business-type branch in code).

## 2. New APIs (this commit)

| API | Shape | Notes |
|---|---|---|
| `pos.openShift` | `{ terminalId, locationId, idempotencyKey, openingFloat:[{ currency, scale, amountMinor }] }` | One **open** shift per terminal (advisory lock + guard). Emits `shift.opened`. Rejected when `shift_enforcement=disabled`. |
| `pos.cashMovement` | `{ shiftId, idempotencyKey, type, currency, scale, amountMinor, reason? }` | `type ∈ {pay_in, pay_out, drop}`. Gated by `cash_drawer=on`. Audited. |
| `pos.closeShift` | `{ shiftId, idempotencyKey, countedCash:[{ currency, scale, amountMinor }] }` | **BLIND close:** system computes `expectedCash` + `overShort` (cashier submits only `counted`). Allocates `zReportId` (Z number). Emits `shift.closed`. |
| `pos.xReport` | `{ shiftId }` | Read-only mid-shift snapshot (running expected/sales/movements). Does NOT close. |
| `pos.zReport` | `{ shiftId }` | Read-only final settlement of a **closed** shift (the `shift.closed` data). |

## 3. The load-bearing computation — expected cash & over/short (per currency)

> `expectedCash[c] = Σ openingFloat[c] + Σ cashTendersSettled[c] (sales where sale.shift_id = this shift, tender.method='cash') + Σ pay_in[c] − Σ pay_out[c] − Σ drop[c]`
> `overShort[c] = countedCash[c] − expectedCash[c]`

Per-currency (split drawers, §12). `overShort` drives the shrinkage posting (`posting-model.md` §8) + the manager audit signal (§19/§22). **Blind:** `closeShift` accepts only `countedCash`; `expectedCash`/`overShort` are **system-computed and stamped** — the cashier never supplies or sees expected (the irreproducible-fact discipline applies to the FX twin per row).

## 4. Existing services reused (compose, not duplicate)

| Service | Role |
|---|---|
| `services.runIdempotent` | open/close/cashMovement idempotent end-to-end. |
| `services.emitEvent` | `shift.opened` / `shift.closed` (contracts locked; add to `DomainEventType`). |
| `services.recordAudit` | every open/close/movement + the over/short on close. |
| `settings-resolver` (`resolveSetting`) | the three toggles — the ONE owner of configurable behavior (no business-type branch). |
| money primitives (`money`/`addMoney`) + `mulDivRound` | per-currency sums; FX functional twins reserved-null (single-currency default). |
| `allocateSaleNumber` pattern | `zReportId` / Z-number via the same per-tenant advisory-lock gapless allocator. |
| `assertPermission` | `pos.open_shift` · `pos.cash_movement` · `pos.close_shift` (add to `entitlements.ts`). |
| `loadSaleForUpdate` pattern → `loadShiftForUpdate` | **`SELECT … FOR UPDATE` on the shift row** before the status guard — close is a status-machine (the Commit-3 HIGH-1 race lesson); concurrent closes serialize. |
| `assertSaleLocation` / composite-FK guards | shift location tenant-visible; H1 tuple discipline. |

## 5. Schema (new tenant tables — expand-only, fail-closed RLS in the same migration)

- **`shift`** — `id, tenant_id, terminal_id, location_id, company_id, cashier_user_id, status text enum[open,closed], opened_at, closed_at, opened_by, closed_by, z_report_number`. `unique(tenant_id,id)` (child-FK target, H1). Composite FK `(tenant_id, company_id, location_id) → location` (intra-company, Phase-3 pattern). **Partial unique index** `(tenant_id, terminal_id) WHERE status='open'` → one open shift per terminal.
- **`cash_movement`** — `id, tenant_id, shift_id, type text enum[open_float,pay_in,pay_out,drop,close_count], currency, scale, amount_minor bigint, reason, created_by/at`. Composite FK `(tenant_id, shift_id) → shift(tenant_id,id)`. `amount_minor >= 0` CHECK.
- **Wire** `sale.shift_id` (already reserved, nullable): `createSale` resolves the open shift for the terminal when `shift_enforcement ∈ {required, optional}`; rejects with no open shift when `required`.
- Both new tables → **hand-add the `ENABLE+FORCE+tenant_isolation` RLS DO-block** to the migration (drizzle-kit doesn't emit RLS) + add to `TENANT_TABLES` in `tenant.rls.test.ts` (coverage gate).

## 6. Events & posting (already contracted — emit to spec)

- `shift.opened` / `shift.closed` payloads = **exactly** `event-map-phase4.md` (per-row functional twins reserved-null; `expectedCash`/`overShort` system-computed; `cashMovements[]`). Add `ShiftOpened`/`ShiftClosed` to `DomainEventType`.
- Postings (P5 consumer): `posting-model.md` §7 (drawer float — vault→drawer, no P&L) + §8 (blind close — counted→vault, drawer cleared, `overShort`→shrinkage). Commit 4 only **emits**; P5 posts.

## 7. Tests (real-PG)

Shift open (one-open-per-terminal rejection) · cash movements adjust expected · **blind close computes over/short exactly** (counted − expected per currency, incl. a cash sale + a pay-out) · sale attaches to open shift · **toggle: `shift_enforcement=disabled` → sale works with `shiftId=null`; `required` → sale with no open shift rejected** · **close race** (`FOR UPDATE`, `Promise.allSettled([close,close])` → one wins) · H1 cross-tenant shift reject · RLS coverage for `shift`+`cash_movement`.

## 8. Frontend surfaces unlocked

Open-shift dialog (float entry) · persistent shift-status indicator · cash-in/out/drop dialog · **blind-close screen** (count entry, expected hidden when `blind_close=on`) · over/short manager review · X-report snapshot · Z-report. *(All configurable: hidden/simplified when the toggles disable them.)*

## 9. Out of scope (deferred — do NOT pull forward)

Elaborate X/Z report **read-models / analytics** (Phase 12; Commit 4 ships the basic read endpoints only) · the GL **posting engine** (Phase 5 consumes the events) · time-clock / fast-cashier PIN switching (§19, later) · multi-currency FX **revaluation** (functional twins stay reserved-null; single-currency default) · any **per-vertical** behavior (restaurant tables, pharmacy FEFO close) — those are vertical packs layered later, never a fork.
