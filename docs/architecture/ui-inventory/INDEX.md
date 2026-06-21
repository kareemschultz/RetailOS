# RetailOS UI Component Inventory — INDEX

> **Phase 0 read-only discovery** of every component / block / template / theme available to RetailOS across all configured registries (shadcn core, shadcn studio Pro, Magic UI Pro). Output feeds the refinement of charter **§5 (UI/UX, Design System, Component Libraries, Motion)**.
> **Audit date:** 2026-06-21. **Branch:** `docs/ui-inventory`.

## Files in this inventory

| File | Source |
|---|---|
| `shadcn-core.md` | `@shadcn` — owned foundation (Free) |
| `shadcn-studio.md` | shadcn studio Free + Pro (blocks, datatables, ecommerce, marketing, themes) |
| `magic-ui.md` | Magic UI Free components + Magic UI Pro templates/sections |
| `retailos-surface-map.md` | Recommended items per RetailOS surface (POS, warehouse, admin, accounting, exec, ecommerce, auth, MSP, marketing) |

## Methodology

- **Tools only** (no website scraping of registries): shadcn MCP (`list_items_in_registries`, `search_items_in_registries`, `get-block-meta-content`), the **shadcn-studio MCP** (`get-blocks-metadata`, `get_add_command_for_items`), and **official vendor documentation** (`ui.shadcn.com`, `magicui.design/docs`, `pro.magicui.design`) for catalogs that registries could not return due to the access gaps below.
- No installs. No dependency changes to app/UI code. The only files created are these five inventory docs.
- Counts for shadcn studio and Magic UI are **component families** (each has multiple variants); see each file.

---

## Access Matrix

| Source | Namespace (configured) | Reachable? | Authenticated? | Tier(s) | Method used |
|---|---|---|---|---|---|
| shadcn/ui core | `@shadcn` | ✅ Yes | n/a (public) | Free | shadcn MCP — **414 items enumerated** |
| shadcn studio | `@ss-blocks` (fixed; URL unverified) | ⚠️ Metadata only | ❌ No license | Free + **Pro** | shadcn-studio MCP (metadata open, full catalog); **install blocked** (no `EMAIL`/`LICENSE_KEY`); registry URL 404s — use studio MCP |
| Magic UI | `@magicui` (fixed; ✅ recognized) | ✅ Config valid | ❌ No token | Free + **Pro** | Official docs (catalog); CLI now recognizes registry — **only `MAGICUI_PRO_REGISTRY_TOKEN` missing** |

> The shadcn MCP server reads the **root** `components.json` (registries `{}`), not the workspace `packages/ui/components.json` — so even correctly-named Pro registries are invisible to the MCP from the repo root. Use the shadcn **CLI with `-c packages/ui`** for registry installs, and the **shadcn-studio MCP** for studio workflows.

---

## Counts per source & category

### shadcn core (`@shadcn`) — 414 items, all Free
| Category | Count |
|---|---|
| UI primitives | 56 |
| Blocks (74 chart, 16 sidebar, 5 login, 5 signup, 1 dashboard) | 101 |
| Examples/demos | ~235 |
| Internal (sidebar parts) | 13 |
| Themes | 5 |
| Style / hook / lib | 2 / 1 / 1 |

### shadcn studio — families (variants), Pro install
Dashboard & Application **17 families** (~52 variants) · DataTable **7 variants** · eCommerce **13 families** · Marketing UI **~29 families** (Hero 15, Features 7, …) · Bento Grid **1 (10 variants)** · Theme presets (public + private).

### Magic UI — Free + Pro
Free components **~70** (Special Effects 9, Text Animations 18, Core 3, Buttons 6, Backgrounds 11, Device Mocks 3, Other ~25) · Pro **templates 9** · Pro **sections 50+**.

---

## ⚠️ Documentation & config contradictions found (vs official shadcn docs)

While auditing, the README/`components.json` written in commit `eda2e83` were checked against official shadcn documentation (`ui.shadcn.com/docs/registry/namespace`, CLI-3/MCP changelog) **and verified empirically** with `npx shadcn@latest info/search -c packages/ui`. Real contradictions — **fixed and verified in this branch**:

1. **`packages/ui/components.json` was invalid** → `shadcn info -c packages/ui` returned *"Invalid configuration"* and the shadcn MCP returned `NOT_CONFIGURED`. **Two** schema violations, both fixed:
   - **(a) Registry keys must start with `@`.** Official: *"Registry names must start with an '@' symbol."* Had bare `magicui` / `ss-blocks` → renamed to `@magicui` / `@ss-blocks`.
   - **(b) Registry URL must contain the `{name}` placeholder.** Had `https://r.magicui.design` (no template). Proven by isolation: `apps/web` (same style fields, empty registries) validated, `packages/ui` did not. Fixed to `https://r.magicui.design/{name}.json`.
   - ✅ **Verified:** after the fix, `shadcn search @magicui -c packages/ui` is recognized and reports only *"Registry @magicui requires … MAGICUI_PRO_REGISTRY_TOKEN"* — i.e. config is correct; **only the token is missing.**
2. **The `--registry <url>` flag does not exist.** README's Magic UI command (`npx shadcn add --registry https://r.magicui.design <name>`) is invalid. Official install is **namespaced** (`npx shadcn add @magicui/<name>`) or a **full URL**. **Fix:** README updated.
3. **"TanStack Start = MCP commands only, no CLI registry" is false.** shadcn CLI officially supports Vite/TanStack (confirmed: `shadcn info -c apps/web` reports framework `TanStack Start`, Tailwind v4); the studio MCP itself emits `npx shadcn add …`. **Fix:** README reworded.
4. **`@ss-blocks` registry URL is unverified / likely wrong.** With the standard `{name}.json` template the CLI 404s on `https://shadcnstudio.com/registry/registry.json`. shadcn studio is integrated via its **own MCP** (which emits `npx shadcn add <category>/<section>/<component>`), not this registry entry. The `@ss-blocks` entry is kept valid-shaped but its exact URL **must be confirmed from the shadcn studio dashboard**; until then, use the studio MCP workflows (`/cui`, `/iui`, `/rui`, `/ftc`).

Also softened the unverifiable **"shadcn/studio Pro (631+ blocks)"** marketing count to a documented, enumerated reference (this inventory).

## Other gaps + exact remediation

| Gap | Remediation |
|---|---|
| Magic UI install blocked | Set `MAGICUI_PRO_REGISTRY_TOKEN` in `.env` from Infisical `/credentials/magicui/MAGICUI_PRO_TOKEN`. Registry config is now valid & recognized — this token is the **only** remaining blocker. |
| shadcn studio install blocked | Set `EMAIL` and `LICENSE_KEY` in root `.env` from Infisical `/credentials/shadcnstudio/`; meanwhile use the studio MCP workflows (`/cui`, `/iui`, `/rui`, `/ftc`). |
| Registry key naming + URL template | **Fixed & verified** in `packages/ui/components.json`: keys `@magicui`/`@ss-blocks` and URLs carry `{name}.json`. **Still TODO:** confirm the exact `@ss-blocks` registry URL from the shadcn studio dashboard — the standard `{name}.json` pattern 404s, so studio installs should go through its MCP until verified. |
| MCP cannot see workspace registries | shadcn MCP reads root `components.json`; run registry CLI installs with `-c packages/ui`, or add the registries to the root config too. |
| **Charter §5 not present** | `docs/architecture/retailos-master-charter.md` **does not exist** in the repo. Verdicts here use the §5 rules embedded in the Phase-0 task brief (speed/density on POS; motion on storefront/marketing/onboarding; re-theme foreign tokens). **Re-validate all verdicts once §5 is authored.** |
| Native (Expo) surface uncovered | These registries are web-only. Track HeroUI Native / NativeWind separately for `apps/native`. |

---

## Prioritized shortlist — pull first (~20), by surface

**Foundation (now, Free):** the 56 `@shadcn` primitives into `packages/ui` (already the owned base) + `dashboard-01`, a `sidebar-*` pattern, `login-0x`/`signup-0x`.

**shadcn studio (after license + `@`-fix):**
1. `ss: datatable-component-06` — product/inventory + CSV/XLSX export → warehouse/catalog
2. `ss: datatable-component-05` — invoices/billing → accounting
3. `ss: datatable-component-01` — financial transactions → accounting/POS settlement
4. `ss: datatable-component-04` — user/role admin → admin/MSP
5. `ss: datatable-component-03` — fleet/routes → logistics/warehouse
6. `ss: datatable-component-07` — analytics datatable w/ charts → exec
7. `ss: dashboard-and-application/application-shell` — admin/MSP frame
8. `ss: dashboard-and-application/statistics-component` — KPI cards
9. `ss: dashboard-and-application/multi-step-form` — onboarding/product setup
10. `ss: ecommerce/{product-overview, product-list, shopping-cart, checkout-page}` — storefront
11. `ss: marketing-ui/{two-factor-authentication, verify-email}` — auth gaps core lacks

**Magic UI (after token + `@`-fix), motion surfaces only:**
12. `@magicui/number-ticker` — KPI counters (dashboards)
13. `@magicui/animated-circular-progress-bar` — KPI/onboarding
14. `@magicui/marquee` + `@magicui/avatar-circles` — social proof (marketing/storefront)
15. `@magicui/bento-grid` — marketing/dashboard feature grid
16. `@magicui/hero-video-dialog` — marketing hero
17. `@magicui/confetti` — onboarding success
18. Magic UI **Pro Hero / Pricing / CTA / FAQ / Footer** sections — marketing site (port from Next.js)

All Pro items must be **re-themed to RetailOS §5 tokens** and kept **off the POS checkout / high-frequency data-entry paths**.

---

## How this feeds charter §5

- **Component libraries**: confirms the owned foundation is `@shadcn` (56 primitives) + shadcn studio Pro for app blocks (datatables, shells, ecommerce, auth) + Magic UI for marketing/onboarding motion. §5 should name these three tiers and their boundaries.
- **Surface taxonomy**: `retailos-surface-map.md` gives concrete per-surface component lists §5 can adopt directly.
- **Motion budget**: catalog tags each item's motion; reinforces §5's "functional micro-motion on dense/transactional surfaces, expressive motion on storefront/marketing/onboarding."
- **Design tokens**: every Pro item carries foreign colors/radii/fonts → §5's token system must be the single source of truth; themes are reference-only.
- **Action item**: author `docs/architecture/retailos-master-charter.md` §5 and re-validate these verdicts against it.
