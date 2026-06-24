# UI Admin-Shell Findings — AdminCN (shadcn studio) evaluation

- **Status:** RESEARCH / findings — **no install, no code.** Owner asked to evaluate shadcn studio's new **AdminCN** admin-dashboard template (released 2026‑06‑23) for RetailOS and write up findings. Belongs to the **design-language track** (with PR #12), NOT the Phase‑4 backend. Live-verified against the studio template page, the official docs, the shadcn registry CLI, and our own committed UI inventory (`ui-inventory/`).
- **TL;DR (CORRECTED 2026-06-24 after authenticated MCP/CLI verification — see §4):** The *named* AdminCN template is a Pro full-app **download** (Next.js 16) — not a single registry slug. **BUT the shadcn-studio dashboard BLOCKS that compose it ARE authenticated-registry/MCP-installable** via our `@ss-blocks` namespace + the studio MCP (EMAIL + LICENSE_KEY already wired), and — verified by viewing `@ss-blocks/application-shell-01` — the registry **serves them in our `base` style using Base UI** (`render` prop, `@/registry/base/ui/*`), **not Radix**. So the earlier "Radix-incompatible / download-only" caveat was **WRONG**. The only real gaps: blocks carry Next.js `app/page.tsx` page targets (port to TanStack Start routes) + demo content/branding (re-theme to RetailOS tokens). **Path:** pull studio dashboard blocks into `packages/ui` via the authenticated CLI/MCP (`-c packages/ui`), port the page wiring, re-theme; use the AdminCN template + Figma as the *composition* reference for which blocks to assemble per surface.

## 1. What AdminCN is (verified)

- **A full Next.js application template**, not composable registry blocks. Pro‑Plan download + Figma; live preview `shadcn-nextjs-admincn-admin-template.vercel.app`.
- **Scope:** 9 dashboards (Sales, Finance, Logistics, Productivity, Campaign, Analytics, Payments, E‑Commerce, Orders), 6 apps (Mail, Chat, Kanban, Calendar, Contacts, Users), 50+ pages (landing, pricing, FAQ, onboarding, auth, error, empty, settings), 4 form/table layouts, 5 chart/component sets.
- **Tech stack (✅ VERIFIED against the actual v1.0.0 source zip, 2026-06-24 — supersedes the marketing-page reading):** **Next.js 16.2.6** App Router (`rsc: true`) · **React 19.2.4** · **Tailwind v4** · **shadcn/ui on Base UI** (`@base-ui/react` 1.6.0, `components.json` style `base-vega`) — **NOT Radix** (zero `@radix-ui/*` deps) · TypeScript strict · **Zustand 5** · **TanStack Table 8.21** (⚠️ **no `@tanstack/react-query`** — data is **Next Server Actions + `fake-db`**, not React Query) · **React Hook Form 7.79 + Zod 3.25** · **Recharts 3.8** · **Lucide** · **Sonner 2** · **Nuqs 2.8** · date‑fns + React Day Picker.
- **Why this live-probe correction matters (the template itself is Base UI):** the marketing page labelled it "shadcn (Radix)"; the **real source is Base UI** — the *same primitive family as RetailOS* (`base-lyra`). The primitive concern was never real (confirmed twice: the studio registry serves us Base UI, AND the template ships Base UI). **⚠️ Auth: no `@clerk/*` dependency** — Clerk is a *documented integration option*, not bundled. The source zip is kept **gitignored** as reference/mining material (Pro-licensed; we don't fork — `engineering-principles.md` §C).
- **Theme customizer:** live control of theme preset (10+), font, color mode, radius, content layout, scale, sidebar variant & mode — "all update live without rebuild."
- **Delivery (CORRECTED):** the *named template* `admincn` is NOT a single registry slug (`shadcn view @ss-blocks/admincn` + variants 404; not in the studio MCP block metadata) — it's a Pro full-app **download** + Figma. **HOWEVER, the studio dashboard BLOCKS it is built from ARE authenticated-registry/MCP-installable** — verified: `shadcn view @ss-blocks/application-shell-01` resolves with our license and returns a `registry:block` whose content imports `@/registry/**base**/ui/*` and uses the Base UI `render` prop. So "reference to port" applies to the *cohesive app/Figma*, while the constituent *blocks* are first-class `shadcn add`-able into our Base UI project.

## 2. Fit vs the RetailOS stack

| Dimension | RetailOS | AdminCN | Verdict |
|---|---|---|---|
| Framework (template app) | **TanStack Start** SSR (+ Tauri static, Expo) | **Next.js 16** App Router / RSC | ⚠️ The *template app* shell/routing/RSC/`nuqs` are Next‑coupled — port compositions, don't fork the app |
| Page targets (blocks) | TanStack Start routes | studio blocks target `app/page.tsx` | ⚠️ Port each block's page wiring to a TanStack Start route (the block body is portable) |
| Primitive | **Base UI** (`base: base`) | **studio registry serves Base UI in our `base` style** — VERIFIED: `render` prop, `@/registry/base/ui/*` | ✅ **Compatible** — the earlier "Radix" claim was WRONG; the authenticated registry adapts to our primitive |
| Delivery (named template) | registry `add` | Pro full-app **download** + Figma | ⚠️ The *template* is a download/reference (not a single registry slug) |
| Delivery (constituent blocks) | registry `add` | **authenticated `@ss-blocks` / studio MCP** | ✅ The blocks ARE `shadcn add`-able (verified `application-shell-01` resolves with our license) |
| Tailwind | v4 | v4 | ✅ |
| State / data | Zustand + TanStack Table (+ TanStack Query) | Zustand + TanStack Table; **data via Server Actions, NO React Query** | ⚠️ Table/Zustand align; AdminCN has no query lib — we use **oRPC + TanStack Query** |
| Forms | TanStack Form (charter) / RHF+Zod elsewhere | RHF + Zod | ⚠️ AdminCN uses RHF; charter standard is TanStack Form — port forms, don't copy |
| Charts | `@shadcn/chart` (Recharts) | Recharts | ✅ |
| Icons / toast | Lucide / Sonner | Lucide / Sonner | ✅ (studio blocks use an `IconPlaceholder` adapting to lucide/tabler/hugeicons/phosphor) |
| License | studio EMAIL + LICENSE_KEY wired | **Pro Plan** | ⚠️ Studio *blocks* already resolve with our key; **verify** the full *template download* tier separately |

**Net (corrected):** library AND primitive align — the authenticated studio registry serves **Base UI** blocks in our style. The only real gaps are (a) Next.js `app/` page targets → port to TanStack Start routes, and (b) demo content/branding → re-theme to RetailOS tokens. The *named AdminCN template* (cohesive 9-dashboard app + theme-customizer wiring) is a download/reference; its *building-block content* is authenticated-registry-installable. So studio blocks are a **viable accelerator** for the admin/dashboard surfaces, not merely a reference.

## 3. What is genuinely valuable to take

- **The 9 dashboard compositions** — map cleanly to RetailOS surfaces (§5 below). Big time‑saver for layout/section structure even when re‑implemented.
- **The theme customizer pattern** — font/color/radius/sidebar/scale + presets is *exactly* our white‑label `tenant_ui_config` contract (charter §11). Strong reference for the tenant theming + radius/density token wiring (already specified in §5 of the charter).
- **The 50+ page/state catalogue** — auth, onboarding, settings, error, empty states — covers many charter §5 wizards/states; good structural reference.
- **The Figma source** — useful for the design-language track regardless of the code-stack mismatch.

## 4. Correction (2026-06-24) — verified via the authenticated studio MCP/CLI

**My first pass was wrong on two points and I'm recording the correction (charter §40).** I initially concluded "AdminCN is Radix + download-only, incompatible with our Base UI" — extrapolated from (a) four *guessed* registry slugs returning 404 and (b) the marketing page's "Next.js / shadcn (Radix)" stack label. I had NOT queried the authenticated shadcn-studio MCP/CLI — exactly the lesson-#8 anti-pattern ("no searchable index ≠ broken; discover studio items via the studio MCP, not guessed `view` slugs").

**What the authenticated tools actually show:**
- `get-blocks-metadata` (studio MCP) enumerates the installable **block catalog** — `dashboard-and-application` (Application Shell ×9, Dashboard Shell ×9, Header ×6, Sidebar, Statistics ×3, Widgets, Charts ×5, Account Settings, Form Layout, Empty State, File Upload, Onboarding Feed, Multi-step Form), Datatable, eCommerce, Marketing UI. AdminCN the *named template* is NOT in it (confirming it's a separate full-app product).
- `shadcn view @ss-blocks/application-shell-01` (with our license) **resolves** and returns a `registry:block` whose source imports `@/registry/**base**/ui/{button,sidebar,card,avatar,breadcrumb,separator}` and uses the **Base UI `render` prop** (`<SidebarMenuButton render={<a href='#' />}>`), an `IconPlaceholder` that adapts to our `lucide`, and a `target` of `app/application-shell-01/page.tsx`.

**Conclusion:** the **Base-UI-vs-Radix concern does NOT apply** to the authenticated studio-blocks path — the registry serves a `base` (Base UI) variant in our project style. Studio dashboard blocks are first-class installable into `packages/ui`. The only genuine port work is the Next.js `app/` page target → a TanStack Start route, plus re-theming demo content to RetailOS tokens. (The standalone *AdminCN template repo* is still Next.js 16 — but that matters only if we forked the app, which we won't; we assemble from blocks.)

## 4b. What the official AdminCN docs reveal (install, structure, data, auth, theming)

Read from the AdminCN docs (`shadcnstudio.com/docs/documentation-admin/*`). The decisive insight: **AdminCN's Next-coupled layers are exactly the ones RetailOS already replaces with its own stack** — so the framework mismatch is *low-cost*, because we don't want those layers anyway.

- **Install:** a **downloaded/extracted full Next.js repo** ("from the root of the extracted template folder" → `pnpm install`, Node 18.17+, env vars). Confirms: the *template* is a download, not a CLI/registry scaffold.
- **Folder structure:** `src/app/(pages)` (admin-shell routes) · `src/app/(blank)/(auth)` (auth screens) · `src/app/api` + `src/app/server` (route handlers + **Server Actions**) · **`src/views`** (page-level UI modules for *dashboards / datatables / forms / apps* — **the portable layer**) · `src/components` (shadcn primitives + shared) · `src/store` (Zustand: calendar/chat/contact/kanban/mail/roles/users) · `src/configs` (nav/menus/theme) · `src/fake-db` (mock data) · `src/assets` (command-palette search data, SVG).
- **Data layer:** mock `src/fake-db` served via `src/app/api` + **Next.js Server Actions** (`src/app/server`). The "use a real API" guide = delete fake-db/api/server, replace calls with your backend. **RetailOS replaces this wholesale with oRPC + TanStack Query** — Server Actions don't exist in TanStack Start, and we have our own typed API. *Not a loss — we don't want their data layer.*
- **Auth:** **documents a Clerk integration** (`Providers.tsx`, `auth/` guards, `authConfig.ts`, `proxy.ts`, `(auth)` routes) — but **Clerk is NOT a bundled dependency** (no `@clerk/*` in `package.json`); the auth scaffolding is integration-ready, not hard-wired. **RetailOS uses Better Auth (charter §6)** — we replace the auth wiring, reuse only the auth *page layouts* (re-themed). *Not a loss.*
- **Theming/customizer:** `src/configs/themeConfig.ts` controls font/radius/scale/content-width/sidebar-variant/color-mode/theme-preset; CSS vars in `globals.css`; presets from `utils/themePresets.ts`; **settings persist via cookies** (`settingsCookieName`); nav in `navConfig.tsx`; command palette in `assets/data/search.ts`. **This is a concrete reference architecture for our `tenant_ui_config` white-label (§11)** — config-driven font/radius/density/sidebar + a live customizer is precisely what we need (we'd persist per-tenant in `tenant_ui_config`, not a cookie).
- **Components docs expose a `?base=radix` vs `?base=base` toggle** — corroborating that studio ships **both** Radix and Base UI variants; our `base`-configured project pulls Base UI (verified in §4).

**Portable vs Next-coupled (the take-away):**

| AdminCN layer | RetailOS action |
|---|---|
| `src/views` dashboard/datatable/form compositions | ✅ **Mine + port** (React/Tailwind, Base-UI-compatible) into `packages/ui` |
| studio dashboard **blocks** (registry) | ✅ **Install** via authenticated `@ss-blocks`/MCP (Base UI, our style) |
| `themeConfig.ts` + customizer + `navConfig` + command-palette `search.ts` | ✅ **Reference pattern** for `tenant_ui_config` + Cmd-K |
| Zustand app stores (kanban/calendar/mail…) | ✅ Reference (we use Zustand) |
| `src/app` routing / RSC / `(pages)`/`(blank)` | ❌ Replace with **TanStack Start routes** |
| `src/app/api` + `src/app/server` Server Actions | ❌ Replace with **oRPC + TanStack Query** |
| Clerk auth (`Providers`, guards, `authConfig`) | ❌ Replace with **Better Auth** |

## 5. AdminCN → RetailOS surface mapping

| AdminCN asset | RetailOS surface (charter §5 / `retailos-surface-map.md`) |
|---|---|
| Sales / Analytics dashboards | Executive + store dashboards; sales-by-* reports (§27) |
| Finance / Payments dashboards | Accounting + cashier/MSP dashboards; AR/AP, cash recon (§20) |
| Logistics dashboard | Warehouse + transfers + bonded/released views (§18, Phase 3) |
| Orders / E‑Commerce dashboards | Ecommerce orders + fulfillment (§21, Phase 8) |
| Kanban / Calendar apps | Procurement/task boards; scheduling (§18/§21) |
| Contacts / Users apps | CRM customers + user/role admin (§7/§21) |
| Auth / onboarding / settings pages | Better Auth screens + setup wizards (§5/§6) |
| Theme customizer | `tenant_ui_config` white‑label theming (§11) |

> POS checkout and warehouse-scan paths are **custom, speed‑first** (charter §5 speed rule) — AdminCN's animated dashboards are *not* a model for those; they belong to the ~13 RetailOS-custom components (`gaps-and-custom.md`).

## 6. What we must build IN that AdminCN does not provide (design-language layer)

These are the PR #12 design-language rules; AdminCN gives the shell, not these:

- **TooltipProvider at app root** (charter UI guardrail) + tooltips on icon-only actions.
- **Density modes** (Comfortable / Compact / Dense) driven by `tenant_ui_config`.
- **Financial data**: right-aligned, monospace (JetBrains Mono), **tabular figures**.
- **Status colors**: dark-on-light **WCAG‑AA Badge** variants — never white-on-color or color-only.
- **Per-module view modes** (Table / Card / Detail / Timeline; + Kanban / Calendar / Map / Hierarchy where the module warrants).
- **Role-based progressive disclosure** (warehouse worker → manager → CFO; same data, different surface).
- **Offline status**: Synced / Syncing / Queued / Failed — **icon + text, never color-only** (custom offline-status indicator, `gaps-and-custom.md`).
- **Global Cmd/Ctrl+K command palette** across products/customers/sales/transfers/reports (`@shadcn/command`).
- **Virtualize >50-row tables**; no decorative motion on the POS path.

## 7. Recommendation & sequencing

1. **Don't fork the AdminCN *app repo*** (its Next.js 16 shell/routing/RSC is Next-coupled). **DO install the studio dashboard BLOCKS** via the authenticated `@ss-blocks` / studio MCP — they resolve in our `base`/Base UI style (verified). Use the AdminCN template + Figma as the *composition reference* for which blocks to assemble per surface.
2. **Foundation stays our stack**: `@shadcn/dashboard-01` (installs in our `base-lyra` style + Base UI — verified) + shadcn studio `@ss-blocks` **Dashboard & Application** set (289 blocks, authenticated-installable + already mapped) for the dense ERP surfaces, all re-themed to RetailOS tokens. Port each block's Next `app/` page target to a TanStack Start route.
3. **Layer the design-language rules** (§6) on top — these are the differentiators AdminCN lacks.
4. **Sequencing:** design-language track, **after PR #12 merges**, on a dedicated UI branch — NOT on the Phase‑4 backend PR. When greenlit: scaffold the shell into `packages/ui` (`-c packages/ui`), port the page wiring to TanStack Start routes, mount TooltipProvider at root, then build the ~13 custom components.

## 8. Known facts to honor when we build (from the docs) + open items

Confirmed from the official docs — bake these into the UI-track plan:
- **Auth:** AdminCN **documents Clerk** (not a bundled dep); RetailOS uses **Better Auth** (§6) → replace `Providers.tsx`/`auth/`/`authConfig.ts`/`proxy.ts`; reuse only the auth *page layouts* (re-themed).
- **Data:** AdminCN is **Next Server Actions + `fake-db`**; RetailOS uses **oRPC + TanStack Query** → replace the data layer entirely; keep the `src/views` UI shapes + the data *contracts* (field names) as a checklist.
- **Forms:** AdminCN uses **RHF+Zod**; charter standard is **TanStack Form** → port forms, don't copy wiring.
- **Theming:** AdminCN persists customizer settings in a **cookie** via `themeConfig.ts`; RetailOS persists per-tenant in **`tenant_ui_config`** (§11) → adopt the *config shape*, not the cookie store.

Open items:
- **License tier:** the studio *blocks* already resolve with our wired `EMAIL`+`LICENSE_KEY` (verified). **Confirm** the full **AdminCN template download** tier separately. Treat keys as secrets — never commit (charter §25; lesson #11: studio CLI errors leak `license_key` in the URL — redact in any logs/issues).
- **Port licensing:** confirm porting AdminCN `src/views` *patterns* into our owned Base UI components is within the template license (shadcn philosophy is owned/copy-paste source, but verify the template's terms before lifting code).
