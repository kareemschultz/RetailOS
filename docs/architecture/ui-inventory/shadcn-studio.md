# shadcn/studio Pro — Complete Block Inventory

> **Style:** `base-lyra` (RetailOS)  
> **Enumeration method:** `get-block-meta-content` per category via MCP — live registry data, not guessed names  
> **Last enumerated:** 2026-06-21  
> **Total confirmed blocks:** 289 across 19 categories  
> **Categories not yet enumerated:** Marketing UI (hero, features, pricing, CTA, FAQ, testimonials), eCommerce  

---

## How to Install

```bash
# Via shadcn CLI (credentials in .env)
npx shadcn@latest add @ss-blocks/<slug> -c packages/ui

# Via MCP (preferred for discovery)
# /cui "describe what you need" — install via MCP commands
```

Slugs are kebab-case with zero-padded two-digit numbers (e.g. `widget-component-01`). The MCP is the authoritative source — use `get-block-meta-content` per category, not padded guesses.

---

## Flags

| Flag | Meaning |
|---|---|
| `[Pro]` | `isPro: true` in registry metadata — highest-tier blocks |
| `[New]` | `isNew: true` — added 2026-02-13 to 2026-03-13 wave |

---

## Category Index

| Category | Section Slug | Count | Notes |
|---|---|---|---|
| [Application Shell](#application-shell) | `application-shell` | 18 | Full-page app layouts |
| [Dashboard Shell](#dashboard-shell) | `dashboard-shell` | 9 | Dashboard page frames |
| [Dashboard Header](#dashboard-header) | `dashboard-header` | 18 | Top nav + header variants |
| [Dashboard Sidebar](#dashboard-sidebar) | `dashboard-sidebar` | 11 | Sidebar nav — 3 Pro blocks |
| [Dashboard Footer](#dashboard-footer) | `dashboard-footer` | 10 | Footer with social/branding |
| [Dashboard Dialog](#dashboard-dialog) | `dashboard-dialog` | 26 | Modal dialogs |
| [Dashboard Dropdown](#dashboard-dropdown) | `dashboard-dropdown` | 23 | Dropdown menus |
| [Statistics Component](#statistics-component) | `statistics-component` | 22 | KPI/metric cards — 3 Pro |
| [Charts Component](#charts-component) | `charts-component` | 56 | Recharts-based visualizations |
| [Widgets Component](#widgets-component) | `widgets-component` | 20 | Standalone dashboard widgets |
| [DataTable Component](#datatable-component) | `datatable-component` | 7 | TanStack Table data grids |
| [Multi-Step Form](#multi-step-form) | `multi-step-form` | 3 | Stepperize-powered wizards |
| [Account Settings](#account-settings) | `account-settings` | 7 | Full settings page sections |
| [Form Layout](#form-layout) | `form-layout` | 9 | Form patterns + wizards |
| [Card Nav](#card-nav) | `card-nav` | 6 | Tabbed/navigable cards |
| [Empty State](#empty-state) | `empty-state` | 8 | Zero-data placeholders |
| [Onboarding Feed](#onboarding-feed) | `onboarding-feed` | 5 | Onboarding flows |
| [File Upload](#file-upload) | `file-upload` | 7 | Upload forms + managers |
| [Bento Grid](#bento-grid) | `bento-grid` | 24 | Animated feature grids |

---

## Application Shell

> Full-page application layouts — CRM, e-commerce, financial, analytics, content management

**18 blocks** · `application-shell-01` through `application-shell-18`

```bash
npx shadcn@latest add @ss-blocks/application-shell-01 -c packages/ui
```

All variants share `sidebar` + `card` deps. Cover shells for CRM, e-commerce, content management, financial platforms, admin panels, analytics dashboards, and dev tools.

---

## Dashboard Shell

> Dashboard page frames with sidebar + main area compositions

**9 blocks** · `dashboard-shell-01` through `dashboard-shell-09`

```bash
npx shadcn@latest add @ss-blocks/dashboard-shell-01 -c packages/ui
```

---

## Dashboard Header

> Top navigation headers — standalone, branded, two-row, three-row, themed

**18 blocks** · `dashboard-header-01` through `dashboard-header-18`

```bash
npx shadcn@latest add @ss-blocks/dashboard-header-01 -c packages/ui
```

Variants include standard headers (01–06), branded/two-row (07–09), three-row/themed (10–12), vertical/gaming/automobile/eCommerce/job management (13–18).

---

## Dashboard Sidebar

> Sidebar navigation — includes 3 Pro-flagged blocks

**11 blocks** · `dashboard-sidebar-01` through `dashboard-sidebar-11`

```bash
npx shadcn@latest add @ss-blocks/dashboard-sidebar-01 -c packages/ui
```

| Slug | Notes |
|---|---|
| `dashboard-sidebar-01` | Standard |
| `dashboard-sidebar-02` | With user profile |
| `dashboard-sidebar-03` | Collapsible |
| `dashboard-sidebar-04` | Icon rail |
| `dashboard-sidebar-05` | With search |
| `dashboard-sidebar-06` | **[Pro]** |
| `dashboard-sidebar-07` | Themed |
| `dashboard-sidebar-08` | Dark variant |
| `dashboard-sidebar-09` | **[Pro]** |
| `dashboard-sidebar-10` | E-commerce |
| `dashboard-sidebar-11` | **[Pro]** |

---

## Dashboard Footer

> Footer bars with branding, social icons, navigation links, breadcrumbs

**10 blocks** · `dashboard-footer-01` through `dashboard-footer-10`

```bash
npx shadcn@latest add @ss-blocks/dashboard-footer-01 -c packages/ui
```

| Slug | Description |
|---|---|
| `dashboard-footer-01` | Copyright + social icons (FB, IG, LI, Twitter) |
| `dashboard-footer-02` | Collapsible sidebar + resource links |
| `dashboard-footer-03` | Language dropdown + controls |
| `dashboard-footer-04` | Nav links + language + social |
| `dashboard-footer-05` | Branded, colored background + logo |
| `dashboard-footer-06` | Full branded + primary color BG |
| `dashboard-footer-07` | Sticky bottom + social |
| `dashboard-footer-08` | Multi-section + export button |
| `dashboard-footer-09` | Breadcrumb integration |
| `dashboard-footer-10` | Centered logo layout |

---

## Dashboard Dialog

> Modal dialogs — payment, sharing, workspace, auth, HR, scheduling, search

**26 blocks** · `dashboard-dialog-01` through `dashboard-dialog-26`

```bash
npx shadcn@latest add @ss-blocks/dashboard-dialog-01 -c packages/ui
```

| Slug | Description | Notable Deps |
|---|---|---|
| `dashboard-dialog-01` | Subscription plan selection | radio-group |
| `dashboard-dialog-02` | Confirmation / warning | avatar |
| `dashboard-dialog-03` | Add payment method (card preview) | react-19-credit-card, react-payment-inputs |
| `dashboard-dialog-04` | Workspace creation | input |
| `dashboard-dialog-05` | Seat selection (slider, switch) | slider, switch |
| `dashboard-dialog-06` | Share access + role permissions | select, avatar |
| `dashboard-dialog-07` | Add card (payment inputs) | react-payment-inputs |
| `dashboard-dialog-08` | Authenticator / 2FA QR setup | — |
| `dashboard-dialog-09` | Verification (alert, radio, scroll-area) | alert, radio-group, scroll-area |
| `dashboard-dialog-10` | Payment method selection | radio-group, separator |
| `dashboard-dialog-11` | File upload drag-drop | scroll-area, use-file-upload hook |
| `dashboard-dialog-12` | Product update form | radio-group, select, textarea, scroll-area |
| `dashboard-dialog-13` | Project sharing | avatar, scroll-area |
| `dashboard-dialog-14` | Add address | radio-group, switch, select, scroll-area |
| `dashboard-dialog-15` | Refer & earn | avatar, scroll-area |
| `dashboard-dialog-16` | Create app (stepper, tech stack) | @stepperize/react, react-payment-inputs |
| `dashboard-dialog-17` | Employee details (HR + calendar) | calendar, popover, scroll-area |
| `dashboard-dialog-18` | Schedule meeting (calendar, toggle-group) | calendar, toggle-group, textarea |
| `dashboard-dialog-19` | Search (command palette) | command, avatar, badge |
| `dashboard-dialog-20` | Activity tracking | badge, sheet, input-group |
| `dashboard-dialog-21` | **[New]** Payment success modal | avatar |
| `dashboard-dialog-22` | **[New]** Delete confirmation + "don't ask again" checkbox | checkbox |
| `dashboard-dialog-23` | **[New]** 2FA deactivation (password verify) | input |
| `dashboard-dialog-24` | **[New]** Workspace creation + privacy switch | switch |
| `dashboard-dialog-25` | **[New]** CI/CD pipeline config (4-step wizard) | select, badge, scroll-area |
| `dashboard-dialog-26` | **[New]** Share + collaborate (copy link) | switch, input |

---

## Dashboard Dropdown

> Dropdown menus — profile, notifications, cart, language, workspace, assignments, drag-and-drop

**23 blocks** · `dashboard-dropdown-01` through `dashboard-dropdown-23`

```bash
npx shadcn@latest add @ss-blocks/dashboard-dropdown-01 -c packages/ui
```

| Slug | Description |
|---|---|
| `dashboard-dropdown-01` | Language selector (flag icons) |
| `dashboard-dropdown-02` | User profile (avatar + actions) |
| `dashboard-dropdown-03` | Balance / wallet |
| `dashboard-dropdown-04` | App launcher grid |
| `dashboard-dropdown-05` | More options |
| `dashboard-dropdown-06` | Comprehensive user dropdown |
| `dashboard-dropdown-07` | User stats + sparkline chart |
| `dashboard-dropdown-08` | Animated user dropdown (motion, toggle-group) |
| `dashboard-dropdown-09` | Theme selector (toggle-group) |
| `dashboard-dropdown-10` | Simple profile (motion) |
| `dashboard-dropdown-11` | Status selector (avatar + presence indicators) |
| `dashboard-dropdown-12` | Notifications (badge, tabs) |
| `dashboard-dropdown-13` | Workspace switcher |
| `dashboard-dropdown-14` | Search + checkboxes |
| `dashboard-dropdown-15` | More options (extended) |
| `dashboard-dropdown-16` | Favorites / bookmarks |
| `dashboard-dropdown-17` | Shopping cart (badge, select, separator) |
| `dashboard-dropdown-18` | Invite members (input, select) |
| `dashboard-dropdown-19` | Share content |
| `dashboard-dropdown-20` | Tag management (command, popover) |
| `dashboard-dropdown-21` | Task assignment (command, avatar, popover) |
| `dashboard-dropdown-22` | Drag-and-drop sortable list (@dnd-kit) |
| `dashboard-dropdown-23` | Drag-and-drop app launcher (@dnd-kit) |

---

## Statistics Component

> KPI metric cards — 3 Pro blocks; blocks 11–22 are New (2026-03-13)

**22 blocks** · `statistics-component-01` through `statistics-component-22`

```bash
npx shadcn@latest add @ss-blocks/statistics-component-01 -c packages/ui
```

| Slug | Focus | Flag |
|---|---|---|
| `statistics-component-01` | Revenue / earnings | — |
| `statistics-component-02` | User growth | — |
| `statistics-component-03` | Orders / sales | — |
| `statistics-component-04` | Conversion rate | — |
| `statistics-component-05` | Profit margin | — |
| `statistics-component-06` | Customer satisfaction | — |
| `statistics-component-07` | Monthly recurring revenue | — |
| `statistics-component-08` | Active users | — |
| `statistics-component-09` | Inventory / stock | — |
| `statistics-component-10` | Support tickets | — |
| `statistics-component-11` | Advanced metric card | **[Pro][New]** |
| `statistics-component-12` | Financial KPI | **[New]** |
| `statistics-component-13` | DevOps metric | **[New]** |
| `statistics-component-14` | HR analytics | **[New]** |
| `statistics-component-15` | Energy tracking | **[New]** |
| `statistics-component-16` | Healthcare metric | **[Pro][New]** |
| `statistics-component-17` | IoT sensor stat | **[New]** |
| `statistics-component-18` | Crypto portfolio | **[New]** |
| `statistics-component-19` | ETF / investment | **[New]** |
| `statistics-component-20` | Uptime monitoring | **[New]** |
| `statistics-component-21` | Pipeline status tracker | **[Pro][New]** |
| `statistics-component-22` | General advanced stat | **[New]** |

---

## Charts Component

> Recharts-based chart visualizations — largest category

**56 blocks** · `chart-component-01` through `chart-component-56`

```bash
npx shadcn@latest add @ss-blocks/chart-component-01 -c packages/ui
```

Coverage spans:
- **01–10**: Sales metrics, revenue, growth, conversion, funnel
- **11–20**: DevOps (CI/CD, deployment frequency, incident response, SLA uptime)
- **21–30**: HR analytics (headcount, attrition, performance, hiring pipeline)
- **31–40**: Energy / IoT (consumption, sensor data, facility monitoring)
- **41–48**: Healthcare (patient flow, bed occupancy, lab turnaround)
- **49–52**: Crypto / fintech (portfolio, price action, volume)
- **53–56**: ETF tracking, uptime monitoring, pipeline trackers

---

## Widgets Component

> Standalone dashboard widget cards — financials, products, social, maps, campaigns

**20 blocks** · `widget-component-01` through `widget-component-20`

```bash
npx shadcn@latest add @ss-blocks/widget-component-01 -c packages/ui
```

| Slug | Description | Flag |
|---|---|---|
| `widget-component-01` | Total earnings + progress bar | — |
| `widget-component-02` | Product insights (recharts) | — |
| `widget-component-03` | Transactions list (avatar) | — |
| `widget-component-04` | Social network visits (badge) | — |
| `widget-component-05` | Popular products | — |
| `widget-component-06` | Sales by countries | — |
| `widget-component-07` | Finance reviews (progress, avatar) | — |
| `widget-component-08` | Your accounts (avatar, separator) | — |
| `widget-component-09` | Monthly campaign | — |
| `widget-component-10` | Business promo (badge, checkbox) | — |
| `widget-component-11` | Upgrade plan (react-payment-inputs) | — |
| `widget-component-12` | Vehicle condition (circular-progress) | — |
| `widget-component-13` | Browser analytics (circular-progress) | — |
| `widget-component-14` | Payment history (table) | — |
| `widget-component-15` | User order (tabs, progress) | — |
| `widget-component-16` | Advertisement (badge, tooltip) | — |
| `widget-component-17` | Orders timeline (timeline UI component) | — |
| `widget-component-18` | Top products (avatar, badge) | — |
| `widget-component-19` | Audience map (@vis.gl/react-google-maps) | — |
| `widget-component-20` | Customer activity tracking (table, dialog) | **[Pro][New]** |

---

## DataTable Component

> @tanstack/react-table powered data grids

**7 blocks** · `datatable-component-01` through `datatable-component-07`

```bash
npx shadcn@latest add @ss-blocks/datatable-component-01 -c packages/ui
```

**Required dep:** `@tanstack/react-table`

| Slug | Best fit |
|---|---|
| `datatable-component-01` | Basic sortable table |
| `datatable-component-02` | With filters |
| `datatable-component-03` | With pagination |
| `datatable-component-04` | Staff / employee table |
| `datatable-component-05` | Invoices / financial records |
| `datatable-component-06` | With row selection |
| `datatable-component-07` | Full-featured (sort + filter + select + paginate) |

---

## Multi-Step Form

> @stepperize/react powered multi-step form wizards

**3 blocks** · `multi-step-form-01` through `multi-step-form-03`

```bash
npx shadcn@latest add @ss-blocks/multi-step-form-01 -c packages/ui
```

**Required dep:** `@stepperize/react`

---

## Account Settings

> Full account and workspace settings page sections — all added 2026-02-27

**7 blocks** · `account-settings-01` through `account-settings-07`

```bash
npx shadcn@latest add @ss-blocks/account-settings-01 -c packages/ui
```

| Slug | Description | Key Sections |
|---|---|---|
| `account-settings-01` | Personal info + account | PersonalInfo (image upload, country), EmailPass, ConnectAccount, SocialUrl, DangerZone |
| `account-settings-02` | Notification preferences | Multi-channel toggles (email/desktop/app), InboxPreference, BrowserNotification, DoNotDisturb |
| `account-settings-03` | Workspace config | Name, timezone/branding, Organization linking, DataExport, DangerZone |
| `account-settings-04` | Integrations | Communication, Planning, Developer tools (connect/disconnect cards) |
| `account-settings-05` | Team members | Member list, RBAC (admin/viewer/contributor), invite dialog, pending invitations |
| `account-settings-06` | Security | 2FA setup, API key management, sessions table (device/IP/logout) |
| `account-settings-07` | Billing | Plan details, spend management, credit card display (react-19-credit-card), AI credits, add-ons |

---

## Form Layout

> Form patterns from simple single-section to full multi-step wizards — all added 2026-02-27

**9 blocks** · `form-layout-01` through `form-layout-09`

```bash
npx shadcn@latest add @ss-blocks/form-layout-01 -c packages/ui
```

| Slug | Description | Key Deps |
|---|---|---|
| `form-layout-01` | Personal info (2-col responsive grid) | button, input, field |
| `form-layout-02` | 3-section (personal + workspace + notifications) | checkbox, radio-group, select |
| `form-layout-03` | RHF onboarding (radio pricing cards + combobox) | react-hook-form, zod, @hookform/resolvers |
| `form-layout-04` | 2-col (large radio pricing cards + helper sidebar) | badge, radio-group, card |
| `form-layout-05` | Tabbed (personal + account + social; password strength meter) | tabs, calendar, popover |
| `form-layout-06` | Checkout accordion (address + delivery + payment) | accordion, radio-group |
| `form-layout-07` | Sticky header checkout (numbered sections + promo codes) | checkbox, radio-group, separator |
| `form-layout-08` | Product creation wizard (5-step, sidebar nav) | @stepperize/react, calendar, react-aria-components |
| `form-layout-09` | RHF 4-step onboarding (account + company + subscription + success) | react-hook-form, @stepperize/react, react-payment-inputs |

---

## Card Nav

> Navigable cards with tabs, carousels, analytics, and payment flows — all New (2026-02-13)

**6 blocks** · `card-nav-01` through `card-nav-06`

```bash
npx shadcn@latest add @ss-blocks/card-nav-01 -c packages/ui
```

| Slug | Description | Key Deps |
|---|---|---|
| `card-nav-01` | Sales analytics (multi-tab, area + bar charts) | chart, tabs, avatar, tooltip |
| `card-nav-02` | 3-step registration (credit card preview, 3D tilt) | react-19-credit-card, react-payment-inputs, motion |
| `card-nav-03` | Credit card manager (horizontal tabs, dark mode images) | card, tabs |
| `card-nav-04` | Schedule manager (dual carousel, accordion events, platform badges) | accordion, carousel, avatar |
| `card-nav-05` | Multi-step wizard (stepperize, sidebar nav, credit card) | @stepperize/react, react-payment-inputs |
| `card-nav-06` | Analytics tabs (area charts per metric, trend avatars, scroll) | chart, scroll-area, tabs |

---

## Empty State

> Zero-data placeholder components — all New (2026-03-13)

**8 blocks** · `empty-state-01` through `empty-state-08`

```bash
npx shadcn@latest add @ss-blocks/empty-state-01 -c packages/ui
```

| Slug | Description | Flag |
|---|---|---|
| `empty-state-01` | API requests metric (dashed card) | — |
| `empty-state-02` | CI/CD automation CTA (inline dialog trigger) | — |
| `empty-state-03` | Capacity usage (circular-progress × 3) | — |
| `empty-state-04` | Metric card + circular progress + CTA link | — |
| `empty-state-05` | Chart placeholder (tabbed, bar chart stubs, dropdown) | **[Pro]** |
| `empty-state-06` | Sales leads (area chart stub, summary stats) | — |
| `empty-state-07` | Dashboard placeholder (tabs, grid, motion-tabs) | — |
| `empty-state-08` | Finance report (bar chart stub, tiles, avatar) | — |

---

## Onboarding Feed

> Onboarding checklist and wizard flows — all New (2026-03-13)

**5 blocks** · `onboarding-feed-01` through `onboarding-feed-05`

```bash
npx shadcn@latest add @ss-blocks/onboarding-feed-01 -c packages/ui
```

| Slug | Description | Key Deps |
|---|---|---|
| `onboarding-feed-01` | Accordion checklist (per-step CTAs, completion state) | accordion, button |
| `onboarding-feed-02` | Multi-step form (5 steps: personal info, goals, workspace, notifications, complete) | @stepperize/react, calendar |
| `onboarding-feed-03` | Accordion + progress bar + dialog CTAs (signup/subscribe/referral) | accordion, progress, dialog |
| `onboarding-feed-04` | Timeline-style activity feed (workspace events) | timeline (custom UI) |
| `onboarding-feed-05` | Tabbed (updates timeline + workspace details, motion-tabs) | motion, timeline |

---

## File Upload

> Upload forms and managers — all New (2026-03-13); all use `use-file-upload` hook (except 01, 04)

**7 blocks** · `file-upload-01` through `file-upload-07`

```bash
npx shadcn@latest add @ss-blocks/file-upload-01 -c packages/ui
```

| Slug | Description |
|---|---|
| `file-upload-01` | Simple single-file form (studio name input) |
| `file-upload-02` | Multi-file drag-drop + lead selector (avatar) + upload sources |
| `file-upload-03` | Scrollable multi-file + source options (device/link/camera) |
| `file-upload-04` | Profile form + avatar image picker + preview |
| `file-upload-05` | Workspace creation form + multi-file drag-drop |
| `file-upload-06` | Upload manager (active + failed sections + progress bars) |
| `file-upload-07` | Review submission form + image gallery uploader (thumbnails) |

---

## Bento Grid

> Animated feature grids for marketing and landing pages — all use `motion` library

**24 blocks** · `bento-grid-01` through `bento-grid-24`

```bash
npx shadcn@latest add @ss-blocks/bento-grid-01 -c packages/ui
```

| Slug | Theme / Focus |
|---|---|
| `bento-grid-01` | Feature showcase (animated beams, motion effects) |
| `bento-grid-02` | Notification stack (global tooltips, motion, avatars) |
| `bento-grid-03` | Charts analytics (Recharts, number tickers) |
| `bento-grid-04` | Animated interactive (beams, number tickers) |
| `bento-grid-05` | Ripple background (circular SVG, logo vectors) |
| `bento-grid-06` | Revenue dashboard (Recharts, progress tracking) |
| `bento-grid-07` | Animated interactive variant |
| `bento-grid-08` | Component showcase (card stack, color palette marquee with pause) |
| `bento-grid-09` | E-commerce (tabbed filters, discount banner, carousel favorites) |
| `bento-grid-10` | Developer tools (orbiting framework logos, tool cards with icons) |
| `bento-grid-11` | Finance app (gradient hero card, role assignment, pending alerts) |
| `bento-grid-12` | Developer platform (hover glow effects, animated code blocks) |
| `bento-grid-13` | Analytics dashboard (visitor stats, device breakdown, magnetic) |
| `bento-grid-14` | AI productivity (typewriter prompts, orbiting icons, card stacks) |
| `bento-grid-15` | Finance dashboard (transaction carousels, currency exchange) |
| `bento-grid-16` | AI tools showcase (secure shields, process flows, voice assistant) |
| `bento-grid-17` | Task management (team grids, animated checklists, 3D globe) |
| `bento-grid-18` | Analytics showcase (orbiting avatars on hover, falling badge physics) |
| `bento-grid-19` | E-commerce analytics (order status tracking, product metrics charts) |
| `bento-grid-20` | Theme customization (real-time preview carousels, color mastery) |
| `bento-grid-21` | Theme generator (AI chat animations, color contrast checkers) |
| `bento-grid-22` | Component library (CLI install cards, orbiting framework logos) |
| `bento-grid-23` | Developer tools (MCP server integration, Figma-to-code conversion) |
| `bento-grid-24` | Component showcase (animated beams, pre-built theme carousels) |

---

## Key External Dependencies

These npm packages appear across multiple blocks — install when needed:

| Package | Used by |
|---|---|
| `motion` | bento-grid, dashboard-dropdown-08/10, onboarding-feed-05, card-nav-02 |
| `react-payment-inputs` | dialog-03/07/16, card-nav-02/05, form-layout-09, widget-11 |
| `react-19-credit-card` | dialog-03, account-settings-07, card-nav-02 |
| `@stepperize/react` | dialog-16, multi-step-form, form-layout-08/09, card-nav-05, onboarding-feed-02 |
| `@dnd-kit/core` + sortable | dashboard-dropdown-22/23 |
| `@vis.gl/react-google-maps` | widget-component-19 |
| `@tanstack/react-table` | all datatable-component blocks |
| `react-hook-form` + `zod` | form-layout-03/09 |
| `@hookform/resolvers` | form-layout-03/09 |
| `sonner` | account-settings-03, form-layout-03 |
| `react-aria-components` | form-layout-08 |

---

## Categories Not Yet Enumerated

The following categories exist in the registry but have not been confirmed in this document. Use `get-block-meta-content` with the paths below to expand this inventory:

```
/marketing-ui/hero/registry
/marketing-ui/features/registry
/marketing-ui/pricing/registry
/marketing-ui/cta/registry
/marketing-ui/testimonials/registry
/marketing-ui/faq/registry
/marketing-ui/navbar/registry
/marketing-ui/footer/registry
/e-commerce/product-listing/registry
/e-commerce/product-detail/registry
/e-commerce/cart/registry
/e-commerce/checkout/registry
```

> Note: These endpoint paths are inferred from MCP path conventions — verify with `get-blocks-metadata` before calling.

---

## RetailOS Usage Guide

### POS / Operations UI

| Need | Recommended blocks |
|---|---|
| Checkout / payment flow | `dashboard-dialog-03`, `dashboard-dialog-07`, `dashboard-dialog-10`, `form-layout-06/07` |
| Product form | `dashboard-dialog-12`, `form-layout-08` |
| Sales metrics | `statistics-component-01–10`, `charts-component-01–10` |
| Transaction widget | `widget-component-03`, `widget-component-14` |
| Order widget | `widget-component-15`, `widget-component-17` |
| Top products | `widget-component-05`, `widget-component-18` |
| DataTable (inventory) | `datatable-component-05`, `datatable-component-07` |
| App shell | `application-shell-01–06` |
| Empty states | `empty-state-01`, `empty-state-05` |
| Notifications dropdown | `dashboard-dropdown-12` |
| Cart dropdown | `dashboard-dropdown-17` |

### Onboarding / Auth

| Need | Recommended blocks |
|---|---|
| Multi-step signup | `card-nav-02`, `card-nav-05`, `form-layout-09` |
| Onboarding checklist | `onboarding-feed-01`, `onboarding-feed-03` |
| Upload profile photo | `file-upload-04` |
| Plan selection | `dashboard-dialog-01`, `dashboard-dialog-05` |

### Settings Pages

| Need | Recommended blocks |
|---|---|
| Full account settings | `account-settings-01` |
| Notifications | `account-settings-02` |
| Security / 2FA | `account-settings-06` |
| Billing | `account-settings-07` |
| Team members | `account-settings-05` |
| Integrations | `account-settings-04` |
| Workspace config | `account-settings-03` |

### Marketing / Landing

| Need | Recommended blocks |
|---|---|
| Feature bento | `bento-grid-01`, `bento-grid-08`, `bento-grid-10` |
| E-commerce bento | `bento-grid-09`, `bento-grid-19` |
| Finance/SaaS bento | `bento-grid-06`, `bento-grid-11`, `bento-grid-15` |
