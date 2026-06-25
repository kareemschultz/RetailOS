# RetailOS Component Preference Matrix (per-component — authoritative)

- **Status:** GOVERNANCE — the **single per-component preferred-source map**. **Docs-only; no UI is built during backend phases.** Where `ui-source-registry.md` fixes the source **per module/screen**, this file fixes it **per component**, so nobody ever has to ask *"which button do I use?"* — the answer is already written.
- **Companion to:** `frontend-strategy.md` (the sourcing *law* + the 7-layer stack), `ui-source-registry.md` (per-module + Screen Composition Matrix), and the `retailos-design-language` skill (the design *law*).
- **The rule:** pick the **Preferred Source** below. If two sources tie, **prefer the higher layer** in the 7-layer stack (AdminCN → CommerceO → Studio Blocks → Studio Components → shadcn/ui → Magic UI → Custom). **Every choice still becomes owned, re-themed `packages/ui` code** (`import → normalize → adapt → extend`) — the source is where we *start*, never what we *ship*.

---

## Primitives & small components

| Component | Preferred Source | Notes |
|---|---|---|
| Button / Button Group | **Studio Components** | ~55 variants; use the Studio variant whenever more polished than plain shadcn/ui |
| Input / Input Group | **Studio Components** | ~46 variants |
| Select / Combobox / Autocomplete | **Studio Components** | ~38 variants; avatar+email option rows for customer/rep lookup |
| Dialog | **Studio Components** | ~26 variants |
| Drawer / Sheet | **Studio Components** | held-sales drawer, cart sheet |
| Tabs | **Studio Components** | ~29 variants |
| Stepper | **Studio Components** | wizard step indicator |
| Badge / status chip | **Studio Components** | always icon + text, semantic colors (design skill) |
| Tooltip | **Studio Components** | mount `TooltipProvider` at app root |
| Progress | **Studio Components** | ~23 variants |
| Sonner (toast) | **Studio Components** | ~20 variants |
| Slider | **Studio Components** | ~19 variants |
| Phone Input / OTP / Rating | **Studio Components** | specialized inputs |
| Command palette (Cmd-K) | **Studio Components** | ~14 command variants; global Raycast-feel search |
| Anything Studio lacks a better variant for | **shadcn/ui** | fallback Base UI primitive |

## Workflow blocks (whole patterns)

| Component | Preferred Source | Notes |
|---|---|---|
| Data Table | **Studio Blocks** / **AdminCN** | Studio `datatable-*` + AdminCN's 11 datatable patterns; `@reui` for data-dense grids; virtualize >50 rows |
| Checkout | **Studio Blocks** | eCommerce checkout block — adapt to POS path, no Magic UI |
| Cart | **Studio Blocks** | eCommerce cart block |
| Order Summary | **Studio Blocks** / **CommerceO** | order-items pattern |
| Timeline | **Studio Blocks** | audit trail / stock-movement / order activity (timeline-first) |
| Calendar | **Studio Blocks** | scheduling / date-range |
| Kanban / board | **Studio Blocks** | pipeline, pick/pack, PO board |
| Multi-step Form / Wizard | **Studio Blocks** / **AdminCN** | onboarding, product add, PO |
| Auth screens (2FA / verify-email) | **Studio Blocks** | Studio covers what shadcn core lacks |

## Shell & commerce surfaces

| Component | Preferred Source | Notes |
|---|---|---|
| Sidebar | **AdminCN** | the single app frame |
| Header / breadcrumbs | **AdminCN** | |
| Dashboard cards / statistics / widgets | **AdminCN** | + Studio statistics |
| Charts | **AdminCN** | Recharts via `@shadcn/chart` / Studio Charts; disable enter-animation on live data |
| RBAC (roles / permissions / users) | **AdminCN** | `roles` / `permissions` / `users` apps |
| Theme customizer | **AdminCN** | reference for `tenant_ui_config` white-label |
| Product Table / Product Grid | **CommerceO** | per-entity TanStack table pattern |
| Order Table / Order Detail / Tracking | **CommerceO** | `order-items-table`, `customer-details`, `shipping-activity` |
| Customer Table / Profile | **CommerceO** | all / overview / billing / security |
| Vendor Table / Detail | **CommerceO** | list / create / details |
| Receipt (visual) | **CommerceO + Custom** | layout from CommerceO; fiscal/thermal preview is custom |

## Motion (marketing/onboarding only)

| Component | Preferred Source | Notes |
|---|---|---|
| Number ticker / animated KPI | **Magic UI** | dashboards/onboarding only |
| Marketing / storefront sections | **Magic UI** (+ Pro) | **never** on POS / accounting / data-entry |

## RetailOS custom (no registry covers these)

| Component | Preferred Source | Notes |
|---|---|---|
| Stock-ledger / FIFO-layer viewer | **Custom** | `gaps-and-custom.md` |
| Bonded-vs-released stock view | **Custom** | |
| Bond-release workflow | **Custom** | |
| Offline-status indicator | **Custom** | Synced/Syncing/Queued/Failed — icon + text |
| Split / multi-currency payment pad | **Custom** | POS tender |
| Bin / zone scan UI | **Custom** | scanner-first |
| Landed-cost allocator | **Custom** | procurement |
| Fiscal / thermal receipt preview | **Custom** | |
| Cash-drawer & shift-close panel | **Custom** | blind close / over-short |
| Commission engine surface | **Custom** | |
| Barcode / label designer | **Custom** | |

## Cross-references

| Concern | Authoritative source |
|---|---|
| Sourcing law + 7-layer stack + verified ZIP facts | `frontend-strategy.md` |
| Per-module registry + Screen Composition Matrix | `ui-source-registry.md` |
| Vertical onboarding presets | `vertical-presets.md` |
| Design law | `.agents/skills/retailos-design-language/SKILL.md` |
| Custom RetailOS components (the ~13 gaps) | `ui-inventory/gaps-and-custom.md` |
