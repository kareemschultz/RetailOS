# Frontend Rebuild Tracker

> Living status doc for the RetailOS frontend rebuild (branch `frontend-redesign`).
> Frontend-only phase: **no backend/API/DB changes**. Surfaces without a stable
> API render against the typed **mock layer** and are marked "Preview data".
> Keep this file current so other agents can pick up mid-stream.

## Golden rules for this rebuild
- Governed by the `retailos-design-language` skill + `docs/architecture/*` (frontend-strategy, navigation-ia, component-preference-matrix, ui-source-registry).
- Backend truth, frontend clarity. Never fake a control that implies a write we can't do — mark it "Preview data" via the feature-status registry.
- Every list/detail surface flows Header → Context → Actions → Metrics → Work area.
- Money = monospace, tabular, right-aligned. Status = semantic chip (icon + text), never raw text.
- One design language: imported blocks become owned, re-themed code in `packages/ui`.

## Architecture added this rebuild

### White-label / theming (`apps/web/src/theme/`)
- `branding-store.tsx` — tenant branding (app name, initials, logo light/dark, accent hex, login tagline, support email, "Powered by" toggle). Persists to localStorage. `applyAccentVars()` paints emphasis tokens.
- `settings-store.tsx` — re-applies the brand accent AFTER the theme preset so branding always wins `--primary` (single applier; no effect race).
- Wired in `routes/__root.tsx`: `BrandingProvider` wraps `SettingsProvider`.
- UI: `routes/_app/settings.branding.tsx` — full white-label editor with live preview. Re-skins the whole app instantly (verified in browser).

### Shared primitives (`packages/ui/src/components/`)
- `status-chip.tsx` — `StatusChip` + `DomainStatusChip` (active/inactive/pending/failed/draft… → semantic color + Lucide icon).
- `page-header.tsx` — `PageHeader`, `PageMetrics`, `PageBody` (the Header→Context→Actions→Metrics→Work-area spine).
- `view-switcher.tsx` — `MultiViewSwitcher` (Table/Card/Detail/Timeline/Kanban/Calendar/Map/Hierarchy) on Base UI ToggleGroup.
- (existing, reused) `stat-card.tsx`, `data-table-card.tsx`, `states.tsx` (Empty/Error/Loading), `connection-status.tsx`.

### Data layer (`apps/web/src/data/`)
- `feature-status.ts` — registry keyed by feature: `real | partial | mock` + note. Single source of truth for provenance.
- `mock-query.ts` — `useMockQuery` + `useFeatureQuery` (switches real oRPC ↔ typed mock by registry; flipping a surface to real is a one-line change, zero page edits).
- `feature-status-badge.tsx` — "Preview data" / "Partial" badge shown in page headers.
- `mock/crm.ts`, `mock/finance.ts` — typed mock datasets.

### Navigation / shell (`apps/web/src/`)
- `configs/workspaces.ts` + `configs/workspace-store.tsx` — workspace concept (Retail / POS / Back office…) with switcher.
- `configs/nav-config.ts` — rewritten to the decided IA: HOME, SALES, CATALOG, INVENTORY & WAREHOUSE, PROCUREMENT, FINANCE, REPORTS groups; Settings pinned in footer; workspace-tagged; permission-aware.
- `configs/route-labels.ts` + `components/app-breadcrumbs.tsx` — header breadcrumbs.
- `components/app-sidebar.tsx` — rebuilt: workspace switcher header, grouped/collapsible nav, pinned footer.
- `components/workspace-switcher.tsx`, `components/notifications-bell.tsx` — header cluster.
- `components/resource-page.tsx` — reusable list-page scaffold (header + metrics + searchable DataTable + states + feature badge).
- `routes/_app/route.tsx` — added `VITE_PREVIEW_NO_AUTH` bypass so the shell is previewable without a backend session.

## Module status

| Module / route | Status | Data | Notes |
|---|---|---|---|
| Admin shell + IA + header | DONE | n/a | Verified in browser |
| White-label branding (`/settings/branding`) | DONE | local | Live re-skin verified |
| Notifications (`/notifications` + bell) | DONE | mock | Center + header popover |
| Customers (`/customers`) | DONE | mock | KPIs + table + chips |
| Suppliers (`/suppliers`) | DONE | mock | |
| Receivables (`/receivables`) | DONE | mock | AR aging |
| Payables (`/payables`) | DONE | mock | AP aging |
| Pricing & price lists (`/pricing`) | DONE | mock | |
| Promotions (`/promotions`) | DONE | mock | |
| Stock adjustments (`/adjustments`) | DONE | mock | |
| Dashboards (exec/ops) | TODO | real+mock | Rebuild KPIs/exceptions |
| Catalog: Products (wizard + tabbed detail) | TODO | real | |
| Catalog: Categories / Brands / Units | TODO | real | Re-theme existing |
| Inventory + Warehouse (hierarchy, timeline) | TODO | real+mock | |
| Procurement (POs, receiving) | TODO | real+mock | |
| Finance (accounting, GRA/PAYE/NIS) | TODO | mock | |
| Reports | TODO | mock | |
| Settings (tabbed) / Staff / RBAC / Audit | TODO | real+mock | |
| POS register (full-screen) | TODO | real | |
| Customer storefront (`apps/storefront`) | TODO | commerce API | |

## Backend contracts needed (for the backend team)
Surfaces currently on mock that need APIs to go "real" (see `feature-status.ts` for keys):
- CRM: `customers.list/get/create/update`, customer balances & order history.
- Suppliers/vendors: list/get/create/update, supplier balances.
- AR: receivables aging; AP: payables aging + payment scheduling.
- Pricing: price lists + rules engine. Promotions: promo CRUD + applicability.
- Inventory adjustments: post adjustment (reason-coded, affects valuation).
- Notifications: feed + read state + preferences.
- Branding: per-tenant persistence of the branding config.

## Local preview
- `apps/web/.env`: `VITE_SERVER_URL` (valid URL required for env to load) + `VITE_PREVIEW_NO_AUTH=true` (frontend-only; remove for real auth).
- Dev: `bun run dev` in `apps/web` (port 3001).
