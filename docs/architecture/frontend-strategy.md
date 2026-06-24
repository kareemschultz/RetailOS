# RetailOS Frontend Strategy (governance — official)

- **Status:** GOVERNANCE — the official, binding RetailOS frontend strategy. **Docs-only; no UI is built during backend phases.** Locked into repository governance *before* Phase 4 implementation so every later UI surface is sourced and adapted the same way. Charter §5/§47; AGENTS.md §35.
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

**Source material (all already wired):** the configured **MCP + registries** — **shadcn Studio** (`@ss-blocks`/`@ss-components`/`@ss-themes`, authenticated `EMAIL`+`LICENSE_KEY`), the **shadcn registries** (`@shadcn` core), **Magic UI** (`@magicui`/`@magicui-pro`), **AdminCN source blocks/layouts**, **ReUI** (`@reui`), and any compatible registry component.

### Preferred order of sourcing
When a surface needs a component or layout, source in this order — only descend when the tier above doesn't cover it:

1. **shadcn Studio** — the densest, authenticated, Base-UI-served block catalog (Application Shell, Dashboard Shell, DataTables, Statistics, Widgets, Charts, Forms, eCommerce, Auth). First choice for operational/ERP surfaces.
2. **AdminCN blocks / layouts** — the visual target's compositions (`src/views` dashboard/datatable/form modules + the theme-customizer/nav/command-palette patterns). Mine for layout and composition.
3. **Magic UI** — motion/delight for **marketing, storefront, onboarding, auth, dashboards only** — never the POS checkout or high-frequency data-entry paths (speed rule).
4. **Custom RetailOS components** — the ~13 builds no registry covers (`gaps-and-custom.md`: offline-status indicator, fiscal/thermal receipt preview, cash-drawer & shift panel, split/multi-currency payment pad, bin/zone scan UI, landed-cost allocator, bonded-vs-released view, barcode/label designer, …), built on shadcn/Base UI primitives.

### Every imported block becomes owned, adapted code
No imported block ships as-is. On import, each block:

- **Becomes owned code** — committed source we maintain (never an opaque runtime dependency).
- **Lives in `packages/ui`** — installed with `-c packages/ui`; the shared owned library.
- **Is adapted to RetailOS APIs** — wired to **oRPC + TanStack Query**; data shapes match the domain model.
- **Is re-themed to RetailOS tokens** — blue accent + semantic palette + the 4-pt grid + radius scale; **never** ships a block's foreign colors/radii/fonts.
- **Removes mock data** — all `fake-db` / seed / placeholder data stripped; real data via oRPC.
- **Removes Next.js assumptions** — Server Actions, RSC, `app/` route targets, `nuqs`, middleware → ported to **TanStack Start** routes/loaders.
- **Removes foreign auth assumptions** — Clerk (AdminCN's default) and any other → **Better Auth** (§6).
- **Removes foreign routing assumptions** — Next App Router groups → TanStack Start file routes.

### The contract
> **AdminCN is the visual target. The RetailOS backend remains authoritative.** We match the look; we keep our stack.

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

- **Backend phases continue first.** UI is **not** built during backend phases — no production UI until the APIs it binds are stable and approved (AGENTS.md §35).
- **When UI work begins** (Phase 4+ surfaces, on a dedicated UI branch — never on a backend PR):
  1. **Import real blocks** from the preferred-order sources (§1) — don't recreate by hand.
  2. **Adapt them** — own in `packages/ui`, re-theme to RetailOS tokens, strip mock data + Next/auth/routing assumptions (§1).
  3. **Wire them to oRPC** (+ TanStack Query) against the real domain model.
  4. **Preserve visual parity** with the AdminCN target and the design-language skill.
- **Do not recreate AdminCN (or any block) manually if a source block already exists** — find it via the studio MCP / registries first; building from scratch is the last resort, reserved for the `gaps-and-custom.md` set.
- **Sequencing dependency:** the design-language skill (PR #12) and the AdminCN findings (PR #21) merge first; UI surfaces then assemble per `retailos-surface-map.md`.

---

## 8. Cross-references

| Concern | Authoritative source |
|---|---|
| Design law (color/type/spacing/states/offline/motion/a11y/device targets) | `.agents/skills/retailos-design-language/SKILL.md` (PR #12) |
| AdminCN: what's installable vs Next-coupled, what to port | `docs/architecture/ui-admin-shell-findings.md` (PR #21) |
| Component catalog + per-surface picks | `docs/architecture/ui-inventory/` (`INDEX.md`, `retailos-surface-map.md`) |
| Custom RetailOS components | `docs/architecture/ui-inventory/gaps-and-custom.md` |
| Charter UI/UX, component sourcing, motion, registry/MCP auth | charter §5 |
| Visual reference baseline (screenshots + principles) | `docs/architecture/ui-inventory/design-references.md` (PR #12) |
