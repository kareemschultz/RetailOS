# UI Admin-Shell Findings — AdminCN (shadcn studio) evaluation

- **Status:** RESEARCH / findings — **no install, no code.** Owner asked to evaluate shadcn studio's new **AdminCN** admin-dashboard template (released 2026‑06‑23) for RetailOS and write up findings. Belongs to the **design-language track** (with PR #12), NOT the Phase‑4 backend. Live-verified against the studio template page, the official docs, the shadcn registry CLI, and our own committed UI inventory (`ui-inventory/`).
- **TL;DR:** AdminCN is an excellent **design + composition REFERENCE** (and a Figma source) whose **library choices align with ours**, but it is **NOT a drop-in** for RetailOS because of two hard mismatches — **Next.js 16 (App Router/RSC) vs our TanStack Start**, and **Radix vs our Base UI primitive** — and because it ships as a **downloadable full app, not registry blocks**. Mine it for the 9 dashboard layouts + the theme-customizer pattern; port selected pieces into `packages/ui` on Base UI + TanStack Start, re-themed to RetailOS tokens. Do not fork the Next app.

## 1. What AdminCN is (verified)

- **A full Next.js application template**, not composable registry blocks. Pro‑Plan download + Figma; live preview `shadcn-nextjs-admincn-admin-template.vercel.app`.
- **Scope:** 9 dashboards (Sales, Finance, Logistics, Productivity, Campaign, Analytics, Payments, E‑Commerce, Orders), 6 apps (Mail, Chat, Kanban, Calendar, Contacts, Users), 50+ pages (landing, pricing, FAQ, onboarding, auth, error, empty, settings), 4 form/table layouts, 5 chart/component sets.
- **Tech stack (verified from the template page):** **Next.js 16** App Router · **Tailwind v4** · **shadcn/ui on Radix UI** · TypeScript (strict) · **Zustand** · **TanStack Query + TanStack Table** · **React Hook Form + Zod** · **Recharts** · **Lucide** · **Sonner** · **Nuqs** (URL search params) · date‑fns + React Day Picker · ESLint/Prettier.
- **Theme customizer:** live control of theme preset (10+), font, color mode, radius, content layout, scale, sidebar variant & mode — "all update live without rebuild."
- **Delivery confirmed NOT a registry item:** `shadcn view @ss-blocks/{admincn,admin-dashboard,admin-cn,dashboard-admin}` all return **404** against the studio registry (even with our license). It is a repo/Figma download gated behind the **Pro Plan** — so it is a *reference to port*, never `shadcn add`.

## 2. Fit vs the RetailOS stack

| Dimension | RetailOS | AdminCN | Verdict |
|---|---|---|---|
| Framework | **TanStack Start** SSR (+ Tauri static, Expo) | **Next.js 16** App Router / RSC | ❌ **Hard mismatch** — app shell, routing, RSC server components, middleware, `nuqs` are Next‑coupled; not portable wholesale |
| Primitive | **Base UI** (`components.json` `base: base`) | **Radix** | ❌ **Mismatch** — charter §5 forbids mixing Radix + Base UI variants of the same component; AdminCN components need porting to Base UI, not dropping in |
| Delivery | own-in-repo via registry `add` | full‑app **download** (Pro) | ❌ Not `shadcn add` — port, don't install |
| Tailwind | v4 | v4 | ✅ |
| State / data | Zustand, TanStack Query/Table | same | ✅ |
| Forms | TanStack Form (charter) / RHF+Zod elsewhere | RHF + Zod | ⚠️ AdminCN uses RHF; charter standard is TanStack Form — port forms, don't copy |
| Charts | `@shadcn/chart` (Recharts) | Recharts | ✅ |
| Icons / toast | Lucide / Sonner | Lucide / Sonner | ✅ |
| License | studio EMAIL + LICENSE_KEY wired | **Pro Plan** template tier | ⚠️ **Verify** our entitlement covers the *template* (distinct from studio *blocks*) before download |

**Net:** the *library* choices align almost perfectly (Tailwind v4, Zustand, TanStack, Recharts, Lucide, Sonner) — which validates our own stack decisions. The *framework* and *primitive* do not, and the delivery is a full app, so AdminCN is a **reference/port source**, not a foundation we adopt.

## 3. What is genuinely valuable to take

- **The 9 dashboard compositions** — map cleanly to RetailOS surfaces (§5 below). Big time‑saver for layout/section structure even when re‑implemented.
- **The theme customizer pattern** — font/color/radius/sidebar/scale + presets is *exactly* our white‑label `tenant_ui_config` contract (charter §11). Strong reference for the tenant theming + radius/density token wiring (already specified in §5 of the charter).
- **The 50+ page/state catalogue** — auth, onboarding, settings, error, empty states — covers many charter §5 wizards/states; good structural reference.
- **The Figma source** — useful for the design-language track regardless of the code-stack mismatch.

## 4. The decision it surfaces (flag, don't flip)

AdminCN being **Radix + Next‑first** is a data point that the broader shadcn *template/studio* ecosystem leans Radix/Next. Our **Base UI** choice (charter §5; primitive locked project‑wide) makes adopting these templates *more expensive* (every component ports). This is **not** a reason to flip — Base UI was chosen deliberately (consistent API, accessibility, Base UI transition hooks, RTL) and is charter‑locked — but the friction is real and worth an explicit owner decision if we expect to lean heavily on studio/Radix templates. **Recommended: keep Base UI; treat Radix templates as reference-only.** If we ever reconsider, it requires an ADR (no silent change).

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

1. **Do not adopt AdminCN as the app foundation** (Next.js 16 + Radix + full-app download). Use it as a **design/composition reference + Figma**.
2. **Foundation stays our stack**: `@shadcn/dashboard-01` (installs in our `base-lyra` style + Base UI — verified) + shadcn studio `@ss-blocks` **Dashboard & Application** set (289 blocks, already wired + mapped) for the dense ERP surfaces, all re-themed to RetailOS tokens.
3. **Layer the design-language rules** (§6) on top — these are the differentiators AdminCN lacks.
4. **Sequencing:** design-language track, **after PR #12 merges**, on a dedicated UI branch — NOT on the Phase‑4 backend PR. When greenlit: scaffold the shell into `packages/ui` (`-c packages/ui`), port the page wiring to TanStack Start routes, mount TooltipProvider at root, then build the ~13 custom components.

## 8. Open verification items

- **License tier:** confirm our shadcn studio entitlement includes the **AdminCN template download** (Pro template tier may differ from the studio *blocks* our `@ss-*` registries already serve). Treat registry tokens/keys as secrets — never commit them (charter §25; lesson #11: studio CLI errors leak `license_key` in the URL — redact in any logs/issues).
- **Component licensing for port:** confirm porting AdminCN component *patterns* into our own Base UI implementations is within the studio license (it is copy-paste/owned source by shadcn philosophy, but verify the template's terms).
- **Forms:** AdminCN uses RHF+Zod; our charter standard is **TanStack Form** — port forms to TanStack Form rather than copying RHF wiring.
