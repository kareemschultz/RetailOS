# RetailOS — UI/UX, Design System & Component-Sourcing Plan

> **Status:** Phase 0 planning (design only — no implementation code).
> **Source of truth:** charter **§5 (UI/UX, Design System, Component Libraries, Motion)**, with §11 (white-label) and §44 (performance budgets). The **enumerated component catalog** is owned by `docs/architecture/ui-inventory/` (`INDEX.md` + per-source files) — this plan **references** it and does **not** re-enumerate it.
> **Audit date:** 2026-06-21. Verified against the live repo (`components.json`, ADR 0001) and the ui-inventory audit.

---

## 1. Primitive Layer — Base UI (verified)

RetailOS uses **Base UI** as the headless primitive under shadcn (shadcn supports Radix *or* Base UI; one is chosen project-wide). This is **decided and verified**: the repo's `components.json` `style` is **`base-lyra`**, which is the Base UI style, and the decision is recorded in **ADR 0001 (`adr/0001-base-ui-primitive.md`)**.

Rationale (§5): consistent component API, strong a11y (ARIA, focus trapping, keyboard nav), first-class enter/exit transition hooks (`data-[starting-style]`/`data-[ending-style]`, `data-[open]`/`data-[closed]`), RTL support. **Rule:** never mix Radix and Base UI variants of the same component in one project. Scaffold every primitive via the **official shadcn CLI / MCP** (`npx shadcn@latest add …`) — never hand-write a primitive from memory (§5 "Official Shadcn Toolchain").

---

## 2. Four-Tier Component Sourcing (§5)

Composition-first: every component is copy-paste and **owned in-repo** (shadcn philosophy), never an opaque runtime dependency. The exact item counts and slugs live in `ui-inventory/`; the durable tiers and boundaries:

| Tier | Source (namespace) | Use for | Auth | Motion runtime? |
|---|---|---|---|---|
| **1 — Free foundation** | shadcn/ui core (`@shadcn`) | All functional UI: forms, data tables, dialogs, sidebar, command palette, charts. The owned base. | none | CSS/Base-UI micro-motion only |
| **2 — Free ecosystem** | ReUI (`@reui`, MIT) | Data-dense operational components (Data Grid, Filters, Kanban, File Upload). Safe on dense surfaces (no animation runtime). | none (pinned `base-nova` style) | none |
| **3 — Premium** | shadcn studio Pro (`@shadcn-studio`/`@ss-blocks`/`@ss-components`/`@ss-themes`) + Magic UI Pro (`@magicui-pro`); Magic UI free (`@magicui`) | studio Pro → dense app/dashboard/ecommerce/auth blocks; Magic UI (free + Pro) → marketing/storefront/onboarding motion. | studio: `EMAIL`+`LICENSE_KEY`; Magic UI Pro: Bearer token; Magic UI free: none | studio: CSS/Radix micro-motion (safe on dense); Magic UI: Framer-Motion (marketing only) |
| **4 — Custom (gaps)** | built in `packages/ui` on shadcn/Base UI | The ~13 RetailOS-specific builds in `gaps-and-custom.md` (offline-status indicator, fiscal/thermal receipt preview, cash-drawer & shift panel, split/multi-currency payment pad, bin/zone scan UI, landed-cost allocator, bonded-vs-released view, barcode/label designer, …). | n/a (owned) | per-surface budget |

**Selection rule (§5):** operational density + speed first (tiers 1–2 + Base UI), motion + delight second (tier 3 Magic UI), and only where it never slows a cashier, warehouse worker, or accountant. **Origin UI** was evaluated and **not adopted** (legacy); **shadcnblocks** was evaluated and **deferred** (overlaps studio Pro, separate paid license — config preserved in `shadcnblocks.md`). **Every** pulled block is **re-themed to RetailOS tokens** before commit — never ship foreign hardcoded colors/radii/fonts (§5).

---

## 3. Radius / Token System (§5, §11)

Soft, friendly, rounded — **driven by tokens, not blanket utility classes**. `rounded-xl` on everything reads as generic; reference the scale instead.

- **Token:** `--radius` drives the scale; tenant overrides via `tenant_ui_config` (`border_radius`, `button_radius`, `card_radius`).
- **Default scale:** large on cards/sheets/dialogs/popovers; medium on buttons/inputs/selects; **pill** (full) on badges/avatars/toggles/switches/chips; small on dense table cells / data-grid controls.
- **White-label contract (§11):** all theme values are CSS custom properties (Tailwind v4, OKLCH/HSL); components **read tokens**, nothing hardcodes color/radius/font. A tenant may flatten to radius 0 or round more — corners reshape globally because every component reads the token.
- **Tokens authored** with the shadcn studio Theme Generator (+ Contrast Checker) or tweakcn; **WCAG AA contrast validated before a tenant theme is saved** (tenant theme contrast guardrails, §11). Themes from any registry are **reference-only** — they carry foreign tokens.
- **Typography:** Geist (UI/sans) + JetBrains Mono (money, quantities, SKUs, codes, logs) with tabular figures wherever money/counts align (tables, receipts). **Density:** comfortable vs. compact, driven by `tenant_ui_config` (`layout_density`/`table_density`) — dense for admin/accounting, large-target for POS/warehouse.

---

## 4. Per-Surface Motion Budget (§5)

Motion is purposeful and performance-bound (Motion engine + Base UI transition primitives). **Animate only `transform`/`opacity`; never `transition: all`. Always honor `prefers-reduced-motion: reduce`** (entering content settles to final state; exits instant).

| Surface | Motion budget |
|---|---|
| **POS checkout path** | Near-zero. Only instant state feedback (button press, line-item add, payment confirm). Speed over delight. **No Magic UI.** |
| **Warehouse / scanning** | Minimal — scan-success / scan-error feedback only. |
| **Admin / accounting tables** | Subtle row/skeleton transitions; no decorative motion. |
| **Dashboards** | Tasteful — animated number tickers, chart enter animations, staggered card reveals. Disable chart enter-animation on **live** data. |
| **Storefront / marketing / onboarding / auth** | Full Magic UI palette acceptable, within reduced-motion rules. |

High-impact moments over scattered micro-interactions. Use **Sonner** (toast) for transient feedback and skeletons for loading; never block the UI on animation.

---

## 5. Surface-by-Surface Component Map (§5)

Summary; concrete per-surface item lists are in `ui-inventory/retailos-surface-map.md` (source of truth for picks).

- **POS:** Button/Button-Group, Command (product search), Combobox (customer/rep lookup), category quick-button grid, Dialog/Sheet (cart/payment/split-payment), Tabs (payment methods), Input/Input-Group (qty/price override), Sonner, Kbd, Drawer (held sales). Large touch targets, monospaced totals, always-visible **offline-status badge** (custom, tier 4).
- **Warehouse / mobile (Expo):** big-target Buttons, scanner-friendly Inputs, Sheet/Drawer (pick/pack), Progress, Badge (bin/zone), Empty states. Tablet-first. *(Registries are web-only — see §8.)*
- **Admin / data tables:** shadcn Data Table (TanStack Table) **virtualized >50 rows**, faceted filters, saved views, column visibility, Pagination, bulk-action toolbars, Context-Menu row actions, Sidebar nav, global Command palette. Compact density. ReUI Data Grid / Filters / Kanban map almost 1:1.
- **Accounting:** spreadsheet-like Data Tables, Tabs (ledgers), posting-status Badges, journal forms (TanStack Form + Field), reconciliation split views (Resizable), audit-trail Sheet. Tabular figures throughout. studio `datatable-01` (financial), `datatable-05` (invoices).
- **Executive dashboards:** shadcn Chart (recharts), Magic UI `number-ticker` (KPIs), staggered Card reveals, Magic UI bento grid, drilldown via Dialog/Sheet, date-range Calendar/Date Picker. Insight cards reference §27 correlated insights.
- **Ecommerce storefront:** studio eCommerce set (product-list/overview/quick-view/category, category-filter, reviews, shopping-cart, checkout-page, order-summary, mega-footer) + Magic UI Pro marketing sections; shadcn forms for checkout; tenant-brand tokens.
- **Auth & onboarding:** studio auth blocks (two-column login, **2FA + Verify-Email which core lacks**), Better-Auth-wired forms, Captcha, Input OTP, **hostname-resolved tenant-branded login** (§11), multi-step wizards (Progress/Stepper), Magic UI delight on success only.
- **Platform / MSP console:** dense Data Tables (tenants/billing/health), status Badges, charts (MRR/usage), **always-visible audited impersonation banners**, feature-flag Switches, residency/attestation panels.

---

## 6. UI Guardrails (§5)

- **Mount `TooltipProvider` at the app layout root** — recent shadcn Tooltip changes make Tooltip-using blocks error without it.
- **Virtualize any list/table >~50 rows** (POS product grids, large admin tables) (§44).
- **Never use `localStorage`/`sessionStorage` for app state** — use in-memory / TanStack Query state + the form-factor offline store engine (Dexie/IndexedDB web, SQLite Tauri/native, §4).
- **A11y (WCAG 2.2 AA target):** icon-only buttons need `aria-label`; visible `focus-visible` rings; semantic button/link; labels bound to inputs; inline field errors with focus-to-first-error.
- **Media:** explicit width/height (prevent CLS); below-fold lazy-load; preconnect to CDN/object-store domains.
- **Touch:** `touch-action: manipulation` on tappable POS/mobile controls; `overscroll-behavior: contain` in modals/drawers/sheets.
- **Destructive actions** (void, refund, delete) require confirmation or undo — never immediate (ties to approval workflows §22).
- **Text containers:** truncate/line-clamp/break-words; `min-w-0` on truncating flex children. Set `color-scheme` + meta `theme-color` for dark themes.

---

## 7. Registry + MCP Authentication Plan (§5, Phase 0)

Source components through the shadcn CLI registries + MCP so agents install by name. Config is **live-verified** in the repo's `components.json` (root + `packages/ui`, mirrored — the shadcn MCP reads root; CLI installs use `-c packages/ui`).

**Configured namespaces (verified):**

| Namespace | Endpoint (verified) | Auth |
|---|---|---|
| `@shadcn` | built-in | none |
| `@magicui` | `https://magicui.design/r/{name}.json` | none |
| `@magicui-pro` | `https://pro.magicui.design/registry/{name}` | Bearer `${MAGICUI_PRO_REGISTRY_TOKEN}` |
| `@shadcn-studio` / `@ss-components` / `@ss-blocks` | `https://shadcnstudio.com/r/{style}/{name}.json` + `params` `email`/`license_key` | `${EMAIL}` + `${LICENSE_KEY}` |
| `@ss-themes` | `https://shadcnstudio.com/r/themes/{name}.json` + params | same |
| `@reui` | `https://reui.io/r/base-nova/{name}.json` (style-pinned) | none |

**Hard rules (verified, from `lessons-learned.md` / §5 / §40):**
- Registry keys **must** start with `@`; every registry `url` **must** contain `{name}` — missing either silently disables **all** registries.
- Some registries are **style-parameterised** (`…/r/{style}/{name}.json` for studio; ReUI pinned to `base-nova`) — not just `{name}`.
- There is **no `--registry` flag** — install by namespaced name (`@magicui/marquee`, `@reui/data-grid`) or full URL.
- A schema-valid entry is **not** proof it resolves; slugs differ from display names (ReUI `file-upload` → `use-file-upload`) — confirm with a live probe. State only **enumerated** counts (don't trust marketing counts).
- studio has **no searchable index** — discover via the studio MCP (`/cui /iui /rui /ftc`, `get_add_command_for_items`) then install by confirmed slug.

**Secrets / license handling (§5/§25):** all tokens (`MAGICUI_PRO_REGISTRY_TOKEN`, `EMAIL`, `LICENSE_KEY`) live in gitignored `.env` (from Infisical) — **never committed, never inlined, never in source/charter/shipped artifacts**. Licenses authenticate the local CLI/IDE only. The shadcn MCP (+ studio MCP) is configured in the IDE; `/mcp` debugs it. **Always review** third-party registry code before committing and **re-theme to RetailOS tokens**.

---

## 8. Native (Expo) — separate track

The registries above are **web-only**. The `apps/native` (Expo, native-uniwind) mobile UI tracks **NativeWind / a React-Native UI kit (e.g. HeroUI Native) separately** (§5). Web component picks do not transfer; the surface-by-surface intent (big targets, scan-friendly inputs, offline badge) is mirrored with native primitives.

---

## 9. Re-validation of ui-inventory Use/Maybe/Skip verdicts vs. §5

The ui-inventory was audited (2026-06-21) **before** §5 was committed; its `INDEX.md` flagged "Charter §5 not present… re-validate all verdicts once §5 is authored." §5 now exists. Re-validation result:

| Verdict | §5 alignment | Holds? |
|---|---|---|
| **Use** `@shadcn` core as owned foundation (56 primitives + blocks/charts) | §5 names it Tier 1, "default for all functional UI" | ✅ Holds |
| **Use** `@reui` (Data Grid/Filters/Kanban) on dense ops surfaces | §5 Tier 2; "no Framer-Motion runtime → safe on dense surfaces" | ✅ Holds |
| **Use** shadcn studio Pro datatables/shells/ecommerce/auth blocks | §5 Tier 3; curated picks (`datatable-01/04/05/06/07`, application-shell, multi-step-form, eCommerce set, 2FA/verify-email) match 1:1 | ✅ Holds |
| **Use** Magic UI (free + Pro) on marketing/storefront/onboarding/auth only | §5 motion budget: full palette there, **never** on POS/high-frequency data entry | ✅ Holds |
| **Maybe/port** Magic UI **Pro** marketing sections (Next.js → Vite/TanStack) | §5 acknowledges porting need + `@radix-ui/react-icons` gotcha (`StarFilledIcon` → lucide) | ✅ Holds (porting caveat noted) |
| **Skip** Origin UI (legacy/maintenance-only) | §5 explicitly "evaluated and NOT adopted" | ✅ Holds |
| **Skip/defer** shadcnblocks (overlaps studio Pro, separate paid license) | §5 explicitly "evaluated and deferred"; config preserved | ✅ Holds |
| **Build custom** the ~13 RetailOS gaps in `packages/ui` | §5 Tier 4 enumerates the same set | ✅ Holds |

**Conflicts found:** **none.** The inventory's Use/Maybe/Skip verdicts are consistent with the now-committed §5. The only open item the inventory raised — "re-validate once §5 exists" — is hereby **closed** (verdicts confirmed). Per §5/§34, re-validate again whenever **either** §5 **or** the inventory changes.

---

## Known limitations / intentionally deferred

- **No UI is built yet** — this is a sourcing/design plan. Component installs happen per-surface during their feature phases (§31), via the official CLI/MCP.
- **Native (`apps/native`) UI kit not yet selected** — HeroUI Native / NativeWind is the tracked candidate but undecided; an ADR will record the choice (§34).
- **Magic UI Pro marketing sections require porting** from Next.js to Vite/TanStack (icon-import + RSC caveats) — deferred to the marketing-site phase.
- **Per-tenant theme generation pipeline** (Theme Generator → contrast validation → `tenant_ui_config`) is designed (§3) but the white-label runtime is a later phase (§31 Phase 11).
- **VRT snapshots** of key surfaces per theme (POS checkout, dashboards, storefront) are required by §4 but the Playwright VRT harness is pending (see `phase-0-checklist.md`).
- studio's lack of a searchable index means discovery stays MCP-driven; no static studio catalog beyond what `ui-inventory/shadcn-studio.md` enumerates.
