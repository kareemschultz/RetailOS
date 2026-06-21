# RetailOS — Gaps & Custom Components

> Components **no configured registry covers** (shadcn core, shadcn studio Pro, Magic UI, ReUI). These are
> RetailOS domain primitives to **build custom in `packages/ui`**, composed on the owned shadcn/Base-UI
> foundation and re-themed to RetailOS design tokens.
>
> **Verdict basis:** charter §5 (`docs/architecture/retailos-master-charter.md`) does **not yet exist**, so the
> surface/motion guidance below uses the Phase-0 rules (speed & density on POS / warehouse / data-entry;
> functional micro-motion only on those surfaces). Re-validate once §5 lands.
>
> **Build rule:** compose from owned primitives — never re-import a foreign component's hardcoded colors/radii/
> fonts. Where a library item is the closest starting point, copy its *structure*, then re-token.

## Why these are gaps

The registries are strong on generic SaaS/marketing/dashboard/ecommerce UI, but RetailOS spans **POS,
warehouse, accounting, fiscal compliance, and multi-currency retail operations** — domains with hardware,
regulatory, and density requirements that off-the-shelf blocks don't model. Each item below is a thin custom
layer over existing primitives, not a from-scratch widget.

## Custom component register

| # | Component | Surface(s) | Compose from (owned primitives) | Closest library starting point | Build notes |
|---|---|---|---|---|---|
| 1 | **Offline-status indicator** | POS, warehouse/mobile | `badge` + `sonner` + `tooltip`; `use-mobile`; a sync-queue store | shadcn `badge`/`sonner` (none model offline state) | Online/Offline/Syncing states; queued-mutation count; reconnect toast. Must be glanceable & always-visible on POS. Functional motion only (pulse while syncing). |
| 2 | **Fiscal / thermal receipt preview** | POS, accounting | `card` + `separator` + `scroll-area`; monospace token; `aspect-ratio` for 58/80mm | shadcn studio `@ss-blocks` order-summary; ReUI none | Renders the exact 58mm/80mm thermal layout incl. tax lines, fiscal signature/QR, reprint watermark. Print-CSS + ESC/POS mapping. No animation. |
| 3 | **Cash-drawer & shift panel** | POS | `dialog`/`sheet` + `field`/`form` + `table` + `input-otp` (manager PIN) + `badge` | studio `account-settings` / `statistics-component` (cards only) | Open/float/pay-in/pay-out/skim, blind vs open count, X/Z read, shift handover. High-density, keyboard-first. |
| 4 | **Split / multi-currency payment pad** | POS checkout | `button-group` + `input-group` + `tabs` + `card` + `number` formatting; `radio-group` for tender | studio ecommerce `checkout-page` (single-tender only) | Multiple tenders (cash/card/mobile/voucher/FX), change due, rounding rules, per-currency keypad. **Speed-critical — no decorative motion.** |
| 5 | **Bin / zone scan UI** | warehouse/mobile | `input-group` (scan field, autofocus) + `command` + `badge` + `drawer` + `native-select`; large touch targets | ReUI data-grid for the line list; none model scan loop | Continuous scan→confirm→next loop, audible/haptic feedback, mis-scan guard, putaway/pick/count modes. Rugged, gloves-friendly. |
| 6 | **Landed-cost allocator** | accounting, purchasing | `table`/ReUI Data Grid + `input` + `tabs` + `popover` (allocation method) | ReUI Data Grid (editable cells); none model allocation | Distribute freight/duty/insurance across PO lines by value/qty/weight/volume; live per-unit landed cost. Precision > speed. |
| 7 | **Bonded vs released stock view** | warehouse, accounting (customs) | `table`/Data Grid + `badge` (bonded/released/duty-paid) + `tabs` + `hover-card` | ReUI Data Grid; studio datatable variants | Dual-status inventory (in-bond vs duty-paid), warehouse-of-record, customs entry refs. Relevant to GY/CARICOM bonded-warehouse ops. |
| 8 | **Barcode / label designer** | admin, warehouse | `resizable` + `card` + `select` + `slider` + `popover` + canvas/SVG | none (bespoke) | WYSIWYG label layout (price/SKU/barcode/QR), template sizes, print batches. Heaviest custom build; consider a focused lib for barcode *rendering* only. |
| 9 | **Tax / VAT breakdown** | POS, accounting | `table` + `badge` + `tooltip` | studio order-summary (totals only) | Multi-rate VAT/GCT lines, inclusive vs exclusive, exempt/zero-rated flags, fiscal rounding. Reused by receipt preview (#2). |
| 10 | **Quantity-by-weight / scale input** | POS (grocery/deli), warehouse | `input-group` + `field`; scale-device hook | none | Live weight capture (tare, unit price × weight), manual fallback, hardware integration. |
| 11 | **Price-override / manager-approval inline flow** | POS | `dialog` + `input-otp` + `field` + `sonner` | none (auth primitive exists, flow doesn't) | Inline approval (PIN/biometric) with reason codes and audit trail; blocks the line until resolved. |
| 12 | **FX rate ticker / currency switcher** | POS, storefront, accounting | `badge` + `dropdown-menu` + `tooltip`; Magic UI `number-ticker` (dashboards only, **not** POS) | Magic UI number-ticker (display only) | Current FX rates, base-currency toggle, rate source/timestamp. On POS keep it static (no ticker animation). |
| 13 | **Cycle-count / stock-count session** | warehouse/mobile | `command` + `input-group` + ReUI Data Grid + `progress` + `drawer` | ReUI Data Grid; studio datatable | Blind count, variance review, freeze/recount, count-sheet export. Pairs with #5. |

## Priorities

- **Build first (block the POS MVP):** #1 Offline indicator, #2 Receipt preview, #3 Cash-drawer/shift, #4 Split payment pad, #9 Tax breakdown, #11 Price-override flow — these have no substitute and gate checkout.
- **Build for warehouse MVP:** #5 Bin/zone scan, #13 Cycle-count.
- **Build for accounting/import ops:** #6 Landed-cost, #7 Bonded stock.
- **Later / heaviest:** #8 Barcode designer, #10 scale input (hardware-dependent), #12 FX ticker.

## Cross-references

- Owned primitives: [`shadcn-core.md`](shadcn-core.md) (56 primitives — `input-otp`, `command`, `input-group`, `table`, `drawer` are the workhorses here).
- Data-dense base: [`reui.md`](reui.md) (Data Grid / Filters for #6, #7, #13).
- Per-surface picks: [`retailos-surface-map.md`](retailos-surface-map.md).
- All custom builds must follow the eventual charter §5 token system; flag any foreign tokens during build.
