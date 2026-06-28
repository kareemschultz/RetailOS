# Commerce UI Plan — CommerceO (back-office) + Shopix (storefront)

> Owner-chosen direction (2026-06-28): build the RetailOS commerce experience as a **mixture of
> CommerceO + Shopix**, both sourced from shadcn Studio, both wired to the **one** RetailOS backend.
> This is a planning doc; **no production UI until the underlying APIs are stable + approved**
> (frontend-strategy governance). Codex-gate this plan before building. See `frontend-strategy.md` §1
> and `ui-admin-shell-findings.md` for the AdminCN/CommerceO governance this refines.

## 1. What the two templates actually are (verified from the Studio docs)

| | CommerceO | Shopix |
|---|---|---|
| **Role** | Operator **back-office** (admin) | Customer **storefront** |
| **Form** | **Real code** — Next.js 16 App Router | **Figma design** (30+ pages) + Studio blocks |
| **Stack** | shadcn/ui, Tailwind v4, TS strict, **TanStack Query, Zustand, RHF+Zod, TanStack Table, Recharts, Sonner, Lucide, Nuqs** | shadcn components + Studio ecommerce **blocks** |
| **Tier** | Pro | Pro (Figma) |
| **Adaptation** | Port Next.js routing → TanStack Start file routes; `next/font`→`@fontsource`, `next/image`→`<img>`, server comps → client; everything else (components, TanStack Query, Zustand, RHF/Zod, tables, charts) transfers nearly 1:1 | Use as the visual spec; assemble from the installable Studio ecommerce blocks, re-theme, wire to oRPC |

**Both are CSS-themeable** (CommerceO has a theme config: radius None/SM/MD/LG). Our project style is **`base-lyra` (square, radius-locked)** — so installed components arrive `rounded-none` and must be wired to the radius tokens (see `lessons-learned.md` → "Lyra style locks radius"). Confirm exact block slugs with a live MCP probe before installing (slugs differ from display names).

## 2. The law: ONE backend, shared inventory (charter §21)

CommerceO and Shopix are two **front-ends** over the **same** RetailOS domain. Never create separate ecommerce inventory — the storefront reads the same `product`/`sku`/stock-ledger/pricing the POS and back-office use. Orders placed online and in-store hit the same sale/stock pipeline.

## 3. Section → RetailOS module / phase / backend mapping

CommerceO's sections span several phases — it is the **unifying admin UI** the modules light up as their backends land.

| CommerceO section | RetailOS backend | Phase | Status |
|---|---|---|---|
| Dashboard (KPIs, order pipeline, popular products) | `reports.dashboardSummary` (+ order/analytics reads) | 12 (analytics) | **partial — built a simple version** |
| Products (list, edit, variants, categories, inventory) | `product.*`, `catalog.*`, `inventory.*` | 2 (done) | **list shipped (`product.catalog`)**; edit/variants UI pending |
| Orders (list, detail, status workflow) | ecommerce order + the POS sale pipeline | 8 | **backend not built** |
| Customers (CRM, profiles, purchase history) | CRM | 7 | **backend not built** |
| Vendors (list, detail, performance) | Suppliers/Procurement | 6 | **backend not built** |
| Settings (store config) | tenant/company/location + `tenant_ui_config` | 3/11 | partial |

| Shopix storefront page | Studio block | Backend needed | Phase |
|---|---|---|---|
| Product list / category | `product-list-01`, `product-category-02`, `category-filter-05` | public catalog read + live stock availability | 8 |
| Product detail / quick view | `product-overview-01`, `product-quick-view-02` | product detail + pricing/promos + **product images** | 8 |
| Cart | `shopping-cart-01` | cart service (shared inventory reservation) | 8 |
| Checkout | `checkout-page-01` | checkout · order · payment-callback | 8 |
| Reviews | `product-reviews-02` | reviews store | 8 |
| Footer / offers | `mega-footer-01`, `offer-modal-03` | promotions | 8 |

## 4. Buildable NOW vs backend-gated

**Now (backend already exists):**
- Re-skin the existing **Dashboard** + **Products** screens to the **CommerceO** look (KPI cards + product table) — they already wire to `reports.dashboardSummary` / `product.catalog`. This is the first visible CommerceO adoption with zero new backend.

**Gated on backend (build the read/write services first, then the UI):**
- **Product images** — `product` has no image/media column today. A storefront and a rich product table both need it. **First schema add for commerce.**
- **Orders / cart / checkout** (Phase 8), **Customers/CRM** (Phase 7), **Vendors/Suppliers** (Phase 6).

## 5. Build sequence (proposed, incremental, each Codex-gated)

1. **CommerceO shell + upgrade existing screens** — adopt the CommerceO layout/theme; upgrade Dashboard + Products to its design (existing backend). *No new backend.*
2. **Product media** — add `product_image` (or media column), upload seam (S3/MinIO, §4), surface in the product table + detail. *Small backend.*
3. **Storefront read slice (Shopix)** — public catalog read + stock availability → `product-list` / `category` / `product-overview` blocks on a `/shop` route, re-themed, wired. *Read-only; no cart yet.*
4. **Cart + checkout (Phase 8)** — cart service (shared-inventory reservation per §13/§14 oversell policy), checkout → order → payment-callback; `shopping-cart` + `checkout-page` blocks. *The big backend.*
5. **Orders / Customers / Vendors** back-office (Phases 8/7/6) — CommerceO sections light up as each backend lands.

## 6. Decisions (owner, 2026-06-28)

- 🔒 **Build first: Step 1 — CommerceO-skin the existing screens.** Adopt the CommerceO look on the Dashboard + Products screens we already ship (they wire to `reports.dashboardSummary` / `product.catalog`). No new backend. This is the immediate next build.
- 🔒 **Nav: keep the AdminCN sidebar NOW; nav-style becomes a *future* `tenant_ui_config` option (do NOT build the toggle yet).** Sidebar-vs-top-nav should eventually be a `tenant_ui_config.nav_layout` (`"sidebar" | "top"`) white-label choice (charter §11) — but that seam is greenfield and design-first. Building the toggle now (scattering a nav-choice conditional before the white-label design exists) is the **module-aware-components trap**. So: ship Step 1 on the existing sidebar unchanged; record nav-style as a white-label option to design later. No top-nav, no toggle, in this pass.
- ⬜ **Still open:** bring Phase 8 (+ the 6/7 backends) forward vs build CommerceO incrementally as phases arrive; and whether to switch the project `style` off `base-lyra` (vs keep stripping `rounded-none` per install).

## 7. Immediate next task (for the next session / Codex) — Step 1

**Goal:** re-skin the existing back-office to the CommerceO design, no new backend, **on the existing AdminCN sidebar (no nav change in this pass).**

1. **Nav:** leave `app-shell.tsx` on the current sidebar. Do NOT add a top-nav or a `nav_layout` toggle — that's deferred to the white-label design (see §6). Restyle within the sidebar shell only if needed.
2. **Dashboard** (`apps/web/src/routes/_app/dashboard.tsx`): keep the `reports.dashboardSummary` wiring; restyle the KPI row toward CommerceO + add a CommerceO-style "popular products / recent" panel using existing data only (`product.catalog`). No client money math (already server-aggregated).
3. **Products** (`apps/web/src/routes/_app/products.tsx`): restyle the table toward CommerceO's product list (thumbnails are deferred until the product-image column exists — Step 2); keep `product.catalog` (DTO) + the error/empty states.
4. **Theme discipline:** every Studio block installed comes square under `base-lyra` — wire `rounded-*` to tokens (see `lessons-learned.md`). Confirm block slugs with a live MCP probe before installing.
5. **Gates + deploy + verify-live** (desktop + mobile, light + dark), then commit to a fresh branch off **clean master** (after PR #45 merges), Codex-gate, **do not merge** (owner gate).
