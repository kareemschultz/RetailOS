# RetailOS Master Architecture Charter v4.1

## Enterprise Retail ERP, POS, Inventory, Warehousing, Accounting, CRM, Procurement, Asset Management, Ecommerce, SaaS, White-Label, Offline-First, Edge-Ready, Multi-Deployment Platform

---

## 0. How to Use This Document

This is the governing architecture charter for RetailOS. Use it in Claude Code Plan Mode. Do not ask Claude Code to “build RetailOS” all at once. Claude Code must first read, analyze, validate, challenge, and refine this charter before implementation.

The first Claude Code run must produce architecture review, gap analysis, ERD, domain model, module dependency map, Better Auth plan, RBAC/entitlements matrix, tenant isolation/RLS strategy, offline sync strategy, Edge Hub strategy, hardware bridge strategy, testing strategy, CI/CD strategy, observability strategy, disaster recovery strategy, deployment strategy, and Vertical Slice #1 plan.

Implementation must proceed one bounded module at a time.

---

## 1. Execution Instructions for Claude Code

You are the Principal Software Architect, ERP Consultant, SaaS Architect, Security Architect, DevOps Architect, Offline Systems Architect, Product Architect, UX Architect, Data Architect, Compliance Architect, and Lead Full-Stack Engineer for RetailOS.

Before writing code:

1. Read this full charter.
2. Identify architectural risks, contradictions, and missing requirements.
3. Recommend improvements.
4. Produce a gap analysis.
5. Produce a phased implementation roadmap.
6. Produce domain architecture, ERDs, module dependency maps, deployment architecture, security architecture, observability architecture, testing strategy, CI/CD strategy, disaster recovery strategy, and Vertical Slice #1 plan.
7. Do not generate implementation code until architecture review and implementation planning are complete.

---

## 2. Product Vision

RetailOS is not merely a POS. RetailOS is a complete business operating system for retail, wholesale, warehousing, inventory, accounting, CRM, ecommerce, procurement, assets, reporting, compliance, and operations.

RetailOS should feel like a modern combination of Odoo, ERPNext, NetSuite, SAP Business One, Microsoft Dynamics 365 Business Central, Lightspeed Retail, Shopify POS, Zoho One, Square for Retail, Cin7, and QuickBooks Commerce-style workflows, but simpler, more intuitive, more offline-capable, better for Caribbean/developing-market operations, and flexible enough for SaaS, dedicated hosting, managed private hosting, and self-hosted enterprise deployments.

Target customers include retail stores, supermarkets, mini-marts, hardware stores, pharmacies, electronics stores, computer stores, furniture stores, auto parts stores, clothing stores, wholesalers, distributors, import/export companies, warehousing companies, bonded warehouse operators, logistics companies, government agencies, healthcare organizations, mining companies, construction suppliers, enterprise groups, multi-branch companies, franchise networks, and businesses that want to buy and privately host software instead of subscribing to SaaS.

---

## 3. Core Architectural Principles

- ERP First: Do not build a POS and bolt ERP features on later. Accounting, inventory, CRM, procurement, assets, ecommerce, POS, warehousing, and reporting must share one domain model.
- Offline First: Business must continue during ISP failures, power outages, generator operation, cloud unavailability, single-terminal connectivity loss, or full-store WAN outage with LAN still active.
- Cloud First: The cloud is the authoritative source of truth. Local storage and Edge Hubs are operational continuity layers.
- Event Driven: Every major business action emits domain events through an Outbox Pattern. Events must be auditable, replayable, versioned, tenant-scoped, and idempotent.
- Audit Everything: Every mutation, stock movement, financial posting, admin action, support action, and impersonation must be traceable.
- Multi-Tenant: All tenant-owned data must be tenant-scoped. Use app-level guards and PostgreSQL RLS for shared SaaS.
- Deployment Agnostic: Business logic must support SaaS, dedicated cloud, managed private, and self-hosted deployments.
- White-Label Ready: Support custom domains, branding, SMTP, login screens, receipt templates, invoice templates, and storefront themes.
- User Friendly: Build guided workflows, not raw CRUD screens.
- Compliance Ready: Reserve seams for fiscalization, e-invoicing, data residency, PII erasure, audit evidence, SCIM, and SOC 2 / ISO 27001-style controls.

---

## 4. Technology Stack

### Frontend

- TanStack Start
- React
- TypeScript
- Tailwind CSS
- Shadcn UI
- Shadcn Studio Pro
- Magic UI Pro
- TanStack Query
- TanStack Table
- TanStack Form
- Zustand

### Client Targets

RetailOS ships three client form factors:

1. Web app: TanStack Start SSR/admin/back-office/ecommerce storefront.
2. Desktop thick client: Tauri for primary offline-first POS and warehouse stations. Tauri must have a static/SPA build target because it packages static web assets and must not assume the SSR server is reachable.
3. Native mobile: Expo / React Native with native-uniwind for mobile POS, warehouse scanning, stock counts, and manager dashboards.

### Offline Store Engine by Form Factor

- Web: Dexie.js + IndexedDB + TanStack Query persistence.
- Tauri desktop: embedded SQLite for supermarket-scale catalogs and large offline datasets.
- Native mobile: SQLite via Expo SQLite or op-sqlite.
- Edge Hub: PostgreSQL for larger sites, SQLite acceptable for smaller sites.

Do not assume IndexedDB everywhere.

### Backend

- Hono
- oRPC
- Better Auth
- Drizzle ORM
- PostgreSQL
- Redis for caching, rate limiting, sync coordination, backpressure, queues, background jobs, feature flag cache, and reconnection avalanche mitigation.
- WebSockets for sync status, POS events, Edge Hub sync, notifications, live dashboards, and inventory updates.
- S3-compatible object storage, including AWS S3, Cloudflare R2, DigitalOcean Spaces, Backblaze B2, and self-hosted MinIO.

### Testing

- Vitest for unit/integration tests.
- Playwright for E2E, POS simulation, offline simulation, and terminal workflows.
- Required tests: offline POS, sync retry, Edge Hub, RLS isolation, RBAC, accounting posting, inventory ledger, payment webhooks, Tauri build, mobile payloads, migration fan-out, fiscal/document numbering, and reconnection avalanche.

- Visual regression (Playwright VRT): tenant theme tokens (radius, colors, fonts) must not break layout or push controls off-screen; snapshot key surfaces (POS checkout, dashboards, storefront) per theme.
- Offline E2E: run Playwright against mock service workers / disabled network to simulate ISP failure mid-checkout and the reconnection and sync that follow.
- Native (Expo) E2E uses a mobile runner (Maestro or Detox); Playwright covers web only.

### Project Scaffold (Verified)

Scaffold with Better-T-Stack using the verified flag set:

```
bun create better-t-stack@latest RetailOS \
  --frontend tanstack-start native-uniwind \
  --backend hono \
  --runtime bun \
  --api orpc \
  --auth better-auth \
  --payments none \
  --database postgres \
  --orm drizzle \
  --db-setup docker \
  --package-manager bun \
  --git \
  --web-deploy docker \
  --server-deploy none \
  --install \
  --addons fumadocs mcp skills tauri turborepo ultracite \
  --examples none
```

Scaffold notes and corrections:

- The native frontend flag is `native-uniwind` (current name; not `native-nativewind`). It produces the Expo / React Native client.
- Tauri packages static web assets and TanStack Start is SSR-first, so the desktop POS requires a static/SPA build target and must not assume the SSR server is reachable from the terminal.
- Better-T-Stack’s only built-in payments addon is Polar. RetailOS billing (Stripe/Paddle/LemonSqueezy/Polar/Chargebee per §10/§23) is implemented as domain logic in a later phase, so scaffold with `--payments none`.
- `oRPC + Hono + Drizzle + Better Auth + PostgreSQL` is the verified backend. The `mcp` and `skills` addons wire the agent toolchain used for registry/MCP component sourcing (§5).
- After scaffolding, configure shadcn with the Base UI primitive and the registry/MCP namespaces (§5) before building any UI.

---

## 5. UI/UX, Design System, Component Libraries, and Motion

RetailOS must be powerful but easy enough for non-technical cashiers, store managers, warehouse workers, accountants, business owners, procurement staff, sales reps, executives, platform admins, and support technicians.

Design goals:

- Simple language
- Minimal clicks
- Guided workflows
- Helpful defaults
- Friendly validation
- Clear visual feedback
- Smart suggestions
- Recoverable errors
- Role-based dashboards
- Strong search/filtering
- Fast POS interactions
- Mobile/tablet warehouse workflows
- Dense admin/accounting tables
- Executive dashboards with insights

Support UX patterns:

- Wizards
- Step-by-step workflows
- Drag and drop
- Dropdown menus
- Command palette
- Quick actions
- Bulk actions
- Saved views
- Advanced filters
- Smart/global search
- Keyboard shortcuts
- Tooltips
- Inline help
- Empty/loading/error states
- Confirmation dialogs
- Undo where safe
- Draft saving
- Auto-save for long forms
- Multi-step forms
- Recently used items
- Favorites
- Pinned reports
- Guided sync recovery

Required wizards:

- Tenant setup
- Company setup
- Store/location setup
- Warehouse setup
- Bonded warehouse setup
- Product setup/import
- Opening stock
- Chart of accounts
- Tax setup
- POS terminal setup
- Hardware pairing
- Custom domain setup
- SMTP setup
- Ecommerce storefront setup
- Receipt/invoice template setup
- Staff/user onboarding
- Supplier onboarding
- Customer import
- Stock count
- Accounting opening balances
- Edge Hub setup
- Data residency setup
- Fiscal numbering setup
- Backup setup
- Integration setup

Accessibility:

- Responsive layouts
- Mobile-friendly screens
- Tablet-friendly warehouse screens
- Touch-friendly POS screens
- Keyboard navigation
- Clear focus states
- High contrast support
- Large touch targets
- Screen-reader-friendly labels where practical
- Text labels with icons
- WCAG 2.2 AA target where practical
- Tenant theme contrast guardrails

Every module must answer: what does the user need to do, what is the fastest safe way, what can be automated, what errors are likely, how can the user recover, and what insight should be shown after completion.

### Component Libraries and Sourcing Strategy

RetailOS UI is composition-first. Every component is copy-paste and owned in-repo (shadcn philosophy), never an opaque runtime dependency. Four layered sources:

1. shadcn/ui — the foundation. Owned, accessible primitives and core app components (forms, data tables, dialogs, sidebar, navigation, command palette, charts). Default for all functional UI.
2. shadcn studio (free/open tier) — variant blocks and component demos that fill gaps shadcn core leaves (rich comboboxes, settings panels, auth screens, dashboard blocks), plus the Theme Generator for producing white-label token sets. Premium templates are Pro.
3. Magic UI (free, MIT) — Motion-powered animated components and effects (animated lists, bento grids, marquees, kinetic/animated text, number tickers, bordered beams, ripples, particle/animated backgrounds, globe, terminal animation). Use for marketing/storefront, onboarding delight, and selective dashboard accents.
4. Magic UI Pro / shadcn studio Pro / shadcnblocks (premium) — pre-assembled landing/marketing sections and templates. Use for the public marketing site and storefront scaffolding only.

Selection rule per surface: operational density and speed first (shadcn core + Base UI), motion and delight second (Magic UI), and only where it never slows a cashier, warehouse worker, or accountant. Animated effects belong on marketing, storefront, onboarding, auth, and dashboards — never on the POS checkout path or high-frequency data entry.

### Registry and MCP Authentication (Required Setup, Phase 0)

Source components through the shadcn CLI registries and MCP so Claude Code / Codex can browse and install by name.

- Configure registry namespaces in `components.json`:
  - `@shadcn` — public, no auth.
  - `@magicui` — Magic UI free, public, no auth (`npx shadcn@latest add @magicui/<component>`).
  - `@shadcn-studio` / `@ss-blocks` / `@ss-components` / `@ss-themes` — shadcn studio (Pro; requires `EMAIL` + `LICENSE_KEY`).
  - `@magicui-pro` — Magic UI Pro; premium; requires the `MAGICUI_PRO_REGISTRY_TOKEN` Bearer token.
  - `@reui` — ReUI, free MIT, no auth.

  (The live-verified namespaces, endpoints, and counts are in the Verified Component Inventory and Four-Tier Sourcing subsection below, which is authoritative.)
- Authenticated/private registries use a Bearer header that reads from an environment variable; never inline a token:
  - `components.json`: `registries["@vendor"] = { "url": "...", "headers": { "Authorization": "Bearer ${VENDOR_REGISTRY_TOKEN}" } }`.
  - Set `VENDOR_REGISTRY_TOKEN` (and shadcn studio Pro / Magic UI Pro tokens) in `.env.local` or shell/IDE env. Never commit tokens. Treat registry tokens as secrets under the Secrets policy (§25/§36).
- Configure the shadcn MCP server (and shadcn studio MCP) in the IDE (Claude Code, Codex, Cursor, VS Code) and install via natural language. In Claude Code, `/mcp` debugs the server.
- Licenses (shadcn studio Pro, Magic UI Pro) authenticate the local CLI/IDE only. Do not place license keys in source, this charter, or shipped artifacts.
- Always review code installed from any third-party/community registry before committing. Re-theme every installed block to RetailOS tokens; never ship a block with foreign hardcoded colors, radii, or fonts.

### Primitive Choice: Base UI

Use Base UI as the headless primitive layer under shadcn (shadcn supports Radix or Base UI; choose one project-wide and scaffold with the Base UI option). Rationale: consistent component API, strong accessibility (ARIA, focus trapping, keyboard nav), first-class enter/exit transition hooks, RTL support, active roadmap. Do not mix Radix and Base UI variants of the same component in one project.

### Corner / Radius System (Rounded, But Deliberate)

The product reads as soft, friendly, and rounded — appropriate for business users — driven by tokens, not blanket utility classes. Define a radius scale and reference the token; do not paste `rounded-xl` onto everything (uniform max-radius on every element reads as generic).

- Token: `--radius` drives the scale; tenant overrides via `tenant_ui_config` (`border_radius`, `button_radius`, `card_radius`).
- Default scale: cards/sheets/dialogs/popovers large; buttons/inputs/selects medium; badges/avatars/toggles/switches/chips pill (full); dense table cells and data-grid controls small.
- Bigger radius on large surfaces, smaller on dense ones, pill only on small status/identity elements — consistent through the scale, not by repeating one class.
- White-label: a tenant may flatten to radius 0 or round more; all components must read the token so a tenant theme reshapes corners globally.

### Motion and Animation Strategy

Motion is purposeful and performance-bound, using Motion (the engine Magic UI and shadcn studio variants are built on) plus Base UI transition primitives.

- Animate only `transform` and `opacity`. Never `transition: all`.
- Always honor `prefers-reduced-motion: reduce` — entering content settles to final state; exits are instant.
- Base UI enter/exit: use `data-[starting-style]`/`data-[ending-style]` for CSS transitions and `data-[open]`/`data-[closed]` for keyframe animations on popovers, dialogs, menus, selects; use the `render` prop to compose with Motion where JS animation is needed (keepMounted components animate via `render` + state).
- High-impact moments over scattered micro-interactions: one orchestrated page/dashboard load with staggered reveals beats twitchy hovers everywhere.
- Per-surface motion budget:
  - POS checkout path: near-zero; only instant state feedback (button press, line-item add, payment confirm). Speed over delight.
  - Warehouse/scanning: minimal; scan-success/scan-error feedback only.
  - Admin/accounting tables: subtle row/skeleton transitions; no decorative motion.
  - Dashboards: animated number tickers, chart enter animations, staggered card reveals (tasteful).
  - Storefront/marketing/onboarding/auth: full Magic UI palette acceptable within reduced-motion rules.
- Use Sonner (toast) for transient feedback and skeletons for loading; never block the UI on animation.

### Typography and Design Tokens

- Default theme fonts: Geist (UI/sans) + JetBrains Mono (money, quantities, SKUs, codes, terminal/log views). Use tabular/monospaced figures wherever money and counts align in tables and receipts.
- All theme values are CSS custom properties (Tailwind v4, OKLCH/HSL). Components read tokens; nothing hardcodes color/radius/font. This is the white-label contract (§11).
- Produce per-tenant token sets with the shadcn studio Theme Generator (and its Contrast Checker) or tweakcn; validate WCAG AA contrast before saving a tenant theme (enforced by tenant theme contrast guardrails, §11).
- Density: support comfortable and compact density (driven by `tenant_ui_config` `layout_density`/`table_density`). Dense for admin/accounting; comfortable/large-target for POS and warehouse.

### Surface-by-Surface Component Map

- POS: Button/Button Group, Command (product search), Combobox (customer/sales-rep lookup with avatar+email option rows), large category quick-button grid, Dialog/Sheet (cart, payment, split-payment), Tabs (payment methods), Input/Input Group (qty, price override), Sonner, Kbd (shortcut hints), Drawer (held sales). Large touch targets, monospaced totals, always-visible offline status badge.
- Warehouse / mobile (Expo): big-target Buttons, scanner-friendly Inputs, Sheet/Drawer for pick/pack, Progress for task completion, Badge for bin/zone, Empty states for cleared queues. Tablet-first.
- Admin / data tables: shadcn Data Table (TanStack Table) with virtualization for >50 rows, faceted filters, saved views, column visibility, Pagination, bulk-action toolbars, Context Menu row actions, Sidebar nav, global Command palette. Compact density.
- Accounting: spreadsheet-like Data Tables, Tabs for ledgers, posting-status Badges, journal forms (TanStack Form + Field), reconciliation split views (Resizable), audit-trail Sheet. Tabular figures throughout.
- Executive dashboards: shadcn Chart (recharts) for trends, Magic UI number tickers for KPIs, staggered Card reveals, Magic UI bento grid for the overview, drilldown via Dialog/Sheet, date-range Calendar/Date Picker. Insight cards reference correlated insights (§27).
- Ecommerce storefront: Magic UI Pro / shadcn studio Pro sections for hero/marketing, animated product cards, Marquee for brands/announcements, Carousel for collections, tasteful Magic UI backgrounds; shadcn forms for checkout; tenant-brand tokens.
- Auth & onboarding: shadcn studio auth blocks (two-column login), Better Auth-wired forms, Captcha, Input OTP, tenant-branded login (hostname-resolved), guided setup wizards (multi-step forms + Progress/Stepper), Magic UI delight on success screens.
- Platform / MSP console: dense Data Tables (tenants, billing, health), status Badges, charts (MRR, usage), always-visible audited impersonation banners, feature-flag Switches, residency/attestation panels.

### UI Guardrails

- Mount TooltipProvider at the app layout root; recent shadcn Tooltip changes cause blocks/components using Tooltip to error without it.
- Virtualize any list/table over ~50 rows (POS product grids, large admin tables).
- Images/media need explicit width/height (prevent CLS); below-fold lazy-load; preconnect to CDN/object-storage domains.
- `touch-action: manipulation` on tappable POS/mobile controls; `overscroll-behavior: contain` in modals/drawers/sheets.
- Destructive actions (void, refund, delete) require confirmation or undo, never immediate (ties to approval workflows, §22).
- Icon-only buttons need `aria-label`; visible `focus-visible` rings; semantic button/link; labels bound to inputs; inline field errors with focus-to-first-error.
- Set `color-scheme` and meta `theme-color` for dark themes; truncate/line-clamp/break-words on text containers; `min-w-0` on flex children that truncate.
- Never use localStorage/sessionStorage for app state; use in-memory/Query state and the form-factor offline store engine (§4).

### Verified Component Inventory and Four-Tier Sourcing (repo audit)

The complete, enumerated inventory lives in the repo at `docs/architecture/ui-inventory/` (`INDEX.md`, `shadcn-core.md`, `shadcn-studio.md`, `magic-ui.md`, `magic-ui-pro.md`, `reui.md`, `origin-ui.md`, `shadcnblocks.md`, `gaps-and-custom.md`, `retailos-surface-map.md`). It is the source of truth for available items; this section gives the durable rules, the sourcing tiers, and the curated picks. Re-validate the inventory's Use/Maybe/Skip verdicts against this §5 whenever either changes.

Four-tier sourcing strategy:

1. Free foundation — shadcn/ui core (`@shadcn`, built-in): 414 items (56 primitives, 101 blocks incl. 74 charts, 5 themes). The owned base for everything.
2. Free ecosystem — ReUI (`@reui`, MIT): data-dense components (Data Grid, Filters, Kanban, File Upload) for operational surfaces. Origin UI was evaluated and NOT adopted (legacy/maintenance-only); shadcnblocks was evaluated and deferred (it overlaps shadcn studio Pro and needs a separate paid license) — its verified config is preserved in `shadcnblocks.md` for future use.
3. Premium — shadcn studio Pro: 735 blocks across 61 categories (all live-verified) for dense app/dashboard/ecommerce/auth surfaces; Magic UI Pro (`@magicui-pro`): 103 items (100 blocks / 14 categories) for marketing/motion; Magic UI free (`@magicui`): 245 items / 77 components.
4. Custom — the ~13 RetailOS-specific builds enumerated in `gaps-and-custom.md` (offline-status indicator, fiscal/thermal receipt preview, cash-drawer & shift panel, split/multi-currency payment pad, bin/zone scan UI, landed-cost allocator, bonded-vs-released stock view, barcode/label designer, and others), built in `packages/ui` on shadcn/Base UI primitives — owned and token-themed.

Verified registry/config facts (confirmed against official docs and empirically with `shadcn info`/`search`; live-verified):

- Registry keys in `components.json` MUST start with `@`, and each registry `url` MUST contain the `{name}` placeholder; missing either invalidates the whole file and silently disables all registries.
- Some registries are STYLE-PARAMETERISED — the URL carries a style segment, e.g. shadcn studio `…/r/{style}/{name}.json` and ReUI pinned to its `base-nova` style — not just `{name}`. Confirm the exact template and any required params per registry.
- There is no `--registry` flag; install by namespaced name (`@magicui/marquee`, `@reui/data-grid`) or a full item URL.
- The shadcn CLI supports Vite/TanStack Start; "TanStack Start = MCP-only" is false.
- The shadcn MCP reads the ROOT `components.json`; registries are mirrored into BOTH the root and `packages/ui` configs (CLI installs use `-c packages/ui`).
- A schema-valid registry entry is not proof it resolves, and registry item slugs can differ from display names (ReUI `file-upload` → `use-file-upload`; shadcnblocks `hero1`, not `hero-1`). Confirm endpoints and slugs with a live probe.
- Advertised catalog counts are not always enumerable (e.g. shadcnblocks' ~1,665 has no public index); state only enumerated counts.

Configured, working registries (credentials in gitignored `.env`, from Infisical; never committed):

- `@shadcn` (built-in, no auth) — 414 items.
- shadcn studio (`@shadcn-studio` / `@ss-blocks` / `@ss-components` / `@ss-themes`): `EMAIL` + `LICENSE_KEY` set; enumerated via the studio MCP (`get-block-meta-content` per category) and driven by the `/cui /iui /rui /ftc` workflows. shadcn-native — installs owned primitives as `registryDependencies`, CSS/Radix micro-motion, no animation runtime — so it is safe on dense surfaces.
- `@magicui` (free, no auth) → `magicui.design/r/{name}.json`; `@magicui-pro` (Pro, token set) → `pro.magicui.design/registry/{name}` with `Bearer ${MAGICUI_PRO_REGISTRY_TOKEN}`. Magic UI is Framer-Motion / Next-oriented: components are framework-agnostic React, but Pro page templates need porting to Vite/TanStack; note the `@radix-ui/react-icons` gotcha (`StarFilledIcon` → lucide `Star fill="currentColor"`).
- `@reui` (MIT, no auth) — pinned to ReUI's `base-nova` style; no searchable index, so install by known slug.

Curated picks by surface (full rationale in `retailos-surface-map.md`):

- Dense operational surfaces (POS, warehouse, admin, accounting, dashboards) — shadcn core + shadcn studio + ReUI (no Framer-Motion runtime). ReUI Data Grid / Kanban / Filters and the studio DataTable variants map almost 1:1: `datatable-01` financial transactions (accounting / POS settlement), `datatable-05` invoices (billing), `datatable-06` product/inventory with CSV/Excel/JSON export, `datatable-07` product analytics (embedded Recharts), `datatable-04` user administration (admin/MSP), `datatable-03` fleet/routes (logistics/dispatch); plus Application/Dashboard Shell, Statistics (KPI cards), Multi-step Form (wizards/onboarding), and shadcn core charts. Disable chart enter-animations on live data.
- Storefront / marketing / onboarding / auth — shadcn studio eCommerce set (product-list/overview/quick-view/category, category-filter, product-reviews, shopping-cart, checkout-page, order-summary, mega-footer) and studio auth (Login/Register/Forgot/Reset plus 2FA and Verify-Email, which shadcn core lacks); Magic UI for motion and delight — `number-ticker` and `animated-circular-progress-bar` (KPI/onboarding), `confetti` (onboarding / order-placed success only), `marquee` + `avatar-circles` (social proof), `bento-grid`, `hero-video-dialog`, and the Magic UI Pro marketing sections (Hero / Pricing / CTA / FAQ / Footer). Magic UI never goes on the POS checkout or high-frequency data-entry paths (speed/density rule).
- Native (Expo, `apps/native`) — these registries are web-only; track NativeWind / a React-Native UI kit separately for the mobile app.
- Everything pulled from any source MUST be re-themed to the RetailOS design tokens; never ship a block with foreign hardcoded colors, radii, or fonts.

### Official Shadcn Toolchain

Scaffold UI components only through the official shadcn CLI (`npx shadcn@latest add <component>` — not the deprecated `@shadcn/ui` package) or the official shadcn MCP / skill (installed under `.agents/skills`). Do not hand-write shadcn or Base UI primitives from memory. Always fetch the latest definitions from the registry so components stay compatible with the project's pinned React and TanStack versions.

---

## 6. Better Auth Strategy

Use Better Auth as the foundational identity layer. Do not manually reinvent sessions, organization membership, invitations, base roles, API keys, device authorization, 2FA, captcha, or SSO-ready flows if Better Auth can handle them.

Required or planned plugins:

- Organization: organizations, members, teams, invitations, active organization context, base organization access control.
- Admin: user administration, user suspension, support impersonation, bans/unbans. All impersonation must be audited.
- Two-Factor Authentication: TOTP, OTP, backup codes, trusted devices; mandatory for platform admins, tenant admins, finance users, and high-risk roles.
- API Key: integrations, supplier APIs, webhooks, external reports, service-to-service workflows.
- Device Authorization: POS terminals, warehouse tablets, kiosks, scanner stations, limited-input devices, Tauri clients, mobile warehouse devices.
- Captcha: login, signup, password reset, public storefront auth, abuse prevention.
- SCIM: enterprise/government/healthcare provisioning and deprovisioning from corporate IdPs.
- Have I Been Pwned: compromised-password checking.
- i18n: translated Better Auth error messages.
- Passkeys, SSO, OIDC Provider, OAuth Provider, JWT/Bearer where needed.
- Billing plugins should be evaluated for Stripe, Polar, Chargebee, and similar auth-linked subscription workflows.

Better Auth access-control boundary:

- Better Auth should handle coarse organization/admin roles.
- RetailOS Entitlements Service should handle fine-grained ERP permissions, feature flags, subscription entitlements, company/location access, approval rules, and license constraints.
- The Entitlements Service takes Better Auth session and active organization context as input.
- Do not duplicate or fight Better Auth’s organization model.

---

## 7. Authorization and Entitlements Model

Authorization layers:

1. Platform
2. Tenant
3. Company
4. Location
5. Module
6. Action
7. Approval workflow
8. Feature flag
9. Subscription/license entitlement
10. Device authorization
11. Offline entitlement snapshot

Every protected action validates session, active organization, tenant scope, membership, role, permission, company/location access, feature flag, subscription/license entitlement, device authorization if applicable, and approval requirement if applicable.

Example permissions:

- products.view/create/edit/archive
- inventory.view/adjust/transfer/receive/approve_adjustment
- pos.open_shift/create_sale/refund/void_sale
- accounting.view/create_journal/approve_journal
- banking.view/reconcile
- crm.view/create_lead/manage
- procurement.create_po/approve_po
- warehouse.receive/pick/pack/dispatch
- bond.release/approve_release
- ecommerce.manage_products/manage_orders
- reports.view
- audit.view
- settings.manage
- users.invite/disable
- platform.manage_tenants

Cashiers must only access POS-related features unless explicitly granted more. Finance users must not automatically have warehouse permissions. Warehouse users must not automatically have financial permissions.

---

## 8. Platform, Tenant, and Organization Architecture

Platform Owner is not a tenant. Platform data and tenant data must be logically separated.

Hierarchy:

Platform
└── Tenant
    ├── Companies
    ├── Locations
    ├── Users
    ├── Employees
    ├── Subscription / License
    ├── Feature Flags
    ├── Branding
    ├── Integrations
    ├── Settings
    └── Data

Tenant → Company → Location, where locations may be retail stores, warehouses, bonded warehouses, distribution centers, service centers, or ecommerce fulfillment centers.

Every tenant-owned table must include tenant_id, created_at, updated_at, deleted_at where appropriate, created_by where appropriate, and updated_by where appropriate.

No hard deletes for operational records except legally required erasure workflows handled via crypto-shredding or legally approved deletion workflows.

Tenant isolation by deployment model:

- Multi-tenant SaaS: shared schema + tenant_id + PostgreSQL RLS.
- Dedicated cloud: database-per-tenant.
- Managed private: database-per-tenant.
- Self-hosted: customer-managed database.

Migration fan-out must support shared SaaS DB, many dedicated DBs, managed private deployments, self-hosted deployments, and Edge Hub DBs. Use expand/contract migrations: add, backfill, switch, verify, drop later. Never ship destructive migrations in the same release that begins using the new shape.

Noisy-neighbor mitigation: the backend enforces tenant-aware rate limiting (a token-bucket keyed by `tenant_id`), and heavy tenant tasks (e.g. large CSV imports) run on isolated background worker nodes so one tenant's load cannot exhaust shared resources or degrade platform latency for others.

---

## 9. Deployment Modes, Data Sovereignty, and Residency

RetailOS must support:

1. Multi-Tenant SaaS: shared app cluster, PostgreSQL, Redis, and object storage with strict tenant isolation and RLS.
2. Dedicated Single-Tenant Cloud: dedicated database, Redis, object storage, domain, SMTP, backups.
3. Managed Private Instance: RetailOS team hosts/manages infrastructure; customer owns license or private subscription.
4. Self-Hosted Enterprise: customer deploys on Docker, Docker Compose, or Kubernetes.

Business logic must remain identical across deployment modes.

Data sovereignty requirements:

- Database endpoint, Redis endpoint, object-storage endpoint, backup target, replica target, email egress, webhook egress, and observability/logging endpoints must be environment-configurable.
- No hardcoded AWS, Vercel, US, or external-region assumptions.
- Object storage must support self-hosted MinIO.
- Backups, replicas, and DR targets must be pinnable to in-country or in-region locations.
- Provide per-tenant data residency attestation: where DB/files/backups/logs live, where email is sent from, what data leaves the region, and which integrations transmit externally.
- Business logic must not assume managed services with no in-region equivalent.

---

## 10. Licensing, SaaS Billing, Feature Flags, and Platform Owner Mode

Commercial models:

- Monthly subscription
- Annual subscription
- Usage-based subscription
- Perpetual license
- Annual maintenance/support contract
- Enterprise contract
- Trial license
- Suspended license

Billing provider support:

- Stripe
- Paddle
- LemonSqueezy
- Polar
- Chargebee
- Future providers

Evaluate Better Auth billing plugins where useful.

Feature access requires user permission, feature flag, subscription/license entitlement, and usage limit checks.

Feature flags include:

- ecommerce_enabled
- crm_enabled
- accounting_enabled
- warehouse_enabled
- bond_management_enabled
- api_access_enabled
- advanced_reporting_enabled
- whatsapp_enabled
- custom_domain_enabled
- custom_smtp_enabled
- edge_hub_enabled
- hardware_bridge_enabled
- multi_company_enabled
- multi_currency_enabled
- white_label_enabled
- scim_enabled
- sso_enabled
- fiscalization_enabled

Platform Owner / MSP mode supports tenant health, backups, integrations, storage usage, sync health, offline terminals, Edge Hub health, billing, MRR, tenant suspension/reactivation, impersonation with audit, feature flags, subscription plans, license status, data residency attestations, deployment mode, self-hosted version status, and migration status.

---

## 11. White-Label Architecture

RetailOS must support:

- Custom domains/subdomains
- Tenant-specific logos, colors, typography, favicon
- Tenant-specific login pages
- Tenant-specific receipt/invoice/email templates
- Tenant-specific storefront themes
- Tenant-specific dashboards
- Tenant-specific SMTP and sender names

tenant_ui_config JSONB must include primary/secondary/accent colors, border radius, font family, logo URLs, favicon URL, receipt/invoice logos, storefront theme, dashboard theme, mode preference, layout density, table density, button/card radius, contrast mode, and accessibility flags.

Hono/TanStack Start router must resolve tenant_id from hostname.

Better Auth login must render tenant-specific branding based on hostname.

Tenant themes must respect accessibility contrast requirements.

---

## 12. Caribbean / Developing Market Requirements

Support:

- Unstable internet
- Power outages
- Generator-backed stores
- Cloud-first database
- Offline-capable POS
- Multi-currency drawers
- USD/GYD and other currencies
- Exchange-rate tracking
- Split-currency payments
- Cash-heavy operations
- Manual bank transfers
- VAT/GST
- Tax-exempt customers
- Wholesale customers
- Bonded warehouses
- Customs duties
- Landed costs
- Freight charges
- Supplier payments
- Import batches
- End-of-day reconciliation
- Local bank transfer proof
- Cash float management
- Manual payment confirmation workflows

Store timestamps in UTC and render by tenant/company/location/user timezone. A tenant may have stores in multiple countries.

Design i18n from day one for English, Spanish, Dutch, French, Portuguese, and future languages. Country configuration must be data-driven and not hardcoded to Guyana only.

---

## 13. Offline-First Architecture

RetailOS supports three offline levels:

1. Single-Terminal Offline Mode: one POS terminal loses internet and continues using local offline storage.
2. LAN Edge Offline Mode: store loses internet but LAN remains active; multiple terminals communicate with Local Edge Hub.
3. Cloud Online Mode: normal sync with cloud backend and WebSocket events.

Local offline structures include offline_sales_queue, offline_inventory_queue, offline_transfer_queue, offline_payment_queue, offline_refund_queue, pending_sync_logs, cached_products, cached_prices, cached_customers, cached_tax_rules, cached_sales_reps, cached_location_settings, cached_payment_methods, cached_receipt_templates, cached_entitlements, cached_permissions, cached_feature_flags, and cached_number_blocks.

Offline behavior:

- Reads from local cache.
- Sales/payments/refunds queue locally.
- Local stock is deducted/reserved according to conflict policy.
- Receipts generate locally.
- End-of-day shows local totals and last synced totals.
- Offline entitlement snapshot controls allowed features.
- Device-token grace controls offline operating window.

Reconnect behavior:

- Sync sequentially with idempotency keys.
- Resolve server timestamps.
- Detect conflicts.
- Reconcile local/server state.
- Clear successful queue entries.
- Keep failed entries visible.
- Upcast older payload versions.
- Never silently discard offline transactions.

---

## 14. Offline Conflict, Time Integrity, and Reconnection Avalanche

Append-only events such as sales, payments, stock ledger entries, audit logs, and sync logs must not conflict by overwrite; replay in order with idempotency keys.

Mutable shared state such as stock-on-hand, price, customer balance, tax settings, and entitlements must not use last-write-wins blindly. Ledger truth and reconciliation must dominate.

Oversell policy must be chosen per tenant/location:

1. Allow oversell with flagged backorder.
2. Hard local reservation through Edge Hub.
3. Optimistic deduction with compensating correction on sync conflict.

Whatever policy is chosen, stock ledger must reconcile, conflicts must be visible, managers must be alerted, and no movement may be lost or duplicated.

Offline device clocks are untrusted. Every offline mutation must include device ID, terminal ID, monotonic counter, local timestamp, payload version, and idempotency key. Server time is authoritative for accounting periods, fiscal postings, and official posting time.

Reconnection avalanche mitigation:

- Use Redis queues.
- Apply backpressure and rate limits.
- Batch sync events.
- Process sync queues safely.
- Avoid database lock storms and API timeouts.
- Validate idempotency keys.
- Use sync batch IDs.
- Track queue depth and failed sync batches.
- Provide retry tools and alerts.

---

## 15. Edge Hub Architecture

RetailOS must support an optional Dockerized Edge Sync Hub for supermarkets, high-volume stores, multi-register retail, warehouses, and unreliable-WAN/stable-LAN sites.

Deployable on mini PC, local server, back-office workstation, NAS, Docker host, or Proxmox VM/LXC.

Responsibilities:

- Accept POS transactions over LAN.
- Maintain local transaction queue.
- Coordinate local stock reservations.
- Prevent duplicate local sale where possible.
- Maintain local cashier shift state.
- Maintain local receipt/document number blocks.
- Sync upstream to cloud.
- Resolve cloud conflicts.
- Show local health.
- Export unsynced transactions.
- Log sync activity.
- Support device registration and terminal authorization.
- Support local backup of unsynced transactions.

Cloud remains source of truth. Edge Hub is optional; small businesses must operate without it.

Edge Hub local disaster recovery: beyond upstream cloud sync, the Edge Hub runs continuous automated local backups of its Postgres/SQLite state to a separate physical medium (a mounted USB drive, a LAN-attached NAS, or a back-office PC), so an extended internet outage followed by hardware loss does not permanently destroy the offline transactions that never reached the cloud.

---

## 16. Hardware Bridge Architecture

Tauri desktop is preferred for POS hardware access because it can use native hardware through Rust/plugin APIs without browser sandbox limitations.

Support ESC/POS printers, cash drawers, barcode scanners, label printers, pole displays, scales, kitchen printers, and customer displays.

Access methods:

- Tauri native plugins/Rust bridge
- WebUSB
- WebSerial
- WebHID
- Bluetooth where appropriate
- Local hardware daemon where browser APIs are insufficient

Hardware daemon may be Windows service, macOS helper, Linux daemon, or local HTTP/WebSocket service.

Security:

- Bind to localhost or trusted LAN only.
- Require pairing/token authorization.
- Reject unauthorized origins.
- Support unpair/revoke.
- Log all hardware actions.

Hardware abstraction must be transport-independent so business code does not care whether the printer/cash drawer is controlled by Tauri, WebUSB, or daemon.

---

## 17. Fiscalization, E-Invoicing, and Document Number Integrity

Reserve a pluggable fiscalization seam from day one. Support country-specific fiscal providers, fiscal receipt signing, fiscal device/printer integration, tax-authority submission/clearance, e-invoice status tracking, credit-note fiscal documents, cancellation/void fiscal rules, and fiscal logs.

Confirm Guyana GRA requirements before launch. Do not hardcode one country’s fiscal rules.

Receipts, invoices, credit notes, debit notes, purchase documents, and journal entries require sequential tamper-evident numbering per company, location, fiscal year, document type, and numbering series.

Offline terminals must reserve number blocks issued by cloud or Edge Hub. Never let two terminals mint the same number. Track gaps, voids, out-of-sequence documents, unused reserved numbers, and expired number blocks.

Credit note is a first-class fiscal document type, not merely a refund flag.

---

## 18. Inventory, Warehouse, Bond, Procurement, and Product Engine

Inventory must be ledger-based, never simple counters.

Support products, variants, SKUs, barcodes, QR codes, serial numbers, batch numbers, lot numbers, expiry dates, units of measure, categories, brands, images, videos, bundles, kits, assemblies, reorder levels, min/max stock.

Inventory states: available, reserved, damaged, lost, in transit, bonded, released, returned, quarantined, expired.

Valuation: FIFO, LIFO, weighted average.

Stock movement types: opening balance, purchase receipt, sale, return, refund, adjustment, transfer out/in, damage, loss, expiry, bond release, assembly build/disassembly, reservation, reservation release.

Vertical requirements:

- Pharmacy/supermarket: FEFO picking, batch/expiry tracking, expiry alerts.
- Wholesale/distribution: multi-UoM conversions; buy cartons, stock units, sell cartons or units.
- Supermarket: weight/price embedded barcode parsing and scale integration.
- Electronics: serial capture at receiving, sale, warranty, and RMA.

Warehousing supports zones, aisles, racks, shelves, bins, receiving, putaway, picking, packing, dispatch, internal transfers, stock counts, cycle counts, replenishment, and returns handling.

Bonded warehouse supports import batches, supplier invoices, customs references, freight, insurance, duty/VAT estimates, landed cost, duty clearance workflow, bond release approval, bond-to-store transfer, released stock posting, customs docs, and clearance status. Bonded and released inventory must be separate.

Procurement supports suppliers, supplier contacts, purchase requests/orders, approvals, GRNs, partial receiving, supplier invoices, vendor credits/payments, landed costs, import batches, container tracking, freight tracking, customs references, bond receiving, purchase history, supplier performance, and reorder suggestions.

Applied AI and OCR seam: reserve a pluggable architectural seam for intelligent document processing. The system must eventually support OCR and LLM-based parsing of supplier invoices, goods received notes, purchase orders, and customs documents to auto-populate line items, quantities, and costs, eliminating manual procurement data entry. Implement behind a provider interface (consistent with the fiscalization, tax, and payment provider pattern), tenant-scoped, with mandatory human review and confirmation before posting, and full audit of AI-extracted versus user-corrected values.

---

## 19. POS, Commission, Money, Pricing, and Tax

POS must support touch interface, barcode scanning, product search, category quick buttons, customer lookup, price override with permission, discounts with permission, tax calculation, split payments, multi-currency payments, receipt printing, cash drawer, shift open/close, cash reconciliation, returns, refunds, exchanges, store credit, offline sale support, local receipt generation, sales rep dropdown, gift cards, customer display, loyalty lookup, hold/resume sale, and reprint receipt.

Payment methods: cash, card, bank transfer, mobile money, cheque, store credit, gift card, mixed payments.

Commission engine: cashier selects Sales Representative at checkout. Support flat, percentage, product-level, category-level, sales-rep-level, tiered commission, reports, statements, payouts, refund adjustments, and void adjustments.

Fast cashier switching: support rapid register switching and time-clock punching via 4-digit PIN, RFID/NFC badge, or biometric scanner, so a cashier stepping away does not require full email/password/2FA re-entry. This is a fast local re-authentication layered on top of an already device-authorized terminal: the terminal holds device trust (Better Auth device authorization, §6) and the PIN/badge/biometric resolves the cashier identity for the shift. Every switch, override, void, and punch is fully audit-logged to the resolved user. PIN/badge/biometric verification must work offline within the device-token grace window (§13, §14). Biometric templates are sensitive PII: store only non-reversible templates or hashes, never raw biometrics, governed by the PII and crypto-shredding policy (§25); never sync raw biometric data to the cloud.

Money rules:

- Store and compute monetary values as integer minor units only; never floats.
- Store amount, currency code, and minor-unit scale together.
- Do not assume all currencies have two decimals.
- Define one rounding policy and apply it consistently.
- FX conversion must produce realized/unrealized gain/loss entries where applicable.

Pricing supports price lists, customer group pricing, wholesale tiers, time-bound promotions, volume/tiered pricing, BOGO, mix-and-match, permissioned override, and promotion precedence. Support tax-inclusive and tax-exclusive pricing centrally.

Tax engine supports VAT, GST, compound/stacked taxes, tax-on-tax, withholding, reverse charge, tax-exempt certificates, multi-jurisdiction rates, line-item tax, and consistent tax rounding.

Gift cards and store credit are liabilities, not revenue on issue. Recognize revenue on redemption. Include fraud controls, balance audit, expiry rules where legally allowed, and redemption history.

X and Z reports: generate standard retail X-Reports (mid-shift snapshots) and Z-Reports (end-of-day final settlement) per terminal and shift.

Blind shift close: the cashier enters the physically counted drawer cash without the system showing the expected amount; the system computes the over/short discrepancy for the manager's audit log (shrinkage control), tied to the approval and audit trail (§22, §25).

Hardware payment terminals (EFTPOS): cleanly distinguish Standalone card payments (the system only records that a card was used) from Integrated terminal payments (the POS pushes the exact amount to the terminal over local IP or a provider API such as Stripe Terminal), to eliminate double-entry cashier errors. Relates to the hardware bridge (§16).

---

## 20. Accounting Module

Accounting must be planned from day one with double-entry accounting.

Support chart of accounts, general ledger, journal entries, AP, AR, invoices, supplier bills, vendor payments, customer payments, bank accounts, bank reconciliation, cash accounts, POS cash clearing, inventory asset, COGS, sales revenue, tax payable, VAT payable, duty payable, freight clearing, landed cost allocation, expenses, budgeting, P&L, balance sheet, cash flow, trial balance, multi-currency, exchange rates, revaluation adjustments, approvals, posting periods, period closing, and audit-ready trail.

Future integrations: QuickBooks, Xero, Zoho Books, Sage, Wave, Odoo/ERPNext import/export, CSV/Excel accounting export.

---

## 21. CRM, Ecommerce, Assets, HR, Service, and Manufacturing

CRM supports leads, opportunities, accounts, contacts, customer profiles/groups, wholesale customers, loyalty tiers, purchase habits, CLV, follow-ups, notes, documents, activity history, pipeline, balances, credit limits, store credit, segmentation, email/SMS/WhatsApp logs, and service cases.

Ecommerce uses the same inventory database and stock ledger as POS. Support storefront pages, catalog, PDPs, categories, collections, search, filters, cart, checkout, accounts, guest checkout, coupons, promotions, reviews, wishlist, order tracking, pickup/delivery, fulfillment location, payment callbacks, media, SEO, branding, and online fulfillment. Never create separate ecommerce inventory.

Asset management supports categories, assets, serials, purchase date, warranty expiry, assigned employee/location, maintenance schedule/history, transfers, disposal, depreciation, book value, documents, images.

HR/staff supports employees, departments, roles, locations, sales reps, cashiers, commission rules/statements/payouts, performance dashboards. Better Auth users and employee records are linked but not the same.

Service/repair module is planned for service orders, repair tickets, diagnostic notes, customer devices, serials, warranty, parts, labor, technician assignment, status, approval, pickup/delivery.

Manufacturing/assembly is planned for kits, bundles, BOMs, assemblies, recipe products, build orders, disassembly, and component stock deduction.

---

## 22. Documents, Print Templates, Notifications, and Workflows

Document management supports invoices, quotes, receipts, purchase orders, supplier invoices, customer documents, product images, warranty documents, import/customs docs, asset docs, staff docs, contracts, version history, access control, audit trail, expiry reminders, categories.

Print templates support thermal receipts, PDF invoices, quotes, delivery slips, transfer slips, GRNs, barcode labels, price labels, warranty forms, fiscal documents, logo, footer, return policy, tax ID, address, custom notes, promotional text, terms, fiscal QR/text. Use WYSIWYG or HTML builder.

Notifications support email, SMS, WhatsApp, in-app, webhooks. Events include low stock, transfer approval, bond release approval, PO approved, invoice overdue, order ready, ecommerce order received, shift closed, suspicious void/refund, terminal resynced, Edge Hub queue stuck, failed payment/accounting/fiscal submission, backup failure, usage limit, numbering gap, stock conflict.

Workflow/approval engine handles inventory adjustments, voids, refunds, bond releases, credit extensions, vendor payments, PO thresholds, journal approvals, bank reconciliation, price/discount overrides, user role changes, tenant suspension, custom domain, fiscal number series, SMTP, integration credentials.

---

## 23. Integration, Webhooks, and Idempotency

Integrations must be loosely coupled using API keys, OAuth, webhooks, event subscriptions, retry queues, replay, and logs.

Targets: QuickBooks, Xero, Zoho Books, Sage, Wave, Shopify, WooCommerce, Twilio, WhatsApp Business, email providers, Stripe, Paddle, LemonSqueezy, Polar, Chargebee, PayPal, local bank transfers, regional payment providers, Open Banking where available, CSV bank imports, DHL, FedEx, UPS, local delivery providers.

Outbound webhooks require signed payloads, exponential backoff, DLQ, manual replay, delivery logs, tenant-scoped secrets, and event versioning.

Webhook dispatch standard: do not hand-roll the outbound delivery infrastructure. Evaluate and reserve a seam for a standardized webhook dispatcher (e.g., Svix or an open-source equivalent) to handle payload signing, exponential backoff, endpoint management, fan-out, and delivery-failure UIs. The dispatcher must be self-hostable so it works in self-hosted and data-sovereign deployments (§9); a managed-only dependency is not acceptable for those tiers. Keep it behind an interface so the provider can change without touching domain code.

Inbound webhooks must verify signature, enforce idempotency, tolerate out-of-order/duplicate delivery, store raw event where appropriate, and process through background jobs.

Idempotency keys are scoped by tenant + endpoint + operation and store key, request hash, response result, status, TTL/retention, and collision behavior. POS sales must be idempotent end-to-end.

---

## 24. Domain Events and Outbox Pattern

Events include tenant.created/suspended, user.invited, product.created/updated, inventory.received/adjusted/transferred, sale.created/refunded/voided, payment.received, invoice.created/paid, purchase_order.created, purchase.received, customer.created, asset.assigned, bond.released, ecommerce_order.created, sync.batch_received/failed, edge_hub.connected/disconnected, fiscal.submission_failed/accepted, document.number_gap_detected.

Events must be replayable, auditable, idempotent, tenant-scoped, correlation-ID aware, and versioned.

Future modules and integrations must subscribe to events rather than directly coupling to core business logic.

---

## 25. Audit, PII, Error Handling, Logging, and Secrets

Every mutation creates immutable audit log with tenant_id, org/company/location, actor_user_id, actor_employee_id, impersonator_user_id, action, entity_type/id, old/new JSONB, IP, user agent, device, geographic origin, request_id, correlation_id, idempotency_key, sync_batch_id, created_at.

PII must be separated where erasure rights may apply. Store erasable PII in a referenced PII vault encrypted with per-subject keys. Right-to-erasure uses crypto-shredding by destroying subject key while retaining balanced operational/audit records. Classify fields as PII, secret, financial operational, audit, public/catalog, or internal metadata.

Compliance export utility: support a one-click "Generate Auditor Package" that compiles a cryptographically verified, read-only export of a requested fiscal year's journal entries, general ledger, stock ledger, tax/fiscal documents, and relevant audit logs, formatted for tax-authority review (GRA and other regional authorities). The package must be tamper-evident (hash manifest plus signature), scoped to one company and fiscal year, gated by an audit.export permission, itself audit-logged, and must respect data residency (§9). This is both a compliance requirement and a commercial selling point.

Error handling:

- Never expose raw stack traces.
- Show friendly messages.
- Log technical detail server-side.
- Include request_id/correlation_id, tenant/user/location/device where available.
- Use structured error codes.
- Separate validation, permission, network, sync, accounting, inventory conflict, hardware, fiscal, and integration errors.
- Provide retry/escalation actions.

Structured logs include app, API, audit, sync, Edge Hub, hardware bridge, payment, accounting, background jobs, integration, security, fiscal logs. Critical alerts include failed webhooks, failed postings, failed sync, Edge Hub queue stuck, printer unavailable, migration failure, suspicious refund, repeated login failures, tenant nearing limits, backup failure, unbalanced journal, unauthorized access, fiscal failure, numbering gap, RLS violation.

Secrets: use envelope encryption for SMTP, API keys, tokens, fiscal signing keys, webhook secrets, payment secrets, SSO secrets. Master key source must be cloud KMS, self-hosted Vault, sealed secrets, or customer-managed key. Never log decrypted secrets. Redact secrets. No plaintext secrets in git.

---

## 26. Observability, Helper Tools, Data Quality, and Resilience

Observability supports metrics, logs, traces, health checks, sync monitoring, queue monitoring, job monitoring, Edge Hub monitoring, hardware monitoring, payment/integration monitoring, tenant health score, API latency, DB latency, Redis depth, failed jobs, sync depth, offline terminal count, Edge Hub status, failed webhooks/postings, slow reports, errors, storage, backup, POS checkout latency, sync lag, fiscal latency, report time.

Helper tools:

- Import/export
- Data validation
- Duplicate detection
- Product/customer cleanup
- Inventory reconciliation
- Stock count assistance
- Receipt reprint
- Invoice resend
- Sync retry
- Failed queue inspection
- Hardware test print
- Cash drawer test
- Barcode/scale tests
- SMTP test
- Custom domain verification
- Webhook replay
- Accounting retry
- Permission debugger
- Tenant/Edge Hub health check
- Backup verification
- Restore test report
- Fiscal status checker
- Document number checker
- RLS policy test tool

Data quality rules: duplicate SKU/barcode/customer, missing cost, negative margin, low stock, invalid tax, missing account mapping, unsynced terminal, unbalanced journal, unposted transaction, unreconciled drawer, missing supplier/image, expiring batch, warranty expiry, dead stock, invalid UoM, duplicate fiscal number, broken sequence, unsynced Edge Hub.

Resilience tests: reconnection avalanche load, N terminals + M Edge Hubs reconnecting, network killed mid-sync, app killed mid-sale, corrupt/duplicate queued mutation, out-of-order/duplicate webhook, inventory ledger invariant property tests, RLS bypass attempt, unbalanced journal rejection, numbering gap simulation, offline session expiry, payload version upcast.

In-app diagnostic capture: provide a "Report Issue" control in the UI that automatically bundles the current application state, offline queue depth, local SQLite/Dexie status, and correlation/request IDs into a telemetry report for support (front-end observability such as Sentry). A cashier must never need to find a request ID manually.

---

## 27. Analytics, Reporting, Insights, and Search

Dashboards: executive, store, warehouse, bond, cashier, sales rep, inventory, accounting, ecommerce, CRM, procurement, platform owner.

Reports: daily/weekly/monthly sales, sales by store/product/category/cashier/rep/payment, profit margin, product performance, fast/slow/dead stock, low stock, inventory valuation, stock movement, warehouse efficiency, bonded vs released, AR/AP aging, expense trends, cash discrepancies, offline sync health, terminal performance, customer patterns, ecommerce conversion, supplier performance, MRR, tenant usage, subscription health.

Do not run heavy analytics directly on OLTP checkout tables. Use read replicas, materialized views, CQRS read models, summary tables, star-schema-style reporting models, background report generation, and domain-event-fed analytics projections. Reports must honor tenant scope and RLS at read layer.

Correlated insights examples:

- Sales spike caused low stock.
- Product has high revenue but poor margin.
- Customer buys often but has overdue balance.
- Sales rep drives revenue but has high refund rate.
- Warehouse delays caused ecommerce fulfillment issues.
- Cashier has unusual void/refund pattern.
- Supplier delays caused stockouts.
- Product sells well online but poorly in store.
- Store has high sales but poor cash reconciliation.
- Bonded stock pending clearance is causing branch shortages.

Reports must support drilldowns, filters, saved views, Excel/PDF export, scheduled delivery, role visibility, tenant/company/location/store/warehouse/bond scopes.

Search starts with PostgreSQL FTS for small catalogs; move to Typesense, Meilisearch, or OpenSearch once catalog/query thresholds require it. Search must be tenant-scoped and behind an interface.

---

## 28. Data Import, Background Jobs, Backups, CI/CD, and Compliance

Imports support products, customers, suppliers, inventory, assets, employees, opening balances, chart of accounts, vendors, purchase history via CSV/Excel with mapping wizard, preview, validation, errors, duplicate detection, rollback, audit logging, and background jobs.

Background jobs handle sync ingestion, offline queue processing, webhooks, reports, imports, exports, email/SMS/WhatsApp, accounting postings, reconciliations, backup verification, cleanup, feature rollouts, tenant provisioning, license checks, fiscal submissions, search indexing, analytics projections, Edge Hub sync. Jobs must be idempotent, retryable, observable, tenant-scoped, and failure-visible.

Backups/DR support automated backups, PITR, cross-region or in-country backups, restore testing, backup verification, tenant export, self-hosted scripts, Edge Hub unsynced transaction export, and DR runbooks.

CI/CD supports SaaS, dedicated cloud, managed private, self-hosted, Edge Hub Docker images, hardware daemon releases, Tauri builds, native mobile builds. Include type checks, lint, unit/integration/E2E, migration checks, security checks, Docker/Tauri/mobile build checks, previews where appropriate. Migrations require review, rollback plan, pre-migration backup, staging validation, production monitoring, and fan-out strategy.

Define SLOs/performance budgets: POS checkout p95 latency, POS search latency, sync lag, API p95, report generation, payment webhook processing, Edge Hub recovery. Define RPO/RTO per deployment tier. Maintain SOC 2 / ISO 27001 roadmap controls: access reviews, change management, audit logs, encryption, backup testing, incident response, vendor risk.

Docker optimization: all images (Edge Hub, cloud backend, app images) use multi-stage builds and distroless or Alpine-based minimal production images to cut attack surface and size. CI enforces image and bundle-size limits and runs container vulnerability scanning (e.g. Trivy) before pushing to the registry.

Ephemeral QA environments: CI provisions a preview environment per pull request so UI/UX and API changes are verified in isolation before merge.

Required scripts and CI: root scripts must expose `test`, `lint`, and `check-types`, and a CI workflow must run the quality gates (§43) on every PR. (These are not yet wired in the scaffold and must be added in Phase 0/1.)

Distributed client auto-updates: distributed clients need an over-the-air update strategy. Tauri desktop apps use the Tauri updater to prompt and enforce binary updates; Expo mobile apps use EAS Update for JS-bundle patches; Edge Hubs pull updated Docker images on a secure schedule during off-peak hours (e.g. 03:00 local). Clients that fall too far behind the cloud schema are force-locked until they update (ties to the session/entitlement/payload versioning in §13).

---

## 29. Security Architecture

Security requirements:

- Tenant isolation
- PostgreSQL RLS for shared SaaS tables
- Strict RBAC/entitlements
- MFA for high-risk roles
- Captcha on auth flows
- API key scoping
- Device authorization
- Audit logging
- Impersonation logging
- Rate limiting
- IP/device tracking
- Secure secrets storage
- Encrypted credentials
- Secure SMTP/integration tokens
- Least privilege
- Permission debugging
- Security event alerts
- SCIM provisioning
- Compromised password checking
- Session/device revocation

Do not store raw payment card data unless using a compliant tokenized provider flow.

Zero-trust edge networking: Edge Hub ↔ cloud communication must be secured with mTLS or an encrypted tunnel (e.g. Cloudflare Tunnel or WireGuard) with mutual authentication and certificate rotation — never plaintext over the LAN or WAN. Complements the Edge Hub design (§15) and secrets handling (§25).

---

## 30. Initial Deliverables

Do not build code yet. First produce:

1. Architecture review
2. Gap analysis
3. Domain model
4. ERD
5. Database table map
6. Drizzle schema plan
7. PostgreSQL migration strategy
8. Mock seed data strategy
9. Folder structure
10. Monorepo structure
11. Client target strategy
12. Web/Tauri/mobile architecture
13. Better Auth strategy
14. Better Auth plugin mapping
15. Better Auth access-control boundary
16. RBAC matrix
17. Permission matrix
18. Tenant isolation strategy
19. PostgreSQL RLS strategy
20. Feature flag strategy
21. SaaS billing strategy
22. Licensing strategy
23. White-label strategy
24. Custom domain strategy
25. Custom SMTP strategy
26. Data residency strategy
27. Offline sync strategy
28. Offline conflict policy
29. Edge Hub strategy
30. Hardware bridge strategy
31. Fiscalization strategy
32. Document numbering strategy
33. Inventory ledger strategy
34. Bonded warehouse strategy
35. Money/pricing/tax strategy
36. Accounting strategy
37. CRM strategy
38. Ecommerce inventory sync strategy
39. Procurement strategy
40. Reporting strategy
41. Analytics/read-model strategy
42. Error handling strategy
43. Structured logging strategy
44. Helper tools and diagnostics strategy
45. Data quality strategy
46. Security strategy
47. Secrets strategy
48. Observability strategy
49. Disaster recovery strategy
50. Testing strategy
51. CI/CD strategy
52. Deployment strategy
53. Background job strategy
54. Event architecture
55. Outbox pattern strategy
56. Webhook/idempotency strategy
57. Integration strategy
58. Compliance roadmap
59. SLO/RPO/RTO targets
60. 12-month roadmap
61. Vertical Slice #1 implementation plan

Also produce: a UI/UX, design-system, and component-sourcing plan (shadcn/ui on Base UI, shadcn studio, Magic UI; tokens, radius scale, motion budget per surface) and a registry + MCP authentication plan (namespaces, env-based tokens, license handling).

Do not generate implementation code until this architecture review is complete.

---

## 31. Implementation Phases

Phase 0 — Architecture and Foundation: charter review, gap analysis, domain model, ERD, module dependency map, monorepo, standards, environment strategy, registry/MCP authentication setup, UI component-sourcing plan, and design tokens (fonts, radius scale, density), repository governance (CLAUDE.md, ADRs, module specs, glossary), and the environment/configuration matrix.

Phase 1 — Identity, Tenant, RBAC and Audit: Better Auth, Organization, Admin, 2FA, SCIM, Device Authorization, tenant context, RBAC, permissions, audit, RLS foundation.

Phase 2 — Products and Inventory Ledger: products, variants, categories, brands, units, SKUs, barcodes, initial inventory, stock ledger, multi-UoM, serial/batch/expiry.

Phase 3 — Locations, Warehouses and Bonds: companies, locations, stores, warehouses, bonded warehouses, transfers, bond release, bins.

Phase 4 — POS and Offline Queue: POS sale mutation, payments, receipts, shifts, offline queue, idempotency, sync logs, number block reservation, Tauri POS target.

Phase 5 — Accounting Foundation: chart of accounts, journals, AR/AP, tax, cash clearing, inventory accounting placeholders, money rules, gift card/store credit liabilities.

Phase 6 — Procurement: suppliers, POs, GRNs, vendor bills, landed costs.

Phase 7 — CRM: customers, leads, opportunities, loyalty, credit limits, store credit.

Phase 8 — Ecommerce: storefront, publishing, cart, checkout, online orders, inventory sync.

Phase 9 — Hardware Bridge: abstraction, print protocol, Tauri bridge, daemon design, device registration.

Phase 10 — Edge Hub: Dockerized Edge Hub, LAN sync, local transaction coordination, cloud sync, reconnection testing.

Phase 11 — SaaS, Licensing and White Label: billing, feature flags, license model, custom domains, SMTP, branding, subscription entitlements.

Phase 12 — Analytics, Reporting and Insights: dashboards, reports, correlated insights, exports, scheduled reporting, read models.

Phase 13 — Enterprise Hardening: observability, security hardening, disaster recovery, performance tuning, multi-region planning, compliance roadmap.

---

## 32. Vertical Slice #1

After architecture approval, implement only Vertical Slice #1:

Organization → Active Tenant Context → Company → Location → Product → Initial Inventory Receipt → Stock Ledger Entry → POS Sale Mutation → Automatic Stock Deduction → Invoice Record → Audit Log Entry → Basic Sales Report

Include Better Auth Organization/Admin integration, basic permission enforcement, tenant guard middleware, RLS strategy/design, Drizzle schema, migration files, seed data, oRPC routers, Hono middleware, audit logging utility, idempotency key utility, stock ledger service, basic accounting posting placeholder, error handling, structured logging, basic tests, and minimal backend-safe structure/docs.

Do not build full CRM, ecommerce, accounting UI, hardware bridge, Edge Hub, fiscalization implementation, or advanced reporting yet. Only design interfaces where required to avoid future redesign.

Local dev seeding: the Dockerized development environment automatically seeds a standardized platform-admin account and a sample tenant so contributors skip repetitive manual setup during early testing.

---

## 33. Engineering Rules

- Use Drizzle ORM, not Prisma.
- Use strict TypeScript.
- Use Zod or equivalent validation.
- No hard deletes for operational data unless a legal erasure workflow governs it.
- Every query must be tenant-scoped.
- Shared SaaS tenant-owned tables must plan for PostgreSQL RLS.
- Every mutation must be audited.
- Every financial transaction must be traceable.
- Every inventory movement must create a ledger entry.
- Every POS sale must be idempotent.
- Every offline sync mutation must be replay-safe.
- Do not create separate inventory systems for POS and ecommerce.
- Do not skip accounting architecture.
- Do not skip CRM architecture.
- Do not skip Better Auth plugin integration.
- Do not implement everything at once.
- Keep the system modular.
- Prefer clear business workflows over raw CRUD.
- Build for usability, observability, recovery, and supportability.
- Store money as integer minor units, never floats.
- Store currency and amount together.
- Do not assume every currency has two decimals.
- Define one rounding policy and apply it consistently.
- Do not run heavy analytics on OLTP checkout tables.
- Use expand/contract migrations.
- Do not silently discard offline transactions.
- Device clocks are untrusted.
- Server time is authoritative for accounting and fiscal posting.
- Secrets must use envelope encryption.
- PII must be separated from immutable operational records where erasure may be required.

---

## 34. Repository Governance and Documentation Rules

This charter is committed to the repository at `docs/architecture/retailos-master-charter.md`. The repository is `github.com/kareemschultz/RetailOS` (Better-T-Stack monorepo: `apps/web`, `apps/native`, `apps/server`, `packages/ui`, `packages/api`, `packages/auth`, `packages/db`).

Also create and maintain:

- `CLAUDE.md` — lean agent entry point that links via @imports to the master charter, ADRs, module specs, and the phase roadmap.
- `docs/architecture/adr/` — Architecture Decision Records.
- `docs/architecture/module-specs/` — per-module specifications.
- `docs/architecture/phase-roadmap.md` — phase status and sequencing.
- `docs/architecture/glossary.md` — domain and ubiquitous-language glossary.
- `docs/architecture/lessons-learned.md` — append-only log of verified mistakes and corrections, never to be repeated (see §40).
- `docs/architecture/ui-inventory/` — enumerated UI component inventory (see §5).

Rules:

- Claude Code must read `CLAUDE.md` and the master charter before planning or implementing.
- Every architectural decision is recorded as an ADR; no major architectural change may be made silently.
- Module specs must be updated when a module changes.
- The master charter and the docs above must physically exist in the repo before Phase 0 planning begins; if any are absent (for example, the charter has not yet been committed to `docs/architecture/retailos-master-charter.md`), create them as the first step.

---

## 35. Acceptance Criteria and Definition of Done

Every module must define user stories, business rules, permissions, tenant isolation requirements, audit requirements, error states, sync/offline behavior, tests, observability, edge cases, and a rollback plan.

A module is Done only when:

- Types pass.
- Tests pass.
- Tenant scoping is verified, including an RLS-bypass check where applicable (§26).
- Audit logging works.
- Errors are friendly and structured.
- Logs are structured.
- Permissions and entitlements are enforced.
- Money uses integer minor units.
- Docs are updated (module spec, and ADRs where relevant).

---

## 36. Environment and Configuration Matrix

Document every environment: local development, Docker development, SaaS staging, SaaS production, dedicated cloud, managed private, self-hosted, Edge Hub, Tauri desktop, and native mobile.

Each environment must define database URL, Redis URL, object-storage endpoint and bucket, SMTP, auth secrets, billing secrets, registry tokens (shadcn studio / Magic UI Pro), feature flags, deployment mode, and data residency mode.

No environment-specific behavior may be hardcoded; all of the above are environment-driven (consistent with §9 data sovereignty and §25 secrets).

---

## 37. Legal, Licensing, and Commercial Protection

RetailOS must protect the commercial model. Plan for license activation, offline license grace, perpetual license certificates, support-contract status, tenant export rights, a source-escrow option for enterprise deals, EULA, privacy policy, data processing agreement (DPA), support SLA, backup responsibility matrix, and self-hosted support boundaries.

License enforcement must remain abstracted from authentication (§6) and must operate across all deployment modes (§9).

---

## 38. Product Operations and Client Onboarding

RetailOS must include tooling to onboard real clients: demo tenant creation, sample data seeding, client onboarding checklist, data-import checklist, go-live checklist, training mode, test/practice POS mode, sandbox mode, an audited support-access request workflow (§10 impersonation), backup verification before go-live, and a go-live rollback plan.

---

## 39. AI Agent Safety Rules

These complement the Engineering Rules (§33), the Documentation Fidelity and Continuous Learning loop (§40), and the AI Execution Strategy (§48).

Claude Code must not: build unrelated modules; skip tests; skip tenant scoping; skip audit logs; use floats for money; bypass Better Auth; hardcode tenant IDs; hardcode secrets or registry tokens; hardcode Guyana-specific rules; replace architecture without an ADR; or generate massive unreviewable changes.

Claude Code must: work in small, reviewable commits; explain impacted files; run type checks and tests; summarize risks; update docs; and preserve modular boundaries.

---

## 40. Documentation Fidelity and Continuous Learning (Self-Improving Loop)

RetailOS agents must treat official, authoritative documentation as ground truth and must improve over time by recording what they learn. This is mandatory.

Documentation fidelity:

- Before asserting a fact or implementing against any external tool, framework, registry, or API (shadcn/ui, Better Auth, Better-T-Stack, TanStack, Drizzle, Hono, Magic UI, shadcn studio, payment/fiscal providers, etc.), consult that tool's official documentation, and verify empirically wherever a command or config can be run.
- When official documentation contradicts this charter, the repo docs, the README, or a config file, resolve it in the same change: fix the config/code AND update the affected repo documentation to match the official source. Never leave a known contradiction in place and never silently work around it.
- Prefer official CLI / MCP / registry mechanisms over manual scraping or hand-copied snippets.

Continuous learning (self-improving loop):

- Maintain `docs/architecture/lessons-learned.md` as an append-only log, each entry framed as mistake → root cause → verified fix → rule ("do not repeat"). Recurring fixes may be encoded as a reusable skill under `.agents/skills/`.
- At the start of every task, read `lessons-learned.md` and the relevant ADRs so prior mistakes are not repeated.
- At the end of every task that involved a correction, a surprise, or a contradiction with official docs, append a dated entry before finishing.
- Structural or recurring lessons graduate into the relevant charter section, an ADR, or `CLAUDE.md` so the guidance compounds over time.
- Test-driven corrections: whenever a `lessons-learned.md` entry is added for a bug or architectural failure, write a corresponding Vitest or Playwright regression test so the mistake is mechanically prevented from recurring (§43).

Seed lessons (already verified during the UI tooling and inventory work):

- `components.json` registry keys must be `@`-prefixed and every registry `url` must contain `{name}`; missing either invalidates the whole file and silently disables all registries.
- There is no `--registry` flag; reference registry items as `@namespace/name` or a full URL.
- The shadcn CLI supports Vite/TanStack Start; do not assume a framework is "MCP-only."
- The shadcn MCP reads the ROOT `components.json`; mirror registries into the root config or install with `-c packages/ui`.
- A schema-valid registry entry is not proof it resolves; confirm exact Pro endpoints (e.g. Magic UI Pro `@magicui-pro` → `pro.magicui.design/registry/{name}`) against official docs and a live probe.
- Do not trust vendor marketing counts (e.g. "631+ blocks", shadcnblocks' ~1,665) without enumerating via the MCP/CLI; some catalogs have no public index and are not enumerable — state only enumerated counts.
- Some registries are style-parameterised (`…/r/{style}/{name}.json`, e.g. shadcn studio; ReUI pinned to `base-nova`), not just `{name}`; confirm the exact URL template and params per registry.
- Registry item slugs can differ from display names (ReUI `file-upload` → `use-file-upload`; shadcnblocks `hero1`, not `hero-1`); verify the exact slug with a live probe before installing.

---

## 41. Competitive Intelligence and Feature Parity Program

RetailOS must not be designed in isolation. Before architecting any major module, Claude Code must research and compare the equivalent functionality from industry-leading products — to match capability and learn workflows, data models, permissions, reporting, automation, edge cases, and integrations, not to copy UI.

Reference products by domain:

- ERP: Odoo, ERPNext, NetSuite, SAP Business One, Dynamics 365 Business Central, Acumatica.
- Retail POS: Lightspeed Retail, Shopify POS, Square for Retail, Vend, Revel, Clover, Toast (restaurant patterns).
- Inventory / warehousing: Cin7, Fishbowl, Zoho Inventory, inFlow, Finale.
- Accounting: QuickBooks Online, Xero, Zoho Books, Sage.
- CRM: HubSpot, Zoho CRM, Salesforce, Pipedrive.
- Ecommerce: Shopify, WooCommerce, BigCommerce.
- HR: BambooHR, Deel, Rippling.

Process, per major module and before building it: identify the leading competitors; their major features, unique features, strengths, weaknesses, and missing opportunities; then produce a feature matrix, a parity checklist, and an enhancement list. Use web research against official docs and feature/pricing pages, and record findings in `docs/architecture/competitive/<module>.md`.

Classify every discovered feature: P0 mandatory parity, P1 strongly recommended, P2 nice to have, P3 future innovation. Deliver a matrix per module — `| Feature | Odoo | ERPNext | NetSuite | … | RetailOS (Supported / Planned / Not planned) |`.

A competitive analysis is required before building Inventory, POS, Accounting, CRM, Ecommerce, Procurement, Warehousing, Assets, and HR. Do not build blind. The goal is parity plus better UX, offline support, white-labeling, Caribbean localization, and multi-deployment flexibility — not a clone.

---

## 42. Product Management and Requirements Discipline

No module implementation begins until its requirements are documented (this is the entry criteria; the Definition of Done in §35 is the exit criteria). For each module, document: vision; user personas; user stories; acceptance criteria; business rules; edge cases; permissions; reporting requirements; offline behavior; integration requirements; and migration/import requirements (including migrating in from the competitor products in §41). Store this as the module specification under the documentation rules (§34).

---

## 43. Automated Quality Gates

Every pull request must pass these gates, and a failing gate blocks merge:

- TypeScript type check; Biome / Ultracite lint and format.
- Unit and integration tests (Vitest); E2E and visual-regression (Playwright, §4).
- Accessibility checks (WCAG 2.2 AA); security scan (SAST + secret detection); dependency audit; container scan (§28).
- Bundle-size analysis and performance-budget checks (§44).

These gates must exist as root scripts (`test`, `lint`, `check-types`, and so on) and run in CI on every PR.

---

## 44. Performance Budgets

Initial budgets, validated and enforced through the §43 performance gate (treat as targets and tighten with real-device data):

- POS: initial load < 2s; product search < 100ms; barcode-scan response < 50ms; add item to cart < 50ms.
- Admin: first load < 3s.
- Warehouse: scan response < 100ms.
- Offline operations must continue without visible lag.

Performance regressions must be tracked and blocked in CI.

---

## 45. Architecture Reassessment Loop

Architecture is a living system. At the end of every phase, Claude Code must review the architecture, the lessons-learned log (§40), technical debt, competitor changes (§41), performance (§44), security (§29), and usability — and record recommended improvements as ADRs (§34). This phase-level cadence complements the per-task learning loop in §40.

---

## 46. Phase 0 Lock-In Checklist

Before any ERP feature implementation, Claude Code must verify the repository physically contains:

- `docs/architecture/retailos-master-charter.md` (this charter) and `CLAUDE.md`
- `docs/architecture/adr/`, `docs/architecture/module-specs/`, and `docs/architecture/competitive/`
- `docs/architecture/phase-roadmap.md`, `docs/architecture/glossary.md`, and `docs/architecture/lessons-learned.md`
- `.github/workflows/ci.yml`, a Vitest config, and a Playwright config
- the environment/configuration matrix (§36) and a documented Docker hardening plan (§28)

Phase 0 is not complete until: `bun run check-types` passes; `bun run check` (lint/format) passes; `bun run test` exists and passes; CI runs green; the Docker build is verified; and the charter, ADRs, and module specs are committed.

---

## 47. Foundation Before Features

Claude Code must not implement product modules until the repository foundation matches this charter. The following must exist first, as Phase 0/Phase 1 work, before any POS, inventory, ecommerce, accounting, or CRM code:

- Better Auth configured beyond scaffold defaults (the plugins required by §6).
- Tenant context and the platform/tenant/org model (§8).
- RBAC and entitlements (§7), with the Row-Level-Security strategy encoded (§8/§9).
- Audit logging and structured logging (§25).
- Redis, object storage (MinIO/S3), and background worker services present in Docker Compose (§28).
- CI and test infrastructure complete (§43, §46).
- Vertical Slice #1 schema designed (§32).

Close these foundations before building feature modules.

---

## 48. AI Execution Strategy

This charter is the source of truth.

For every Claude Code session:

1. Restate the exact task.
2. Identify relevant charter sections.
3. Identify affected modules.
4. Identify affected files.
5. Identify architectural risks.
6. Generate an implementation plan.
7. Build only the requested module.
8. Run type checks.
9. Run tests.
10. Summarize completed work.
11. List follow-up work.

Before planning, read `docs/architecture/lessons-learned.md` and consult the official documentation for any external tool, framework, or registry involved (§40). After finishing, append any new lesson, surprise, or documentation contradiction to `lessons-learned.md`.

Never attempt to build the entire ERP at once. Do not silently change architecture. If a requirement conflicts with this charter — or if official documentation contradicts the repo — stop, explain, fix the contradiction, and record it (§40).

---

## 49. Final Output Format for Claude Code Plan Mode

When this charter is first given to Claude Code Plan Mode, output:

1. Executive architecture summary
2. Confirmed assumptions
3. Risks and gaps
4. Recommended improvements
5. Domain model
6. Database/ERD plan
7. Better Auth plugin plan
8. Better Auth access-control boundary
9. RBAC matrix
10. Tenant isolation strategy
11. PostgreSQL RLS strategy
12. Offline sync plan
13. Offline conflict policy
14. Edge Hub plan
15. Hardware bridge plan
16. Fiscalization/document numbering plan
17. Accounting architecture
18. CRM architecture
19. Inventory architecture
20. Ecommerce architecture
21. White-label/SaaS/licensing architecture
22. Error handling/logging architecture
23. Analytics/reporting/insights architecture
24. Testing/CI/CD strategy
25. Deployment strategy
26. Data residency strategy
27. Secrets strategy
28. Disaster recovery strategy
29. Folder structure
30. Implementation roadmap
31. Vertical Slice #1 plan
32. UI/UX, design system, and component-sourcing plan (shadcn/ui + Base UI, shadcn studio, Magic UI; tokens, radius, motion)
33. Registry + MCP authentication plan (namespaces, env tokens, license handling)
34. Repository governance and documentation plan (CLAUDE.md, ADRs, module specs, glossary)
35. Environment and configuration matrix
36. Module acceptance-criteria and Definition-of-Done template
37. Documentation-fidelity and continuous-learning plan (`lessons-learned.md`, official-docs verification loop)
38. Competitive-analysis matrices per module (§41) and the per-module requirements/spec template (§42)
39. Automated quality-gate plan and performance budgets (§43, §44), with the root scripts and CI workflow that enforce them

Only after this plan is reviewed should coding begin.

---

## 50. Final Reminder

RetailOS is a product, not merely a SaaS platform.

Every architectural decision must support multi-tenant SaaS, dedicated hosted cloud, managed private instance, self-hosted enterprise, offline single-terminal operation, LAN Edge Hub operation, web app, Tauri desktop app, native mobile app, enterprise identity, white-label branding, accounting correctness, inventory correctness, fiscal/document integrity, auditability, recoverability, usability, observability, data residency, and commercial monetization.
