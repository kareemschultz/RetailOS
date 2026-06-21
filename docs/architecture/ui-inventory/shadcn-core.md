# shadcn/ui Core — Owned Foundation Inventory

> Source registry: `@shadcn` (`https://ui.shadcn.com/r/{name}.json`) — **built-in, no auth, Free**.
> Enumerated via shadcn MCP `list_items_in_registries` (`limit: 0`, single page returned all 414 items).
> Base config (`packages/ui/components.json`): style `base-lyra`, base color `neutral`, icon library `lucide`, CSS at `packages/ui/src/styles/globals.css`, `tsx: true`, `rsc: false` (Vite/TanStack web app, not Next.js App Router).
> This is the **owned layer**: components are vendored into `packages/ui` and re-themed to RetailOS tokens. Everything else in this inventory is judged against "does it beat the owned core?"

## Counts (414 items total in `@shadcn`)

| Type | Count | Notes |
|---|---|---|
| `registry:ui` (primitives) | 56 | The component library proper |
| `registry:block` | 101 | 74 chart blocks, 16 sidebar, 5 login, 5 signup, 1 dashboard |
| `registry:example` | ~235 | Demos/usage snippets (not installed as features) |
| `registry:internal` | 13 | `sidebar-*` composition parts |
| `registry:theme` | 5 | Color theme presets |
| `registry:style` | 2 | `index`, `style` |
| `registry:hook` | 1 | `use-mobile` |
| `registry:lib` | 1 | `utils` (cn helper) |

> Motion note: shadcn/ui ships **no animation library**. Motion is CSS-only — Radix `data-[state]` transitions (open/close, fade/zoom/slide) via `tailwindcss-animate`. This is exactly the "functional micro-motion" §5 wants on dense surfaces; nothing here is decorative.

---

## UI Primitives (`registry:ui`, 56) — all Free

Primitive on Radix UI unless noted. Install: `@shadcn/<name>` (e.g. `npx shadcn@latest add @shadcn/button`).

| Item | Category | What it is | Motion? | A11y notes | RetailOS surface(s) | Verdict |
|---|---|---|---|---|---|---|
| accordion | Disclosure | Collapsible stacked sections | Y — CSS height/opacity on `data-state` | Radix; keyboard + aria-expanded | Admin settings, FAQ, product specs | **Use** (foundation) |
| alert | Feedback | Static callout (info/destructive) | N | role=alert | All | **Use** |
| alert-dialog | Overlay | Confirm/destructive modal | Y — fade/zoom | Focus trap, role=alertdialog | POS voids/refunds, admin deletes | **Use** |
| aspect-ratio | Layout | Ratio box for media | N | — | Storefront, product images | **Use** |
| avatar | Display | Image w/ fallback initials | N | alt fallback | Users, cashiers, customers | **Use** |
| badge | Display | Status pill | N | — | Order/stock/payment status everywhere | **Use** |
| breadcrumb | Nav | Hierarchical path | N | nav + aria-current | Admin, catalog, settings | **Use** |
| button | Action | Variants: default/secondary/destructive/outline/ghost/link; sizes; asChild | N (CSS hover) | Focus ring, disabled | All | **Use** |
| button-group | Action | Joined buttons, split, w/ input/dropdown/select | N | — | POS quick actions, toolbars | **Use** |
| calendar | Input | react-day-picker month grid | N | Keyboard nav | Date range pickers, scheduling | **Use** |
| card | Layout | Surface container (header/content/footer) | N | — | Dashboards, all panels | **Use** |
| carousel | Display | Embla slides; size/orientation/api/plugin | Y — drag/scroll inertia | aria-roledescription | Storefront product galleries | **Use** (storefront); **Skip** on POS |
| chart | Data viz | Recharts wrapper + tooltip/legend theming | Y — enter animations (configurable) | Needs text alternatives | Dashboards, accounting, analytics | **Use** (disable anim on live tickers) |
| checkbox | Input | Boolean | N | Radix, labelled | Forms, data tables bulk-select | **Use** |
| collapsible | Disclosure | Single open/close region | Y — CSS | aria-expanded | Sidebars, filters | **Use** |
| combobox | Input | Autocomplete (Command + Popover composition) | N | Listbox semantics | Product/SKU/customer pickers (POS) | **Use** (high value) |
| command | Overlay | Command palette / fuzzy menu (cmdk) | N | Listbox + typeahead | Global ⌘K, POS keyboard-first | **Use** (high value) |
| context-menu | Overlay | Right-click menu | Y — fade/zoom | Radix menu a11y | Admin grids, warehouse | **Maybe** (desktop only) |
| dialog | Overlay | Modal | Y — fade/zoom | Focus trap | All | **Use** |
| drawer | Overlay | Bottom sheet (vaul) | Y — spring drag | Focus trap | Mobile/warehouse, POS cart panel | **Use** (mobile) |
| dropdown-menu | Overlay | Action menu | Y — fade/zoom | Radix menu a11y | Row actions everywhere | **Use** |
| empty | Feedback | Empty-state scaffold (icon/avatar/outline/bg) | N | — | All lists/tables | **Use** |
| field | Form | Field wrapper (label/desc/error) for any control | N | Associates label+error | All forms | **Use** (foundation) |
| form | Form | RHF/TanStack/Formisch + zod resolver bindings | N | aria-invalid wiring | All forms | **Use** (foundation) |
| hover-card | Overlay | Hover preview popover | Y — fade | Not keyboard-primary | Storefront, admin previews | **Maybe** (desktop) |
| input | Input | Text field | N | — | All | **Use** |
| input-group | Input | Input w/ addons (icon/button/spinner/textarea) | N | — | Search, POS scan field | **Use** |
| input-otp | Input | One-time-code segmented input | N | — | Auth/2FA, manager override PIN | **Use** |
| item | Layout | Generic list-row primitive (icon/avatar/header/dropdown) | N | — | Lists, settings rows | **Use** |
| label | Form | Form label | N | htmlFor wiring | All forms | **Use** |
| menubar | Nav | App menu bar | Y — fade/zoom | Radix menu a11y | Desktop admin/back-office | **Maybe** |
| navigation-menu | Nav | Mega-menu nav | Y — CSS | Radix nav a11y | Storefront header, admin | **Use** (storefront) |
| pagination | Nav | Page controls | N | nav + aria | Data tables, catalog | **Use** |
| popover | Overlay | Floating panel | Y — fade/zoom | Focus mgmt | Filters, pickers | **Use** |
| progress | Feedback | Determinate bar | Y — width transition | aria-valuenow | Uploads, onboarding, KPIs | **Use** |
| radio-group | Input | Exclusive choice | N | Radix radiogroup | Forms, payment method | **Use** |
| resizable | Layout | Draggable split panes | Y — drag | Keyboard resize | Admin dual-pane, POS split | **Use** |
| scroll-area | Layout | Styled scroll container | N | — | Long lists, panels | **Use** |
| select | Input | Dropdown select | Y — fade/zoom | Radix listbox | All forms | **Use** |
| separator | Layout | Divider | N | role=separator | All | **Use** |
| sheet | Overlay | Side drawer (dialog variant) | Y — slide | Focus trap | Filters, detail panels, mobile nav | **Use** |
| sidebar | Nav | Full app sidebar system (collapsible/icon/inset) | Y — width/slide | Keyboard, aria | Admin/MSP/dashboard shells | **Use** (high value) |
| skeleton | Feedback | Loading placeholder | Y — pulse | aria-busy context | All async surfaces | **Use** |
| slider | Input | Range slider | N | Radix slider | Filters (price), settings | **Use** |
| sonner | Feedback | Toast notifications | Y — slide/fade | Polite live region | All (save/sync/errors) | **Use** |
| spinner | Feedback | Loading indicator | Y — CSS spin | aria-label | All | **Use** |
| switch | Input | Toggle | N | Radix switch | Settings, feature flags | **Use** |
| table | Data | Primitive table parts (composed w/ TanStack) | N | scope/caption | Admin/accounting/warehouse | **Use** (foundation) |
| tabs | Nav | Tabbed panels | N (instant) | Radix tabs | Detail views, settings | **Use** |
| textarea | Input | Multiline text | N | — | Notes, descriptions | **Use** |
| toggle | Action | Two-state button | N | aria-pressed | Toolbars | **Use** |
| toggle-group | Action | Grouped toggles (single/multi) | N | — | View switchers, filters | **Use** |
| tooltip | Overlay | Hover/focus tip | Y — fade | Delay, focusable | All (icon buttons) | **Use** |
| kbd | Display | Keyboard-shortcut hint | N | — | Command palette, POS shortcuts | **Use** |
| native-select | Input | Native `<select>` (groups/disabled/invalid) | N | Native a11y | Mobile/warehouse (rugged, fast) | **Use** (mobile) |
| direction | Util | RTL/LTR provider | N | — | i18n readiness | **Use** |

---

## Blocks (`registry:block`, 101) — all Free

### Application / Dashboard / Auth blocks

| Item | What it is | RetailOS surface(s) | Verdict |
|---|---|---|---|
| dashboard-01 | Sidebar + charts + data table starter | Executive/admin dashboards | **Use** (scaffold to re-theme) |
| sidebar-01 … sidebar-16 | 16 sidebar layouts: sectioned, collapsible, submenus, floating, icon-collapse, file-tree, calendar, dialog, right-side, dual, sticky header | Admin, MSP/platform console, dashboard shells | **Use** (pick 1–2 patterns; sidebar-07 icon-collapse + sidebar-16 sticky header strongest) |
| login-01 … login-05 | Simple / two-col cover image / muted / form+image / email-only | Auth | **Use** (login-02 or login-04 for branded auth) |
| signup-01 … signup-05 | Mirror of login + social-providers variant | Auth/onboarding | **Use** |

### Chart blocks (74) — Free, built on `chart` + Recharts

Families (each a ready Recharts composition; motion = configurable enter animation):

| Family | Count | Variants include | RetailOS surface(s) | Verdict |
|---|---|---|---|---|
| chart-area-* | 10 | default, gradient, linear, step, stacked, stacked-expand, legend, axes, icons, interactive | Dashboards, sales trends | **Use** (disable anim on live data) |
| chart-bar-* | 10 | default, horizontal, stacked, multiple, negative, mixed, label/label-custom, active, interactive | Accounting, inventory, KPIs | **Use** |
| chart-line-* | 10 | default, linear, step, multiple, dots/dots-colors/dots-custom, label/label-custom, interactive | Sales/finance time series | **Use** |
| chart-pie-* | 12 | simple, donut/donut-text/donut-active, stacked, legend, label/label-list/label-custom, interactive, separator-none | Category/segment mix | **Maybe** (pies weak for dense exec views) |
| chart-radar-* | 16 | grid variants, dots, icons, legend, multiple, radius, lines-only, label-custom | Multi-metric comparison | **Maybe** (niche) |
| chart-radial-* | 6 | simple, grid, label, text, shape, stacked | Single-KPI gauges | **Use** (KPI cards) |
| chart-tooltip-* | 10 | indicator/label/formatter variants, icons, advanced | Tooltip patterns to compose | **Use** (reference) |

---

## Theme presets (`registry:theme`, 5) — Free

| Item | What it is | Verdict |
|---|---|---|
| theme-stone / theme-zinc / theme-neutral / theme-gray / theme-slate | Neutral color scales for the base CSS variables | **Use** as starting point, then **must re-map to RetailOS tokens** (charter §5 radius/color scale). Current config already uses `neutral`. |

## Hook & lib — Free

| Item | What it is | Verdict |
|---|---|---|
| use-mobile (hook) | Breakpoint hook for responsive (sidebar/drawer) | **Use** |
| utils (lib) | `cn()` class-merge helper | **Use** (already vendored) |

---

## Verdict summary for the core

Nearly everything in `@shadcn` is **Use** — this is the owned foundation and the benchmark every Pro item is judged against. The only context-sensitive calls:
- **carousel / hover-card / context-menu / menubar** → desktop or storefront only; Maybe on touch/POS.
- **pie & radar charts** → Maybe; bar/line/area/radial are the workhorses for exec dashboards.
- All **theme presets** → Use only as a base; they must be re-tokenized to the RetailOS design system (see §5 gap in `INDEX.md`).
