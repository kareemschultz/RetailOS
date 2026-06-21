# RetailOS Surface → Component Map

> Recommended items per RetailOS surface, drawn from the three catalogs (`shadcn-core.md`, `shadcn-studio.md`, `magic-ui.md`).
> Applies charter §5 verdict rules: **speed & density first** on transactional surfaces (animated/decorative items are Maybe/Skip on POS checkout and high-frequency data entry); **expressive motion allowed** on storefront / marketing / onboarding / auth / executive dashboards. Everything must be re-themed to RetailOS design tokens.
> Legend: `@shadcn/x` = owned core (Free), `ss:` = shadcn studio (Pro install), `@magicui/x` = Magic UI (Free unless noted Pro).

---

## 1. POS / Checkout (speed + density, keyboard-first, touch)
**Motion budget: functional only.** No decorative animation.

- Core: `@shadcn/command` (⌘K product/SKU search), `@shadcn/combobox`, `@shadcn/input-group` (scan field), `@shadcn/button` + `@shadcn/button-group`, `@shadcn/kbd`, `@shadcn/drawer`/`@shadcn/sheet` (cart panel), `@shadcn/dialog` + `@shadcn/alert-dialog` (voids/refunds), `@shadcn/input-otp` (manager override PIN), `@shadcn/sonner` (save/sync), `@shadcn/table`, `@shadcn/tabs`, `@shadcn/native-select`.
- Studio: `ss: ecommerce/shopping-cart`, `ss: ecommerce/order-summary` (receipt), `ss: datatable-component-01` (settlement) — **re-theme for density**.
- Magic UI: **Skip** (decorative). Exception: `@magicui/confetti` only on a deliberate "sale complete" moment if desired.
- Verdict bias: **Use core**; studio Maybe (density re-theme); Magic UI Skip.

## 2. Warehouse / Mobile (rugged, large targets, offline-tolerant)
**Motion budget: minimal.**

- Core: `@shadcn/native-select` (fast native pickers), `@shadcn/drawer`, `@shadcn/sheet`, `@shadcn/input-otp`, `@shadcn/input-group`, `@shadcn/progress`, `@shadcn/empty`, `@shadcn/skeleton`, `use-mobile` hook.
- Studio: `ss: datatable-component-03` (fleet/vehicle routes, dispatch), `ss: datatable-component-06` (product/inventory, **CSV/XLSX export**), `ss: dashboard-and-application/file-upload`.
- Magic UI: **Skip**.
- Note: the **native app** (`apps/native`, Expo) uses HeroUI Native / NativeWind, **not** these web components — see `building-native-ui` skill. This map is for the mobile-web warehouse surface.

## 3. Admin / Data Tables (back-office CRUD, bulk ops)
- Core: `@shadcn/sidebar` (+ `sidebar-07` icon-collapse / `sidebar-16` sticky-header blocks), `@shadcn/table`, `@shadcn/pagination`, `@shadcn/form` + `@shadcn/field`, `@shadcn/select`, `@shadcn/checkbox`, `@shadcn/dropdown-menu`, `@shadcn/dialog`, `@shadcn/tabs`, `@shadcn/breadcrumb`, `@shadcn/tooltip`, `@shadcn/resizable` (dual-pane), `@shadcn/command`.
- Studio: `ss: datatable-component-04` (user/role admin), `ss: dashboard-and-application/application-shell`, `ss: .../dashboard-shell`, `ss: .../form-layout`, `ss: .../account-settings`, `ss: .../multi-step-form`.
- Magic UI: **Skip** on grids; `@magicui/number-ticker` ok on summary cards.

## 4. Accounting (precision, tables, exports, charts)
- Core: `@shadcn/table`, `@shadcn/chart` (`chart-bar-*`, `chart-line-*`, `chart-area-*`), `@shadcn/calendar` + date-range, `@shadcn/badge` (status), `@shadcn/input-group`, `@shadcn/pagination`.
- Studio: `ss: datatable-component-05` (invoices/billing), `ss: datatable-component-01` (financial transactions), `ss: dashboard-and-application/statistics-component`.
- Magic UI: `@magicui/number-ticker`, `@magicui/animated-circular-progress-bar` (KPI), else **Skip**.

## 5. Executive Dashboards (overview, KPIs, trends)
**Motion budget: tasteful enter animations; disable on live tickers.**

- Core: `dashboard-01` block, `@shadcn/card`, `@shadcn/chart` (`chart-area-*`, `chart-bar-*`, `chart-line-*`, `chart-radial-*` gauges), `@shadcn/tabs`, `@shadcn/badge`.
- Studio: `ss: dashboard-and-application/charts-component`, `ss: .../statistics-component`, `ss: .../widgets-component`, `ss: datatable-component-07` (analytics w/ embedded charts), `ss: bento-grid`.
- Magic UI: `@magicui/number-ticker`, `@magicui/animated-circular-progress-bar`, `@magicui/bento-grid`, `@magicui/dotted-map` (coverage). **Use** (dashboards allow motion).

## 6. Ecommerce Storefront (expressive, conversion-focused)
**Motion budget: full.**

- Core: `@shadcn/carousel`, `@shadcn/navigation-menu`, `@shadcn/hover-card`, `@shadcn/aspect-ratio`, `@shadcn/sheet` (cart/filters), `@shadcn/slider` (price filter), `@shadcn/pagination`.
- Studio: `ss: ecommerce/*` (product-list, product-overview, product-quick-view, category-filter, product-reviews, checkout-page, shopping-cart, mega-footer, announcement-banner, gift-card).
- Magic UI: `@magicui/marquee` (logos/reviews), `@magicui/bento-grid`, `@magicui/hero-video-dialog`, `@magicui/border-beam`/`magic-card` (featured), `@magicui/shimmer-button` (promos), Pro **Hero/Pricing/Feature** sections.

## 7. Auth / Onboarding (branded, guided, lower-frequency)
**Motion budget: moderate–full.**

- Core: `login-01..05`, `signup-01..05` blocks, `@shadcn/form`, `@shadcn/field`, `@shadcn/input-otp` (2FA), `@shadcn/progress` (onboarding steps).
- Studio: `ss: marketing-ui/login-page|register|forgot-password|reset-password|two-factor-authentication|verify-email` (studio covers 2FA + email-verify that core blocks don't), `ss: dashboard-and-application/multi-step-form`, `ss: .../onboarding-feed`.
- Magic UI: `@magicui/confetti` (onboarding complete), `@magicui/blur-fade`, `@magicui/dot-pattern` (auth bg), `@magicui/animated-circular-progress-bar`.

## 8. Platform / MSP Console (multi-tenant ops, density)
- Core: `@shadcn/sidebar` (nested `sidebar-09`/dual `sidebar-15`), `@shadcn/command`, `@shadcn/table`, `@shadcn/tabs`, `@shadcn/resizable`, `@shadcn/badge`, `@shadcn/tooltip`, `@shadcn/dropdown-menu`.
- Studio: `ss: dashboard-and-application/application-shell`, `ss: datatable-component-04` (tenant/user admin), `ss: .../dashboard-header`, `ss: .../account-settings`.
- Magic UI: **Skip** (ops density); `@magicui/number-ticker` on tenant-summary cards only.

## 9. Marketing Site (RetailOS product site)
**Motion budget: full.**

- Studio: `ss: marketing-ui/*` (hero ×15, features ×7, pricing, testimonials ×4, social-proof, faq, cta, footer, navbar, logo-cloud).
- Magic UI: Pro **templates** (SaaS/Startup/Mobile) + sections (Hero/Feature/Pricing/CTA/FAQ/Footer), `@magicui/marquee`, `@magicui/safari|iphone|android` mocks, `@magicui/hero-video-dialog`, `@magicui/aurora-text`/text animations, `@magicui/globe`.

---

## Coverage assessment

| Surface | Coverage | Source strength |
|---|---|---|
| POS / Checkout | **Strong** (core) | Core primitives + studio cart/order; no gaps |
| Warehouse / Mobile-web | Good | Core + studio fleet/inventory tables |
| Admin / Data tables | **Strong** | Studio datatables are near-perfect fit |
| Accounting | **Strong** | Studio invoice/transaction tables + core charts |
| Executive dashboards | **Strong** | Core charts + studio stats/widgets + Magic UI tickers |
| Ecommerce storefront | **Strong** | Studio ecommerce set + Magic UI marketing |
| Auth / Onboarding | **Strong** | Core blocks + studio 2FA/verify-email |
| Platform / MSP | Good | Core sidebar/command + studio shells |
| Marketing site | **Strong** | Studio + Magic UI Pro |
| **Native (Expo) app** | **Out of scope here** | Uses HeroUI Native/NativeWind, not web registries |

Thinnest real gap: **none of these registries serve the Expo native surface** — that stack is HeroUI Native. Track separately.
