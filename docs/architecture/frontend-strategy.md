# RetailOS Frontend Strategy (governance — official)

- **Status:** GOVERNANCE — the official, binding RetailOS frontend strategy. **Docs-only; no UI is built during backend phases.** Locked into repository governance *before* Phase 4 implementation so every later UI surface is sourced and adapted the same way. Charter §5/§47; `AGENTS.md` / `CLAUDE.md` frontend-governance bullet.
- **What this doc owns:** the **sourcing & adaptation strategy** (where UI comes from, how it becomes owned RetailOS code, the preferred order, the build sequencing). It is the companion to — and does **not** duplicate — two existing artifacts, which remain authoritative for their own concern:
  - **The design *law*** lives in the **`retailos-design-language` skill** (`.agents/skills/retailos-design-language/SKILL.md`, PR #12) — color, typography, spacing, status chips, tables, offline UX, motion, accessibility, per-module device targets. **That skill governs every pixel; this doc governs every import.**
  - **The AdminCN sourcing detail** lives in **`ui-admin-shell-findings.md`** (PR #21) — what's registry-installable (Base UI, authenticated) vs Next-coupled, and what to port.
  - The component **catalog** lives in `ui-inventory/` (`INDEX.md`, `retailos-surface-map.md`, `gaps-and-custom.md`).

---

## 1. Frontend Architecture

### Backend remains RetailOS (authoritative)
The backend is unchanged and is the source of truth for all data, identity, and business logic. The frontend adapts to it — never the reverse.

- **TanStack Start** (web SSR; Tauri static/SPA target for desktop POS; Expo/native for mobile)
- **Hono** · **oRPC** · **Better Auth** · **Drizzle** · **PostgreSQL** · **RLS (fail-closed, tenant-scoped)**
- **Event architecture** (transactional outbox, §24) · the **existing domain model** (Phases 1–3 shipped; 4+ in progress)

### We do NOT rebuild UI from scratch. We do NOT fork AdminCN.
RetailOS UI is **composition-first and owned-in-repo** (shadcn philosophy). We assemble screens from existing, vetted source material and adapt it — we never hand-roll generic React, and we never carry a foreign app shell.

**Source material (all already wired):** the configured **MCP + registries** — **shadcn Studio** (`@ss-blocks`/`@ss-components`/`@ss-themes`, authenticated `EMAIL`+`LICENSE_KEY`), the **shadcn registries** (`@shadcn` core), **Magic UI** (`@magicui`/`@magicui-pro`), the **AdminCN** and **CommerceO** template sources (Pro downloads, **gitignored** — mined, never forked, never committed), **ReUI** (`@reui`), and any compatible registry component.

### RetailOS UI Platform (the mental model)

We are **not "using templates."** We use AdminCN, CommerceO, and Studio as a **design-system source** — raw material for RetailOS's own UI library. Everything above the backend eventually **disappears into `packages/ui`**, which becomes RetailOS's owned, coherent component library. The win condition: **nobody can tell** which card came from CommerceO, which sidebar came from AdminCN, or which dialog came from Studio — because every imported block is re-themed to RetailOS tokens, normalized to Base UI, and wired to oRPC, so it all reads as **RetailOS**. The templates are scaffolding for our design system, not the product.

```
                  RetailOS Design Language
                            |
                  RetailOS Design Tokens
                            |
        +-------------------+-------------------+
     AdminCN            CommerceO          Studio Registry
      Shell             Workflows         Blocks + Components
        +-------------------+-------------------+
                            |
                    packages/ui  (ours)
                            |
   Better Auth . TanStack Start . Base UI . Tailwind v4 . oRPC . RetailOS APIs
```

### The 7-layer frontend stack (sourcing by role, then preference)

RetailOS UI is composed from **seven layers**. Each layer has a distinct **role**; when a surface needs something, take it from the highest layer that covers it and only descend when the layer above doesn't. This is stronger than any single template — we move fast on owned, vetted source and stay cohesive because everything is normalized through the design-language skill and wired to our backend. The two templates (**AdminCN**, **CommerceO**) are the **same vendor's shadcn-studio Pro stack** — both **Base UI** (`@base-ui/react`) **+ shadcn style `base-vega` + Tailwind v4 + Next 16 / React 19 + pnpm, all-mock (`fake-db` + `'use server'`), zero Radix, zero bundled auth** (verified 2026-06-25 by read-only ZIP inspection) — so they compose cleanly once ported to our stack.

1. **AdminCN — application shell & visual language (the skin).** The app frame and overall look: layout, sidebar, header, breadcrumbs, command palette, search bar, dashboard layouts (9 variants: sales/finance/logistics/analytics/orders/payments/ecommerce/campaign/productivity), the **11 datatable patterns**, **RBAC** (`roles`/`permissions`/`users`), form wizards, charts/cards/statistics/widgets, settings, the theme customizer, navigation, responsive behavior, dark/light, density. AdminCN-the-template is a Next 16 download **we never fork** — its compositions also map to the authenticated Studio `application-shell`/`dashboard-shell`/chart blocks, which install in our `base`/Base UI style (`ui-admin-shell-findings.md`).
2. **CommerceO — retail & commerce workflows (first-class source for the commerce surfaces).** The same vendor's e-commerce admin template, and the **primary visual reference for RetailOS's retail/commerce screens**: **Products** (list + multi-section add incl. an **inventory** section, categories, discount-coupons/pricing), **Orders** (list / detail / tracking — `order-items-table`, `customer-details`, `shipping-activity`), **Customers** (all / overview / billing / security — CRM-shaped), **Vendors** (list / create / details — procurement/suppliers), and commerce **Settings** (store / checkout / payments / shipping / locations / reviews / referrals). Its highest-reuse asset is the **per-entity TanStack table pattern** (`data-table` + `<entity>-table` + `row-actions` + `table-toolbar` + `table-pagination`) repeated across every list surface, plus the **add-via-sheet** pattern. Like AdminCN it is a Next 16 download **we never fork** — we mine `src/views`/`src/components` and adapt. *Deltas to reconcile when combining with AdminCN (verified):* CommerceO uses `@remixicon/react` icons → **normalize to lucide/Phosphor**; `zod@4` vs AdminCN `zod@3` → **align to the RetailOS-pinned zod**; baseColor `zinc` vs `neutral` → **re-theme both to RetailOS tokens**.
3. **shadcn Studio BLOCKS — large workflows (first-class source, not a fallback).** Whenever AdminCN/CommerceO don't already have it, go to Studio blocks. These are **whole workflows that save days**: checkout, cart, product grid, order summary, payment dialog, receipt, multi-step forms, wizards, CRM pipelines, rich forms, dashboard widgets, empty states, auth (2FA/verify-email), timeline, activity feeds, calendar, kanban, command menus, data tables.
4. **shadcn Studio COMPONENTS — polished primitive variants (the default primitive library).** Studio's component catalog replaces plain shadcn/ui primitives wherever its variant is more polished — buttons (~55 variants), inputs (~46), selects (~38), tabs (~29), dialogs (~26), progress (~23), sonner (~20), sliders (~19), commands (~14), data-tables (~13), plus stepper, phone-input, rating, badges, tooltips, typography, spinners. **Prefer a Studio component over the base shadcn/ui primitive whenever it is more polished** — Studio components are the default, not the exception.
5. **shadcn/ui — fallback primitives.** The low-level Base UI layer (Button, Input, Select, Combobox, Dialog, Drawer, Popover, Tooltip, Table, Sheet, Accordion, Checkbox, Switch, Toast, Tabs) used only when Studio has **no better variant**. Keep accessibility and **Base UI** compatibility.
6. **Magic UI — tasteful motion only.** Marketing/storefront, onboarding, auth success, KPI accents, subtle dashboard polish, command-palette feel. **Never** on the POS checkout, accounting, or any high-frequency data-entry path (speed rule).
7. **RetailOS custom — ERP-specific surfaces no registry covers.** The `gaps-and-custom.md` set: stock-ledger / FIFO-layer viewer, bonded-vs-released view, bond-release workflow, fiscal/thermal receipt preview, cash-drawer & shift-close panel, split/multi-currency payment pad, bin/zone scan UI, landed-cost allocator, commission engine, offline-status indicator, barcode/label designer — built on shadcn/Base UI primitives, owned in `packages/ui`.

### Source Priority Matrix (per-need — so we don't guess)

The pyramid above, made concrete. Pick the source by what's needed:

| Need | Source |
|---|---|
| Dashboard layout / shell | **AdminCN** layouts (via shadcn Studio `application-shell` / `dashboard-shell` blocks) |
| Tables / data grids | **shadcn Studio** (DataTable blocks) + **AdminCN** (11 datatable patterns) + **CommerceO** (per-entity `data-table`/`row-actions`/`table-toolbar` pattern) + `@reui` for data-dense grids |
| Forms / wizards | **shadcn Studio** (Form Layout, Multi-step Form) + **AdminCN** (form-wizard icons/numbered) |
| Charts | **AdminCN** chart compositions (Recharts via `@shadcn/chart` / Studio Charts) |
| KPI / statistics / widgets | **shadcn Studio** (Statistics, Widgets) + **AdminCN** (statistics/widgets) |
| RBAC / user & role admin | **AdminCN** (`roles` / `permissions` / `users` apps) |
| Product catalog / product create (multi-section) / categories / coupons | **CommerceO** (products: list + add incl. **inventory**/pricing/organize/image, categories, discount-coupons) |
| Orders / order detail / order tracking | **CommerceO** (order: list / details / tracking — `order-items-table`, `customer-details`, `shipping-activity`) |
| Customer list / customer profile (CRM) | **CommerceO** (customer: all / overview / billing / security) + **shadcn Studio** (pipeline / activity feed) |
| Vendors / suppliers | **CommerceO** (vendor: list / create / details) |
| Commerce settings (store / checkout / payments / shipping / locations) | **CommerceO** (settings group) |
| POS checkout / cart / product grid / order summary / payment dialog / receipt | **shadcn Studio** (eCommerce checkout/cart/product-list/order-summary blocks) + **CommerceO** (product-grid / order-items / cart patterns) — adapt to the POS path; **no Magic UI motion here** |
| Polished primitive variants (buttons, inputs, selects, dialogs, tabs, steppers, badges, tooltips) | **shadcn Studio Components** (the default whenever more polished); **shadcn/ui** core (Base UI) as fallback |
| Command palette (Cmd-K) | **shadcn Studio Components** (~14 command variants); **shadcn/ui** core (`@shadcn/command`) as fallback |
| Calendar | **shadcn Studio** / **shadcn** core |
| Marketing / storefront sections | **Magic UI** (+ Magic UI Pro) |
| Animations / motion / delight | **Magic UI** (marketing/onboarding/dashboards only — never POS) |
| Auth screens | **shadcn Studio** auth blocks (2FA/verify-email Studio covers) |
| Kanban / board · timeline · activity feed | **shadcn Studio** (Kanban / Timeline blocks) |
| ERP-specific workflows + the ~13 gaps | **Custom** (`gaps-and-custom.md`) |

> "AdminCN" / "CommerceO" in this matrix mean **the template compositions we mine and adapt** — both are Next 16 downloads we **never fork**. AdminCN's layouts also map to authenticated Studio `application-shell`/`dashboard-shell`/chart blocks that install in our `base`/Base UI style (`ui-admin-shell-findings.md`); CommerceO's commerce surfaces are mined from its `src/views`/`src/components` (Base UI, `base-vega`) and re-themed to RetailOS tokens. Every cell still becomes owned, oRPC-wired code (see "Every imported block becomes owned").
>
> **"shadcn Studio" splits into two layers (§1):** **Studio Blocks** = whole workflows (checkout, cart, datatables, kanban, timeline, auth, wizards); **Studio Components** = polished primitive variants that are the **default** primitive library when more polished than plain shadcn/ui. The per-component preferred source is fixed in **[`component-preference-matrix.md`](./component-preference-matrix.md)**.

### UI Source Registry (per-module — source recorded BEFORE anyone builds)

For every major module the intended source is fixed **before** a UI session starts, so the session **follows the registry instead of re-deciding** where to pull from. The **authoritative, full per-module registry** — with **Primary / Secondary / Studio Components / Custom Components** for every module — lives in **[`ui-source-registry.md`](./ui-source-registry.md)** (single owner; the table is not duplicated here, to avoid drift). Quick read of the columns: **Primary** = the layer that frames/drives most of the screen; **Secondary** = the layer filling specific blocks/variants; **Custom** = the RetailOS-specific ERP logic no registry covers (`gaps-and-custom.md`). Every screen is **composed of blocks** (§7 "build layers, not pages"), so a module almost always draws from several layers.

> Composition example (POS) — *blocks, not a page:* **AdminCN App Shell** ▸ Product Search (Studio) ▸ Product Grid (CommerceO / Studio) ▸ Cart (Studio) ▸ Order Summary (CommerceO / Studio) ▸ Tender Dialog (Studio) ▸ Receipt Preview (custom) ▸ **RetailOS POS business logic (custom)**. The backend doesn't care where a block came from — every block is normalized, owned, and wired to oRPC.

### Every imported block becomes owned, adapted code

**NEVER MODIFY AN IMPORTED BLOCK IN PLACE.** Hacking the installed source destroys any path to upgrades and re-imports. The pipeline is always:

> **import → normalize → adapt → extend**

1. **import** — install the block unchanged via Studio MCP / CLI (`-c packages/ui`).
2. **normalize** — strip Next/auth/routing/mock assumptions; fix imports to our aliases; re-theme to RetailOS tokens. The result is a clean, owned baseline.
3. **adapt** — wire to oRPC + TanStack Query; match the domain model's data shapes.
4. **extend** — add RetailOS behavior by **composition/wrapping**, not by editing the normalized baseline in ways that fight a future re-import. Keep the baseline recognizable.

On import, each block:
No imported block ships as-is. On import, each block:

- **Becomes owned code** — committed source we maintain (never an opaque runtime dependency).
- **Lives in `packages/ui`** — installed with `-c packages/ui`; the shared owned library.
- **Is adapted to RetailOS APIs** — wired to **oRPC + TanStack Query**; data shapes match the domain model.
- **Is re-themed to RetailOS tokens** — blue accent + semantic palette + the 4-pt grid + radius scale; **never** ships a block's foreign colors/radii/fonts.
- **Removes mock data** — all `fake-db` / seed / placeholder data stripped; real data via oRPC.
- **Removes Next.js assumptions** — Server Actions, RSC, `app/` route targets, `nuqs`, middleware → ported to **TanStack Start** routes/loaders.
- **Removes foreign auth assumptions** — neither template bundles an auth provider (verified: no `@clerk/*` dependency; Clerk is only AdminCN's *documented integration option*, and both ship auth screens as pure UI shells). All session/auth wiring → **Better Auth** (charter §6).
- **Removes foreign routing assumptions** — Next App Router groups → TanStack Start file routes.

### The contract
> **AdminCN + CommerceO are the visual targets. The RetailOS backend remains authoritative.** We match the look; we keep our stack.

---

## 2. Design Language

> The binding design law is the **`retailos-design-language` skill** — consult it whenever building, generating, styling, theming, or reviewing ANY RetailOS UI, and whenever sourcing from any tool. The essentials are restated here for governance; **the skill governs on any conflict.**

RetailOS must feel like: **Linear · Raycast · Stripe Dashboard · Vercel · Notion · Retool · modern Odoo** — enterprise ERP density with modern SaaS polish, calm and clutter-free.

It must **never** feel like: **AdminLTE · legacy ERP · SAP GUI · generic Tailwind CRUD** (nor old Odoo/Dynamics themes, Bootstrap admin templates).

The **Golden rule** (governs everything, including the visual target): *Would a cashier understand this? Would a warehouse worker use it one-handed? Would a CFO trust this? Would a CEO get it in 5 seconds?* If not — simplify. Borrowed SaaS tactics serve this rule, never override it, and never reach the POS path.

---

## 3. Visual System

- **Blue accent** — RetailOS primary (active nav, primary buttons, selected tabs, charts, links, focus). Emphasis only — never everywhere. Green/amber/red stay **semantic** (success/warning/error).
- **Rounded corners everywhere** — token-driven radius scale (cards/sheets large, inputs/buttons medium, badges/avatars pill); avoid `rounded-none`/`rounded-sm` unless density demands it.
- **Light mode + dark mode** — in dark mode signal depth with lighter card shades, **not** drop shadows (they read poorly on dim POS screens).
- **Density modes — Comfortable · Compact · Dense** — the same table serves a touch POS and a dense accounting screen; driven by `tenant_ui_config`.
- **Semantic badges** — status is always a chip with **icon + text**, never raw text and never color-only (colorblind + glare redundancy).
- **Right-aligned financials** + **monospace / tabular numerals** — so place values stack and a column scans cleanly.
- **Progressive disclosure** — role-aware; reveal complexity gradually (warehouse worker ≠ manager ≠ CFO; same data, different surface).

---

## 4. Required Views (multi-view per module)

Where appropriate, every module supports:

- **Table** · **Card** · **Detail** · **Timeline**

And where it fits, optionally:

- **Calendar** · **Kanban** · **Map** · **Hierarchy**

Module-specific anchors (from the design skill): **Warehousing → Hierarchy** (Warehouse → Zone → Aisle → Rack → Bin, the Phase-3 location tree); **audit trails & stock-movement history → Timeline first** (Receipt → Transfer → Adjusted → Sold → Returned), table second. **Let the data drive the component** — categorical → chips, numeric → right-aligned tabular, time-series → timeline/chart, status → semantic chip, 2-D → heat map.

---

## 5. UX Rules

Every RetailOS surface provides, where applicable:

- **Tooltips** — on truncated text, icon-only buttons, and ambiguous labels (the "invisible UI" whose absence marks a beginner dashboard).
- **Helper text · examples · validation guidance** — field help + inline validation + a review step; long forms are **wizards**, not one giant page; autosave drafts + undo.
- **Empty states** — never "No Data"; explain what goes here, show the next step, give a CTA.
- **Offline indicators** — always visible (see §6).
- **Command palette** — global **Cmd/Ctrl-K** (Raycast-feel) across products, customers, suppliers, invoices, transfers, locations, employees, reports.
- **Keyboard navigation** — full keyboard nav, visible focus rings, WCAG 2.2 AA.

Every interactive control has **5 explicitly designed states**: default · hover · active(pressed) · disabled · loading (a missing pressed/loading state on a slow-network POS causes double-submits).

---

## 6. Offline UX (first-class — this is an offline-first ERP)

Sync state is **always visible, never hidden** — **icon + text, never color-only**:

- **Synced** (Online) — green
- **Syncing** — blue
- **Queued** — amber
- **Failed** (Conflict) — red

A cashier mid-outage must know at a glance whether a sale is safe.

---

## 7. Future Build Strategy

- **Backend phases continue first.** UI is **not** built during backend phases — no production UI until the APIs it binds are stable and approved (`AGENTS.md` / `CLAUDE.md` frontend-governance bullet).
- **When UI work begins** (Phase 4+ surfaces, on a dedicated UI branch — never on a backend PR):
  1. **Import real blocks** from the preferred-order sources (§1) — don't recreate by hand.
  2. **Adapt them** — own in `packages/ui`, re-theme to RetailOS tokens, strip mock data + Next/auth/routing assumptions (§1).
  3. **Wire them to oRPC** (+ TanStack Query) against the real domain model.
  4. **Preserve visual parity** with the AdminCN target and the design-language skill.
- **Do not recreate AdminCN (or any block) manually if a source block already exists** — find it via the studio MCP / registries first; building from scratch is the last resort, reserved for the `gaps-and-custom.md` set.
- **Sequencing dependency:** the design-language skill and the AdminCN findings (both on master) precede UI surfaces, which assemble per `retailos-surface-map.md`.

### Build layers, NOT pages
When UI starts, build **bottom-up reusable layers**, never one-off pages — a "page" is the thin top, not the unit of work. This maximizes reuse across the product surfaces and keeps a tenant theme/role change reshaping everything from one place:

> **Application Shell → Module Shell → Reusable Workflows → Blocks → Screens**

- **Application Shell** — the single app frame (sidebar, header, command palette, theme/density, offline-status, auth) — built once.
- **Module Shell** — per-product frame (POS, Inventory, Accounting…) inheriting the app shell + that product's nav/views.
- **Reusable Workflows** — the repeated ERP patterns (multi-view table, wizard, detail/timeline, approval, import) — built once, parameterized.
- **Blocks** — owned, normalized source blocks (Studio/AdminCN) re-themed and wired to oRPC.
- **Screens** — thin compositions of the above per `retailos-surface-map.md`. A screen should be mostly assembly, not new UI.

---

## 8. Studio MCP operational workflow (`/cui` · `/iui` · `/rui` · `/ftc`)

The shadcn-studio MCP is **already wired** (server in the agent config; `.claude/commands/{cui,iui,rui,ftc}.md` present; rules in `.claude/CLAUDE.md`). **All "setup" steps in the studio docs are already done — do not re-run them.** Use the commands when assembling UI (Phase 4+):

- **`/cui` (Create UI)** — compose a screen/section from studio blocks. **Primary** command for RetailOS app/dashboard/table surfaces. Generate **one block at a time** (a separate `/cui` per section), or name exact variants for a full page (e.g. "Use Application Shell 3, DataTable 6…").
- **`/iui` (Inspire UI — Pro)** — generate a *fresh* block inspired by studio patterns. Use only when no close block exists; it's slow — one section at a time, never a whole page.
- **`/rui` (Refine UI)** — tweak/iterate an existing block or swap to a named variant ("Update the table to DataTable 6", "install <theme>").
- **`/ftc` (Figma → Code)** — install the exact studio blocks composed in a Figma design (needs Figma MCP). For design-first **landing/marketing** pages; keep Figma block frame names intact (the matcher parses them).

**Adopted best practices (from the studio docs):** one block per command; **commit/stage before any bulk install** (easy revert); keep Figma frame names; write specific prompts; iterate with `/rui`; install into the shared package with **`-c packages/ui`**.

**RetailOS-specific guardrails — these docs contain traps for our stack:**
- ⚠️ **NEVER run the studio `curl -o CLAUDE.md …/copilot-instructions.md`** — it would **overwrite our `CLAUDE.md`**. Our studio rules already live in `.claude/CLAUDE.md`. Skip every "setup" step in the studio docs.
- ⚠️ The `/ftc` **`next.config.ts` image `remotePatterns`** (localhost:3845) is **Next-only**. `apps/web` is **TanStack Start (Vite)** — don't add a `next.config.ts`; localize/serve images per the "strip Next assumptions" rule (§1) or configure Vite image handling.
- Studio blocks install with **Next `app/page.tsx` targets** + demo content — every install is an **import, not a finished feature**: immediately apply §1 (own in `packages/ui`, port targets to **TanStack Start routes**, wire to **oRPC**, re-theme to RetailOS tokens, strip mock/auth assumptions).
- The MCP **installs**; it does not absolve adaptation. Every `/cui` result is reviewed against the **`retailos-design-language` skill** before it counts as done.

## 9. Cross-references

| Concern | Authoritative source |
|---|---|
| Design law (color/type/spacing/states/offline/motion/a11y/device targets) | `.agents/skills/retailos-design-language/SKILL.md` (PR #12) |
| **Per-module UI source registry** (Primary / Secondary / Studio Components / Custom) + Screen Composition Matrix | `docs/architecture/ui-source-registry.md` |
| **Per-component preferred source** ("which button do I use?") | `docs/architecture/component-preference-matrix.md` |
| **Vertical onboarding presets** (platform-not-product config strategy) | `docs/architecture/vertical-presets.md` |
| AdminCN: what's installable vs Next-coupled, what to port | `docs/architecture/ui-admin-shell-findings.md` (PR #21) |
| CommerceO + AdminCN: verified ZIP facts (framework, Base UI primitive, mock/Next layers to strip) | this doc §1 (7-layer stack) — verified 2026-06-25 |
| Component catalog + per-surface picks | `docs/architecture/ui-inventory/` (`INDEX.md`, `retailos-surface-map.md`) |
| Custom RetailOS components | `docs/architecture/ui-inventory/gaps-and-custom.md` |
| Charter UI/UX, component sourcing, motion, registry/MCP auth | charter §5 |
| Visual reference baseline (screenshots + principles) | `docs/architecture/ui-inventory/design-references.md` (PR #12) |
