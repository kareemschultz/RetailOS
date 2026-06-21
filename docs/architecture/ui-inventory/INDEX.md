# RetailOS UI Component Inventory — INDEX

> **Phase 0 read-only discovery** of every component / block / template / theme available to RetailOS across all configured registries (shadcn core, shadcn studio Pro, Magic UI Pro). Output feeds the refinement of charter **§5 (UI/UX, Design System, Component Libraries, Motion)**.
> **Audit date:** 2026-06-21. **Branch:** `docs/ui-inventory`.

## Files in this inventory

| File | Source |
|---|---|
| `shadcn-core.md` | `@shadcn` — owned foundation (Free) |
| `shadcn-studio.md` | shadcn studio Free + Pro — **735 blocks / 61 categories** (all categories live-verified 2026-06-21) |
| `magic-ui.md` | Magic UI Free — **77 distinct components** (245 registry items incl. demos), fully enumerated 2026-06-21 |
| `magic-ui-pro.md` | Magic UI Pro — **100 blocks / 14 categories** (103 items; fully enumerated from live registry 2026-06-21) |
| `reui.md` | ReUI (free, MIT) — data-dense components (Data Grid, Filters, Kanban) for operational surfaces |
| `origin-ui.md` | Origin UI — evaluated, **not configured** (legacy/maintenance-only; not live-verifiable here) |
| `shadcnblocks.md` | Shadcnblocks.com — evaluated, **not configured** (registry live-verified; overlaps studio Pro; paid) |
| `gaps-and-custom.md` | RetailOS-specific components no registry covers — to build custom in `packages/ui` |
| `retailos-surface-map.md` | Recommended items per RetailOS surface (POS, warehouse, admin, accounting, exec, ecommerce, auth, MSP, marketing) |

## Methodology

- **Tools only** (no website scraping of registries): shadcn MCP (`list_items_in_registries`, `search_items_in_registries`, `get-block-meta-content`), the **shadcn-studio MCP** (`get-blocks-metadata`, `get_add_command_for_items`), and **official vendor documentation** (`ui.shadcn.com`, `magicui.design/docs`, `pro.magicui.design`) for catalogs that registries could not return due to the access gaps below.
- No installs. No dependency changes to app/UI code. The only files created are these inventory docs (six under `ui-inventory/` + `lessons-learned.md`).
- Counts are **live-enumerated** per source: `@magicui-pro` and `@magicui` via shadcn CLI `search` (have a searchable index); shadcn studio via `get-block-meta-content` per category (no index). Verified exact for sampled categories — see `lessons-learned.md` #12.

---

## Access Matrix

| Source | Namespace (configured) | Reachable? | Authenticated? | Tier(s) | Method used |
|---|---|---|---|---|---|
| shadcn/ui core | `@shadcn` | ✅ Yes | n/a (public) | Free | shadcn MCP — **414 items enumerated** |
| shadcn studio | `@shadcn-studio` / `@ss-components` / `@ss-blocks` / `@ss-themes` | ✅ Yes | ✅ `EMAIL`+`LICENSE_KEY` set | Free + **Pro** | studio MCP `get-block-meta-content` per category — **735 blocks / 61 categories enumerated** (config `…/r/{style}/{name}.json` + params, live-verified) |
| Magic UI | `@magicui` (free) / `@magicui-pro` | ✅ Yes | ✅ token set | Free + **Pro** | shadcn CLI search — **245 free + 103 Pro items** |
| ReUI | `@reui` | ✅ Yes | n/a (MIT) | Free | `@reui/data-grid` resolves (pinned to ReUI `base-nova` style); no searchable index |
| Shadcnblocks | `@shadcnblocks` (**not configured**) | ✅ (live-verified) | Bearer `${SHADCNBLOCKS_API_KEY}` (paid; free tier no-auth) | Free + **Paid** | `hero1` resolves via direct URL; **skipped** — overlaps studio Pro, needs separate license. Config preserved in `shadcnblocks.md` |

> Registries are mirrored into **both** the root `components.json` (the shadcn MCP reads root) and `packages/ui/components.json` (CLI installs use `-c packages/ui`). Origin UI is **not** configured — legacy/maintenance-only per its repo and bot-blocked here (see `shadcn-studio.md` / README).

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

### shadcn studio — **735 blocks across 61 categories** (enumerated per-category via `get-block-meta-content`; full catalog in `shadcn-studio.md`)
Dashboard & Application **19 categories / 289 blocks** (e.g. application-shell 18, widget-component 20, datatable 7) · Marketing UI **29 categories / 362 blocks** (e.g. hero-section 41) · eCommerce **13 categories / 84 blocks** · plus theme presets.
> ✅ **All 61 categories independently live-verified** (`get-block-meta-content` per category, 2026-06-21) — every per-category count matches `shadcn-studio.md`, zero discrepancies, no errored endpoints. (Correction, `lessons-learned.md` #12: an earlier pass reported **~146** from `get-blocks-metadata`'s `/iui` iuiPath, which undercounts; per-category content is authoritative.) The ~15 delta to the advertised "750+" is free blocks outside the enumerated category paths.

### Magic UI — Free + Pro
**Free** (`@magicui`): **77 distinct components** across 245 registry items (the other ~166 are demos/examples + `index`/`utils`) — Special Effects 17, Text Animations 17, Core Animations 14, Buttons 6, Backgrounds 10, Device Mocks 4, Other ~9. Full catalog in `magic-ui.md`. Nearly all Framer-Motion animated → marketing/storefront/onboarding only.
**Pro** (`@magicui-pro`): **100 blocks** across 14 categories (Hero 26, CTA 13, Footer 11, Animated Feature Card 10, Pricing 9, Social Proof 10, Stats 5, Header 5, FAQ 4, Feature 4, Carousel 2, Feature Scroll 1) + 2 themes + 1 style = 103 items. Full slug-level inventory in `magic-ui-pro.md`.

---

## ⚠️ Documentation & config contradictions found (vs official shadcn docs)

While auditing, the README/`components.json` written in commit `eda2e83` were checked against official shadcn documentation (`ui.shadcn.com/docs/registry/namespace`, CLI-3/MCP changelog) **and verified empirically** with `npx shadcn@latest info/search -c packages/ui`. Real contradictions — **fixed and verified in this branch**:

1. **`packages/ui/components.json` was invalid** → `shadcn info -c packages/ui` returned *"Invalid configuration"* and the shadcn MCP returned `NOT_CONFIGURED`. **Two** schema violations, both fixed:
   - **(a) Registry keys must start with `@`.** Official: *"Registry names must start with an '@' symbol."* Had bare `magicui` / `ss-blocks` → renamed to `@magicui` / `@ss-blocks`.
   - **(b) Registry URL must contain the `{name}` placeholder.** Had `https://r.magicui.design` (no template). Proven by isolation: `apps/web` (same style fields, empty registries) validated, `packages/ui` did not. Fixed to `https://r.magicui.design/{name}.json`.
   - ✅ **Verified:** after the fix, `shadcn search @magicui -c packages/ui` is recognized and reports only *"Registry @magicui requires … MAGICUI_PRO_REGISTRY_TOKEN"* — i.e. config is correct; **only the token is missing.**
2. **The `--registry <url>` flag does not exist.** README's Magic UI command (`npx shadcn add --registry https://r.magicui.design <name>`) is invalid. Official install is **namespaced** (`npx shadcn add @magicui/<name>`) or a **full URL**. **Fix:** README updated.
3. **"TanStack Start = MCP commands only, no CLI registry" is false.** shadcn CLI officially supports Vite/TanStack (confirmed: `shadcn info -c apps/web` reports framework `TanStack Start`, Tailwind v4); the studio MCP itself emits `npx shadcn add …`. **Fix:** README reworded.
4. **`@ss-blocks` registry URL — RESOLVED.** The first guesses (`/registry/{name}.json`, then context7's `/r/blocks/{name}.json`) both 404'd; the live API revealed the real shape: `https://shadcnstudio.com/r/{style}/{name}.json` with query **`params`** `email`+`license_key` (the segment after `/r/` is a *style* — `base-lyra` is valid). Now configured for `@shadcn-studio`/`@ss-components`/`@ss-blocks` (+ `@ss-themes` at `/r/themes/{name}.json`). Studio still has **no searchable index** (`search` 404s) → discover via the studio MCP, install by confirmed slug.

Also softened the unverifiable **"shadcn/studio Pro (631+ blocks)"** marketing count to a documented, enumerated reference (this inventory).

## Other gaps + exact remediation

| Gap | Remediation |
|---|---|
| ~~Magic UI / studio install blocked~~ | **RESOLVED.** `MAGICUI_PRO_REGISTRY_TOKEN`, `EMAIL`, `LICENSE_KEY` are set in root `.env` (from Infisical); all registries live-verified (245 + 103 Magic UI; 735 studio blocks; `@reui/data-grid`). |
| ~~Registry config / MCP root visibility~~ | **RESOLVED.** Registries mirrored into root + `packages/ui` `components.json`, keys `@`-prefixed, URLs corrected to the live-verified templates (Magic UI `…/r/{name}.json` & `pro…/registry/{name}`; studio `…/r/{style}/{name}.json` + params; ReUI `…/r/base-nova/{name}.json`). |
| shadcn studio searchable index | None published (`search @ss-blocks` 404s) — discover/confirm slugs via the studio MCP (`/cui`, `get_add_command_for_items`) before CLI install. |
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
