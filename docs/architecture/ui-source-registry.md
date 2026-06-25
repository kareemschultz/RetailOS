# RetailOS UI Source Registry (per-module — authoritative)

- **Status:** GOVERNANCE — the **single authoritative per-module UI sourcing registry**. **Docs-only; no UI is built during backend phases.** This file fixes, *before* any UI session starts, **where each module's screens come from**, so a UI session **follows the registry instead of re-deciding** per screen. It is the per-module companion to `frontend-strategy.md` (the sourcing *law* + the 6-layer stack) and the `retailos-design-language` skill (the design *law*).
- **Authority:** this file **owns the per-module table**. `frontend-strategy.md` points here and does not duplicate it (one owner per concern — avoid drift). When a module's source changes, change it **here**.
- **Grounded in:** read-only inspection of the **AdminCN** and **CommerceO** template ZIPs (2026-06-25) + `ui-admin-shell-findings.md` + the `ui-inventory/` catalog + `gaps-and-custom.md`. Claims about template contents are verified against the actual ZIP folder structure, not marketing copy (Principle D).

---

## The 6-layer stack (recap — full detail in `frontend-strategy.md`)

| # | Layer | Role |
|---|---|---|
| ① | **AdminCN** | Application shell & visual language — sidebar, header, command palette, 9 dashboards, 11 datatable patterns, RBAC (`roles`/`permissions`/`users`), form wizards, charts/statistics/widgets, settings, theme customizer |
| ② | **CommerceO** | Retail & commerce workflows — Products (incl. inventory section), Orders (detail/tracking), Customers (CRM-shaped), Vendors (suppliers), commerce Settings (store/checkout/payments/shipping/locations) |
| ③ | **shadcn Studio** | First-class source for **both** workflow blocks **and** polished primitive variants (prefer a Studio variant whenever it is more polished than base shadcn/ui) |
| ④ | **shadcn/ui** | Base primitives (Base UI) when nothing above provides a better variant |
| ⑤ | **Magic UI** | Tasteful motion — marketing / onboarding / auth-success / KPI accents only. **Never** on the POS checkout, accounting, or high-frequency data-entry path |
| ⑥ | **RetailOS custom** | ERP-specific surfaces no registry covers (`gaps-and-custom.md`) — owned in `packages/ui` |

> Both templates are the same vendor's stack: **Base UI** (`@base-ui/react`) **+ shadcn `base-vega` + Tailwind v4 + Next 16 / React 19**, all-mock, zero Radix, zero bundled auth — so they compose once ported. **We mine `src/views`/`src/components`; we never fork the Next app.**

## How to read the table

- **Primary** = the layer that frames/drives most of the screen.
- **Secondary** = the layer filling specific blocks/variants on top of the primary.
- **Studio Components** = the specific shadcn-Studio blocks/variants to pull when the primary/secondary don't cover a piece (install via the studio MCP / `@ss-blocks`, `-c packages/ui`).
- **Custom (RetailOS-specific)** = the ERP logic no registry covers — the `gaps-and-custom.md` set, built on Base UI primitives.

Every screen is **composed of blocks** (build layers, not pages — see `frontend-strategy.md` §7), so a module almost always draws from several layers.

---

## Per-module registry

| Module | Primary | Secondary | Studio Components | Custom (RetailOS-specific) |
|---|---|---|---|---|
| **Dashboard / Executive** | AdminCN (dashboard shells: sales/finance/analytics) | CommerceO (sales dashboard) · Studio · Magic UI (KPI tickers only) | `application-shell` · `dashboard-shell` · `statistics` · `widgets` · Charts | correlated-insight cards, exception/KPI consolidation |
| **POS** | shadcn Studio (eCommerce checkout/cart/product-list/order-summary) + **AdminCN shell** | CommerceO (product-grid / order-items / cart patterns) · shadcn primitives. **No Magic UI motion** | eCommerce `checkout` · `cart` · `product-list` · `order-summary` · payment dialog · Command (product search) | split / multi-currency **payment pad**, **offline-status indicator**, **fiscal/thermal receipt preview**, **cash-drawer & shift-close panel**, blind-close over/short, held-sales drawer, POS business logic |
| **Inventory / Products** | CommerceO (products: list + multi-section add incl. **inventory**, categories, coupons) | AdminCN (logistics dashboard, datatables) · Studio | `datatable-06` (product/inventory + CSV/Excel export) · `datatable-07` (analytics) · Multi-step Form (product wizard) | **stock-ledger / FIFO-layer viewer**, **bonded-vs-released view**, **bin/zone scan UI**, serial/batch/expiry capture, **barcode/label designer** |
| **Orders / Sales** | CommerceO (order: list / details / tracking) | AdminCN · Studio | `datatable-01` (transactions/settlement) · order-items-table · Timeline (order activity) | sale ↔ refund ↔ void timeline, fiscal document links |
| **CRM / Customers** | CommerceO (customer: all / overview / billing / security) | AdminCN (contacts app) · Studio (pipeline / activity feed) | Contacts · Kanban (pipeline) · Timeline (activity) · `datatable-04` | credit-limit / store-credit panel, loyalty tier, segmentation logic |
| **Procurement / Vendors** | CommerceO (vendor: list / create / details) | AdminCN · Studio (kanban / wizard) | vendor table · Multi-step Form (PO wizard) · Kanban (PO board) | **PO / GRN workflows**, **landed-cost allocator**, supplier performance, OCR/AI document seam |
| **Accounting** | AdminCN (finance / payments dashboards) | Studio (datatables) · shadcn primitives | `datatable-01` (financial transactions) · `datatable-05` (invoices) · Tabs (ledgers) · Resizable (reconciliation) | **journals / GL / reconciliation**, tax engine, period-close, cash-clearing views (monospace, right-aligned) |
| **Warehousing** | AdminCN (logistics) | CommerceO (inventory) · Studio | `datatable-03` (fleet/routes) · Kanban (pick/pack) · Progress | **location hierarchy** (Warehouse→Zone→Aisle→Rack→Bin), pick/pack/scan, scanner-first tablet UI |
| **HR / Payroll** | shadcn Studio (employee profile / timeline / wizard) | AdminCN (users app) · CommerceO (account layouts) | Multi-step Form (onboarding) · Timeline · `datatable-04` | **payroll engine**, **commission engine** + statements/payouts |
| **Reports / Analytics** | AdminCN (analytics dashboards + charts) | Studio (datatables) | Charts (Recharts) · `datatable-07` (analytics) · Statistics | custom read-model views, scheduled-report builder, drilldowns |
| **Settings** | AdminCN (account/settings layouts) | CommerceO (commerce settings: store/checkout/payments/shipping/locations) · shadcn primitives | Account Settings · Tabs · Form Layout | **tenant white-label config** (tokens / density / radius), feature-flag switches, residency/attestation |
| **Auth / Onboarding** | shadcn Studio (auth blocks + multi-step) | AdminCN / CommerceO (auth page layouts: login/register/forgot/reset/2FA/verify-email) · Magic UI (success/delight) | Auth (2FA / Verify-Email — shadcn core lacks) · Onboarding Feed · Multi-step Form | **tenant-branded login** (hostname-resolved), device/PIN fast-switch, guided setup wizards |
| **Platform / MSP console** | AdminCN (admin dashboards + RBAC) | Studio (datatables) | `datatable-04` (user admin) · Statistics (MRR/usage) · Switch (feature flags) | audited impersonation banner, tenant health, residency/attestation panels |
| **Marketing / Storefront** | Magic UI (+ Magic UI Pro sections) | CommerceO (eCommerce surfaces) · Studio (eCommerce) | eCommerce (product-list / category / reviews / mega-footer) · Marketing sections | tenant-themed storefront, hostname branding |

> **POS / warehouse-scan are speed-first, custom paths** (charter §5 speed rule): no decorative motion, no Magic UI. AdminCN's animated dashboards are not a model for them.

---

## Reconciliation when combining AdminCN + CommerceO (verified deltas)

Both ship Base UI / `base-vega` / Tailwind v4, so they compose — but normalize these on import:

| Concern | AdminCN | CommerceO | RetailOS action |
|---|---|---|---|
| Icon library | `lucide` | `@remixicon/react` | Normalize to **lucide / Phosphor** (design-language skill) |
| Zod | `zod@3` | `zod@4` | Align to the **RetailOS-pinned zod** before mixing components |
| shadcn baseColor | `neutral` | `zinc` | Re-theme **both** to RetailOS tokens (blue accent + semantic palette) |
| Filename case | PascalCase | kebab-case | Pick one convention in `packages/ui` |
| Data layer | Next `'use server'` + `fake-db` | Next `'use server'` + `fake-db` | Strip entirely → **oRPC + TanStack Query** |
| Auth | none bundled (Clerk = doc only) | none bundled | Wire to **Better Auth** |

## The pipeline (every cell becomes owned code)

`import → normalize → adapt → extend` (full rule in `frontend-strategy.md`). No imported block ships as-is: strip Next/auth/mock/routing, re-theme to RetailOS tokens, wire to oRPC + TanStack Query, own it in `packages/ui`, and review it against the `retailos-design-language` skill before it counts as done.

## Cross-references

| Concern | Authoritative source |
|---|---|
| Sourcing law + 6-layer stack + verified ZIP facts | `frontend-strategy.md` |
| Design law (color/type/spacing/states/offline/motion/a11y) | `.agents/skills/retailos-design-language/SKILL.md` |
| AdminCN: installable vs Next-coupled, what to port | `ui-admin-shell-findings.md` |
| Component catalog + per-surface picks | `ui-inventory/` (`INDEX.md`, `retailos-surface-map.md`) |
| Custom RetailOS components (the ~13 gaps) | `ui-inventory/gaps-and-custom.md` |
