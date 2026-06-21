# shadcn studio — Free + Pro Inventory

> Registry (configured): `@ss-blocks` → `https://shadcnstudio.com/registry/{name}.json` in `packages/ui/components.json` (key + `{name}` template fixed in this branch).
> ⚠️ **Registry URL unverified**: the standard `{name}.json` template 404s against shadcn studio, so direct CLI registry installs don't yet resolve — **use the studio MCP workflows** (`/cui`, `/iui`, `/rui`, `/ftc`), which emit `npx shadcn add <category>/<section>/<component>`. Confirm the exact registry URL from the studio dashboard. See `INDEX.md` → Remediation.
> Enumerated via the **shadcn-studio MCP server** (`.mcp.json` → `shadcn-studio-mcp`), which served full block metadata **without** a license token (metadata is open; *installing* Pro blocks still needs `EMAIL` + `LICENSE_KEY`).
> Built on shadcn/ui "new-york" base; blocks install owned shadcn primitives as `registryDependencies` and write into `components/shadcn-studio/...`. Motion is the same CSS/Radix micro-motion as core — **no heavy animation runtime**. That makes studio blocks safe for dense RetailOS surfaces, unlike Magic UI.

## Access tiers

- **Metadata / inspiration**: open via studio MCP (`/iui`, `get-blocks-metadata`, `get-inspiration-block-content`).
- **Install (blocks/components/themes)**: Pro license required → set `EMAIL` and `LICENSE_KEY` (Infisical `/credentials/shadcnstudio/`). Currently **unset** → install is blocked.
- Install command format (from the studio MCP): `npx shadcn@latest add <category>/<section>/<component>` (e.g. `npx shadcn@latest add dashboard-and-application/datatable/datatable-component`).

## Catalog by category (from `get-blocks-metadata` + `get-block-meta-content`)

Counts below are **component families** and their enumerated **variants** (`iuiPath`). Variant counts are large; treat each family as "pick the best variant."

### Dashboard & Application — strongest fit for RetailOS

| Family | Variants | What it is | Motion? | RetailOS surface(s) | Verdict |
|---|---|---|---|---|---|
| Application Shell | 9 | Full app frame (nav + sidebar + content) | N (CSS) | Admin, MSP/platform console | **Use** (re-theme to tokens) |
| Dashboard Shell | 9 | Dashboard page scaffolds | N | Executive/admin dashboards | **Use** |
| Dashboard Header | 6 | Top bars w/ profile/settings/search | N | All authed surfaces | **Use** |
| Dashboard Sidebar | 2 | Nav sidebars | N | Admin/MSP | **Maybe** (core `sidebar` may suffice) |
| Charts Component | 5 | Dashboard chart sections | Y (chart enter) | Dashboards, accounting | **Use** (disable anim on live data) |
| Statistics Component | 3 | KPI/metric stat cards | N | Exec dashboards, POS EOD | **Use** |
| Widgets Component | 2 | Mixed dashboard widgets | N | Dashboards | **Use** |
| Multi-step Form | 3 | Wizard forms | N (step transitions) | Onboarding, product setup | **Use** |
| Account Settings | 2 | Settings panels | N | Admin/user settings | **Use** |
| Form Layout | 2 | Structured form pages | N | Admin data entry | **Use** |
| Dashboard Dialog | 2 | In-dashboard modals | Y (fade/zoom) | All | **Use** |
| Dashboard Dropdown | 2 | Nav dropdowns | Y (fade) | All | **Use** |
| Empty State | 1 | Empty placeholders | N | All lists | **Use** |
| File Upload | 1 | Upload UI | N | Catalog/import, docs | **Use** |
| Onboarding Feed | 1 | Onboarding checklist/feed | N | Onboarding | **Use** |
| Card Nav / Dashboard Footer | 1 each | Card-style nav, footer | N | Dashboards | **Maybe** |

### DataTable — `npx shadcn add datatable/datatable-component` (TanStack Table based)

7 production variants, each declaring real deps (`@tanstack/react-table`, `lucide-react`; some `papaparse`+`xlsx` for export) and shadcn `registryDependencies`:

| Variant | Domain (from metadata) | Notable | RetailOS surface(s) | Verdict |
|---|---|---|---|---|
| datatable-component-01 | Financial transactions | avatars, USD format, status badges, payment-method icons, row actions, pagination | Accounting, POS settlement | **Use** |
| datatable-component-02 | Course/LMS mgmt | filter, sort, bulk-select, progress bars | (low RetailOS fit) | **Maybe** |
| datatable-component-03 | Fleet/vehicle routes | progress, warnings, action menus | Logistics/warehouse dispatch | **Use** |
| datatable-component-04 | User administration | role mgmt, subscription, tooltips, multi-select filter | Admin/MSP user mgmt | **Use** |
| datatable-component-05 | Invoice management | search, page-size, billing status | Accounting/billing | **Use** |
| datatable-component-06 | Product/inventory | switches, **CSV/Excel/JSON export**, stock tracking | Warehouse/inventory, catalog admin | **Use** (high value) |
| datatable-component-07 | Product analytics | **embedded Recharts**, trend indicators, export | Exec/merch analytics | **Use** |

> These are the single best RetailOS-fit items in the whole inventory — they map almost 1:1 to accounting, inventory, admin, and logistics surfaces and are built on the owned `table` + TanStack Table, not a foreign grid.

### eCommerce — storefront fit

| Family | Variants | RetailOS surface(s) | Verdict |
|---|---|---|---|
| product-list | 1 | Storefront catalog | **Use** |
| product-overview | 2 | Storefront PDP | **Use** |
| product-quick-view | 1 | Storefront PDP modal | **Use** |
| product-category | 1 | Storefront category page | **Use** |
| category-filter | 1 | Storefront faceted filter | **Use** |
| product-reviews | 2 | Storefront PDP | **Use** |
| shopping-cart | 1 | Storefront / POS cart | **Use** (POS: re-theme for density) |
| checkout-page | 1 | Storefront checkout | **Use** |
| order-summary | 1 | Checkout / POS receipt | **Use** |
| offer-modal | 1 | Storefront promo | **Maybe** |
| announcement-banner | 1 | Storefront | **Maybe** |
| gift-card | 1 | Storefront / POS | **Maybe** |
| mega-footer | 1 | Storefront footer | **Use** |

### Marketing UI — storefront/marketing/auth

Families (variants): Hero (15), Features (7), Testimonials (4), Social Proof (3), About Us (6), Navbar (2), FAQ (2), Pricing (2), Blog (2), Contact Us (2), Error page (2), Portfolio (2), Team (2), plus singletons: CTA, Footer, Logo Cloud, Gallery, Cookies Consent, App Integration, Compare, Timeline, User Schedule, Download.

Auth-related (Marketing UI): Login Page, Register, Forgot Password, Reset Password, Two Factor Authentication, Verify Email.

| Group | RetailOS surface(s) | Verdict |
|---|---|---|
| Hero / Features / Pricing / Testimonials / Social Proof / CTA / FAQ / Footer / Navbar / Logo Cloud | Marketing site, storefront landing | **Use** (motion-light, re-theme) |
| Login / Register / Forgot / Reset / 2FA / Verify Email | Auth & onboarding | **Use** (compare vs core login/signup blocks; studio adds 2FA/verify which core lacks) |
| About / Team / Blog / Gallery / Portfolio / Compare / Timeline | Marketing | **Maybe** |
| Cookies Consent / Announcement / Download | Marketing utility | **Maybe** |

### Bento Grid

| Family | Variants | RetailOS surface(s) | Verdict |
|---|---|---|---|
| Bento Grid | 10 | Dashboard/marketing feature grids | **Maybe** (nice for exec landing, not core data) |

### Theme presets

shadcn studio also ships installable **theme presets** via the studio MCP `install-theme` (public themes like `modern-minimal`, or private UUID themes). Not enumerated here individually; relevant only as a starting palette — RetailOS must use its own §5 tokens, so themes are **Skip / reference only**.

## Verdict summary

shadcn studio is the **highest-value Pro source for RetailOS** because it is shadcn-native (re-themes cleanly, composes on owned primitives, no animation runtime). Priority pulls: **DataTable 01/03/04/05/06/07**, **Application/Dashboard Shell**, **Statistics**, **Multi-step Form**, **eCommerce product/cart/checkout**, and **auth (2FA/verify-email)**. Blocked only by the missing `EMAIL`/`LICENSE_KEY` and the `@`-prefix config bug.
