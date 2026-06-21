# ReUI (reui.io) — Free Data-Dense Component Catalog

> **Registry:** `@reui` → `https://reui.io/r/base-nova/{name}.json` — **Free, MIT.** Pinned to ReUI's Base-UI
> **`base-nova`** style (the repo's own `base-lyra` style 404s on ReUI; both are Base-UI families so components are compatible).
> **Install:** `npx shadcn@latest add @reui/<slug> -c packages/ui`
> **No searchable index** — items install by exact slug only (discover from reui.io docs).
> **Enumerated & live-verified 2026-06-21** via `shadcn view @reui/<slug>` + direct registry-JSON fetch.

## Why ReUI (and where it sits)

ReUI is the **actively-maintained, free, data-dense** complement to the owned shadcn core — it fills the
operational gap that Magic UI (decorative) and shadcn studio (broad blocks) don't: a TanStack-based **Data
Grid**, faceted **Filters**, **Tree**, DnD **Kanban/Sortable**, and fast input primitives. Stack: **React +
Tailwind v4 + Base UI** (`@base-ui/react`), DnD via `@dnd-kit/*`, tables via `@tanstack/react-table` +
`@tanstack/react-virtual`. **No Framer Motion in the verified data-dense items** — so, unlike Magic UI, ReUI is
safe on dense operational surfaces. Re-theme all of it to RetailOS tokens; `registryDependencies` mix `@reui/*`
items with bare shadcn primitives (`button`, `input`, `select`…) resolved from the default `@shadcn` registry.

**17 named components** (same set ships under Base UI and Radix UI variants; we use Base-UI `base-nova`). **14
live-verified to resolve**; the rest are documented but untested or pulled indirectly as deps.

## Data & Operational — the priority bucket

| Component | `@reui` slug | What it is | Resolves? | Key deps | RetailOS surface | Verdict |
|---|---|---|---|---|---|---|
| Data Grid | `data-grid` | TanStack Table v8 grid: sort/filter/paginate, footer rows, DnD, virtualization, infinite scroll, row pinning | ✅ verified | @tanstack/react-table + react-virtual, @dnd-kit/*; regDeps badge/button/checkbox/dropdown-menu/input/popover/select/separator/skeleton/spinner | Warehouse stock, admin tables, accounting ledgers, dashboards | **Use** (flagship; high-row-count ops) |
| Filters | `filters` | Composable multi-facet filter bar (chips, dropdowns, search) | ✅ verified | @base-ui/react; regDeps button/button-group/dropdown-menu/input/input-group/kbd/scroll-area/tooltip | Pairs with Data Grid (inventory/order filtering) | **Use** |
| Tree | `tree` | Hierarchical tree view (headless-tree engine) | ✅ verified | @base-ui/react, @headless-tree/core | Category/department hierarchies, chart-of-accounts, warehouse locations | **Use** |
| File Upload | **`use-file-upload`** | Headless upload hook + components (drag/drop, progress). ⚠️ **slug is `use-file-upload`, NOT `file-upload`** | ✅ verified | headless | Product image/CSV import, receipt attachments | **Use** (mind the slug) |
| Kanban | `kanban` | DnD board columns/cards | ✅ verified | @base-ui/react, @dnd-kit/core+sortable+utilities | Pick/pack/ship lanes, fulfillment, task boards | **Maybe** (workflow boards; DnD is deliberate, ok on ops — not POS) |
| Sortable | `sortable` | Generic DnD-reorderable list | ✅ verified | @base-ui/react, @dnd-kit/* | Reorder menu/category/price-tier lists (admin) | **Maybe** (admin/config; not POS) |

## Inputs & Selection

| Component | `@reui` slug | What it is | Resolves? | RetailOS surface | Verdict |
|---|---|---|---|---|---|
| Autocomplete | `autocomplete` | Typeahead select | ✅ verified | Product/SKU/customer lookup (POS, order entry) | **Use** (fast data entry) |
| Number Field | `number-field` | Stepper numeric input | ✅ verified | Quantities, prices, stock counts | **Use** |
| Date Selector | `date-selector` | Date/range picker | ✅ verified | Report ranges, ship dates, accounting periods | **Use** |
| Phone Input | `phone-input` | Intl phone w/ country combobox | ✅ verified | Customer/supplier records (admin) | **Use** |
| Rating | `rating` | Star rating input | untested | Product reviews (admin only) | **Skip** (not operational) |

## Layout / Navigation / Feedback

| Component | `@reui` slug | What it is | Resolves? | RetailOS surface | Verdict |
|---|---|---|---|---|---|
| Timeline | `timeline` | Vertical event timeline | ✅ verified | Order/audit history, shipment tracking | **Maybe** (history views) |
| Stepper | `stepper` | Multi-step wizard/progress | ✅ verified | Checkout/onboarding/returns flows | **Maybe** (wizards; not POS keypad) |
| Scrollspy | `scrollspy` | Active-section tracker | ✅ verified | Long admin/settings/docs pages | **Maybe** (admin) |
| Frame | `frame` | Layout container primitive | ✅ verified | Generic layout | **Maybe** (utility) |
| Scroll Area | `scroll-area` | Custom scrollbars | untested (dep of verified items) | Dense panels | **Use** (utility primitive) |
| Badge | `badge` | Status badge | untested (regDep of `data-grid`) | Status pills in grids/dashboards | **Use** (required by Data Grid) |
| Alert | `alert` | Alert/callout | untested | Stock warnings/errors | **Maybe** (likely overlaps owned `@shadcn/alert` — prefer core) |

## ⚠️ Do NOT document as installable
- **`file-upload` → 404** (verified via `shadcn view` and direct fetch). The correct slug is **`use-file-upload`**.

## Recommendation for RetailOS

Lead with the verified operational core: **`data-grid` + `filters` + `tree` + `use-file-upload` + `autocomplete`
+ `number-field` + `date-selector`** — all confirmed-resolving, dense, no decorative animation, clean fit for
warehouse / admin / accounting / dashboard surfaces (and the basis for several `gaps-and-custom.md` builds:
landed-cost #6, bonded-stock #7, cycle-count #13). Treat `kanban`/`sortable`/`timeline`/`stepper`/`scrollspy` as
**Maybe** (workflow/admin, off the POS keypad path); `rating` **Skip**. Prefer the owned `@shadcn` core where
ReUI overlaps it (`alert`, `badge`, `scroll-area`) unless ReUI's variant is a required dep.
