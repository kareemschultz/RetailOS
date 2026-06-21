# shadcn/studio Pro — Complete Block Inventory

> **Style:** `base-lyra` (RetailOS)  
> **Enumeration method:** `get-block-meta-content` per category via MCP — live registry data, not guessed names  
> **Last enumerated:** 2026-06-21  
> **Total confirmed blocks:** 735 across 61 categories (3 top-level sections)  
> **Registry claim:** 750+ Pro & Free Awesome Shadcn UI Blocks (delta ~15 = free blocks outside enumerated categories or recently added wave)

---

## How to Install

```bash
# Via shadcn CLI (credentials in .env)
npx shadcn@latest add @ss-blocks/<slug> -c packages/ui

# Via MCP (preferred for discovery)
# /cui "describe what you need" — install via MCP commands
```

Slugs are kebab-case with zero-padded two-digit numbers (e.g. `hero-section-01`). The MCP is the authoritative source — use `get-block-meta-content` per category, not padded guesses.

---

## Flags

| Flag | Meaning |
|---|---|
| `[Pro]` | `isPro: true` in registry metadata — highest-tier blocks |
| `[New]` | `isNew: true` — added 2025-12-29 to 2026-03-13 wave |

---

## Section Index

| Section | Categories | Blocks |
|---|---|---|
| [Dashboard & Application](#dashboard--application) | 19 | 289 |
| [Marketing UI](#marketing-ui) | 29 | 362 |
| [eCommerce](#ecommerce) | 13 | 84 |
| **Total** | **61** | **735** |

---

# Dashboard & Application

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

# Marketing UI

> 29 sub-categories · 362 blocks · Endpoint prefix: `/marketing-ui/<category>/registry`

## Marketing UI Category Index

| Category | Slug | Count | Notes |
|---|---|---|---|
| [Hero Section](#hero-section) | `hero-section` | 41 | Largest marketing category |
| [Features Section](#features-section) | `features-section` | 29 | |
| [Testimonials](#testimonials) | `testimonials-component` | 24 | |
| [About Us Page](#about-us-page) | `about-us-page` | 24 | |
| [Pricing Component](#pricing-component) | `pricing-component` | 20 | |
| [Team Section](#team-section) | `team-section` | 20 | |
| [FAQ Component](#faq-component) | `faq-component` | 19 | 2 Pro |
| [Portfolio](#portfolio) | `portfolio` | 18 | 2 Pro+New |
| [Blog Component](#blog-component) | `blog-component` | 17 | 1 Pro+New |
| [Contact Us Page](#contact-us-page) | `contact-us-page` | 16 | 1 Pro+New |
| [CTA Section](#cta-section) | `cta-section` | 14 | 3 Pro+New |
| [Navbar Component](#navbar-component) | `navbar-component` | 14 | |
| [App Integration](#app-integration) | `app-integration` | 10 | 1 Pro+New |
| [Gallery Component](#gallery-component) | `gallery-component` | 10 | |
| [Footer Component](#footer-component) | `footer-component` | 9 | 4 Pro |
| [Logo Cloud](#logo-cloud) | `logo-cloud` | 9 | |
| [Social Proof](#social-proof) | `social-proof` | 11 | 2 Pro+New |
| [Compare](#compare) | `compare` | 7 | 3 Pro+New, 4 New |
| [Download](#download) | `download` | 6 | 1 Pro+New |
| [Timeline Component](#timeline-component) | `timeline-component` | 5 | All New |
| [Login Page](#login-page) | `login-page` | 5 | |
| [Register](#register) | `register` | 5 | |
| [Forgot Password](#forgot-password) | `forgot-password` | 5 | |
| [Reset Password](#reset-password) | `reset-password` | 5 | |
| [Two-Factor Auth](#two-factor-authentication) | `two-factor-authentication` | 5 | |
| [Verify Email](#verify-email) | `verify-email` | 5 | |
| [Error Page](#error-page) | `error-page` | 4 | |
| [Cookies Consent](#cookies-consent) | `cookies-consent` | 3 | |
| [User Schedule](#user-schedule) | `user-schedule` | 2 | All New |

---

## Hero Section

> Full landing page hero blocks — centered, split-screen, animated, product showcases

**41 blocks** · `hero-section-01` through `hero-section-41`

```bash
npx shadcn@latest add @ss-blocks/hero-section-01 -c packages/ui
```

| Blocks | Theme |
|---|---|
| 01–06 | Centered layouts (AI badge, motion tabs, avatar testimonials, split-screen, app store CTAs) |
| 07–10 | Two-column with avatar testimonials, dark themes, CLI copy, dashboard previews |
| 11–15 | Interactive effects (3D perspective tilt, text flip, e-learning stats, AI prompt input, food menu) |
| 16–20 | SaaS/product (survey badge, email capture, bold product image, dark gradient, e-commerce checkout) |
| 21–25 | Healthcare, digital marketing, UI kit showcase, freelancer platforms |
| 26–30 | SaaS dual-CTA, UI kit magnetic avatars, freelancer marketplace, mobile app |
| 31–35 | Product analytics, event booking, Figma-to-code, AI chat, blog subscription |
| 36–41 | Portfolio/creative, marketing analytics, smart home/robotics, analytics dashboard, tabbed AI workflows |

---

## Features Section

> Feature showcase sections — grids, accordions, tabs, icon lists, interactive demos

**29 blocks** · `features-section-01` through `features-section-29`

```bash
npx shadcn@latest add @ss-blocks/features-section-01 -c packages/ui
```

| Blocks | Theme |
|---|---|
| 01–06 | 3-col grids, accordion with image, rocket icon + dashboard preview |
| 07–12 | Icon grid cards, two-col with media, dark themed feature lists |
| 13–18 | Tab-switched feature demos, animated icon cards, video placeholders |
| 19–24 | Bento-style feature layouts, comparison feature lists, scrollable marquees |
| 25–29 | Interactive hover demos, step-based flows, animated code block showcases |

---

## Testimonials

> Customer testimonials — carousels, masonry walls, marquees, star ratings

**24 blocks** · `testimonials-component-01` through `testimonials-component-24`

```bash
npx shadcn@latest add @ss-blocks/testimonials-component-01 -c packages/ui
```

| Blocks | Theme |
|---|---|
| 01–06 | Side carousel, masonry/wall of love, animated marquee, hero with logos |
| 07–12 | Avatar grid, video testimonials, dark themed, tabs by category |
| 13–18 | Rating breakdowns, star + platform integration (G2/Capterra), quote callouts |
| 19–24 | Scroll-triggered, horizontal carousel, metric + testimonial combos |

---

## About Us Page

> About us page sections — stats, mission/vision/values, team, timelines

**24 blocks** · `about-us-page-01` through `about-us-page-24`

```bash
npx shadcn@latest add @ss-blocks/about-us-page-01 -c packages/ui
```

| Blocks | Theme |
|---|---|
| 01–06 | Stats + image overlays, two-col image/stats grids, tabbed mission/vision/values |
| 07–12 | Company history timelines, leadership bios, full-page about compositions |
| 13–18 | Investor + partner logos, office/culture photos, team org charts |
| 19–24 | Awards + recognition, press mentions, diversity & inclusion sections |

---

## Pricing Component

> Pricing tables — monthly/annual toggles, feature comparison, usage-based

**20 blocks** · `pricing-component-01` through `pricing-component-20`

```bash
npx shadcn@latest add @ss-blocks/pricing-component-01 -c packages/ui
```

Includes: toggle-group monthly/annual switches, popular badge, feature comparison tables, usage-based tiers, freemium to enterprise ladder, FAQ-linked pricing sections.

---

## Team Section

> Team member grids and cards — photos, roles, social links, org structures

**20 blocks** · `team-section-01` through `team-section-20`

```bash
npx shadcn@latest add @ss-blocks/team-section-01 -c packages/ui
```

Includes: 3-col/4-col photo grids, horizontal member cards with social icons, leadership highlights, department groupings, LinkedIn/Twitter/GitHub icon links.

---

## FAQ Component

> FAQ sections — accordions, tab-grouped, search-enabled; 2 Pro blocks

**19 blocks** · `faq-component-01` through `faq-component-19`

```bash
npx shadcn@latest add @ss-blocks/faq-component-01 -c packages/ui
```

| Slug | Notes |
|---|---|
| `faq-component-01` through `faq-component-17` | Standard accordion/tab FAQ layouts |
| `faq-component-18` | **[Pro]** Advanced searchable FAQ |
| `faq-component-19` | **[Pro]** Chat-style interactive FAQ |

---

## Portfolio

> Portfolio showcase pages — project grids, case studies, filterable galleries; 2 Pro+New blocks

**18 blocks** · `portfolio-01` through `portfolio-18`

```bash
npx shadcn@latest add @ss-blocks/portfolio-01 -c packages/ui
```

| Slug | Notes |
|---|---|
| `portfolio-01` through `portfolio-16` | Standard portfolio layouts |
| `portfolio-17` | **[Pro][New]** Advanced case study layout (date: 2025-12-29) |
| `portfolio-18` | **[Pro][New]** Interactive project showcase (date: 2025-12-29) |

---

## Blog Component

> Blog listing, article cards, categories; 1 Pro+New block

**17 blocks** · `blog-component-01` through `blog-component-17`

```bash
npx shadcn@latest add @ss-blocks/blog-component-01 -c packages/ui
```

| Slug | Notes |
|---|---|
| `blog-component-01` through `blog-component-15` | Standard blog layouts (grid, list, featured, category tabs) |
| `blog-component-16` | **[Pro][New]** Magazine-style editorial layout |
| `blog-component-17` | Newsletter subscription + recent posts |

---

## Contact Us Page

> Contact forms, location maps, support hours; 1 Pro+New block

**16 blocks** · `contact-us-page-01` through `contact-us-page-16`

```bash
npx shadcn@latest add @ss-blocks/contact-us-page-01 -c packages/ui
```

| Slug | Notes |
|---|---|
| `contact-us-page-01` through `contact-us-page-15` | Standard contact layouts (form + map, split, minimal, support chat) |
| `contact-us-page-16` | **[Pro][New]** Full-page contact hub with live chat integration |

---

## CTA Section

> Call-to-action sections — email capture, download, upgrade prompts; 3 Pro+New blocks

**14 blocks** · `cta-section-01` through `cta-section-14`

```bash
npx shadcn@latest add @ss-blocks/cta-section-01 -c packages/ui
```

| Slug | Notes |
|---|---|
| `cta-section-01` through `cta-section-10` | Standard CTA layouts (centered, split, banner, inline, dark) |
| `cta-section-11` | **[Pro][New]** Animated gradient CTA with countdown |
| `cta-section-12` | Email capture with social proof metrics |
| `cta-section-13` | **[Pro][New]** Video background CTA |
| `cta-section-14` | **[Pro][New]** Interactive product demo CTA |

---

## Navbar Component

> Site navigation headers — static, sticky, mega menu, mobile drawer

**14 blocks** · `navbar-component-01` through `navbar-component-14`

```bash
npx shadcn@latest add @ss-blocks/navbar-component-01 -c packages/ui
```

Includes: simple logo + links, sticky scroll-aware nav, mega menu with image columns, mobile hamburger + sheet drawer, dark/transparent variants, with CTA button.

---

## App Integration

> Integration showcase sections — partner logos, API connect cards; 1 Pro+New block

**10 blocks** · `app-integration-01` through `app-integration-10`

```bash
npx shadcn@latest add @ss-blocks/app-integration-01 -c packages/ui
```

| Slug | Notes |
|---|---|
| `app-integration-01` through `app-integration-09` | Logo grids, connection flow diagrams, category-grouped partner cards |
| `app-integration-10` | **[Pro][New]** Animated connection hub with live status (date: 2025-12-29) |

---

## Gallery Component

> Media galleries — masonry, lightbox, grid, carousel

**10 blocks** · `gallery-component-01` through `gallery-component-10`

```bash
npx shadcn@latest add @ss-blocks/gallery-component-01 -c packages/ui
```

Includes: 3-col/4-col image grids, masonry layout, lightbox modal on click, category filter tabs, before/after slider.

---

## Footer Component

> Marketing site footers — full, minimal, multi-column; 4 Pro blocks

**9 blocks** · `footer-component-01` through `footer-component-09`

```bash
npx shadcn@latest add @ss-blocks/footer-component-01 -c packages/ui
```

| Slug | Notes |
|---|---|
| `footer-component-01` | Simple copyright + social icons |
| `footer-component-02` | 4-column links + newsletter |
| `footer-component-03` | Dark branded full footer |
| `footer-component-04` | Minimal centered |
| `footer-component-05` | Multi-col with logo block |
| `footer-component-06` | **[Pro]** Animated footer with parallax |
| `footer-component-07` | **[Pro]** Footer with live status widget |
| `footer-component-08` | **[Pro]** Footer with product showcase cards |
| `footer-component-09` | **[Pro]** Mega-footer with app download + social |

---

## Logo Cloud

> Partner / client logo showcases — static grids, animated marquees

**9 blocks** · `logo-cloud-01` through `logo-cloud-09`

```bash
npx shadcn@latest add @ss-blocks/logo-cloud-01 -c packages/ui
```

Includes: simple 6-col grid, animated horizontal marquee, dark themed marquee, paired with "trusted by" headline, with category tabs.

---

## Social Proof

> Social proof sections with metrics, badges, platform reviews; 2 Pro+New blocks

**11 blocks** · `social-proof-01` through `social-proof-11`

```bash
npx shadcn@latest add @ss-blocks/social-proof-01 -c packages/ui
```

| Slug | Notes |
|---|---|
| `social-proof-01` through `social-proof-09` | Stars + review counts, metric counters, G2/Capterra badges, video proof |
| `social-proof-10` | **[Pro][New]** 3D globe with customer markers (`three`, `three-globe`, `@react-three/drei`, `@react-three/fiber`) |
| `social-proof-11` | **[Pro][New]** Animated customer world map with live stats |

**Note:** Blocks 10–11 require Three.js deps: `three`, `three-globe`, `@react-three/drei`, `@react-three/fiber`

---

## Compare

> Feature comparison tables and sliders; 3 Pro+New, 4 New; deps: `react-use`, `motion`

**7 blocks** · `compare-01` through `compare-07`

```bash
npx shadcn@latest add @ss-blocks/compare-01 -c packages/ui
```

| Slug | Notes |
|---|---|
| `compare-01` | **[Pro][New]** Advanced comparison table |
| `compare-02` | **[Pro][New]** Side-by-side product comparison |
| `compare-03` | **[New]** Before/after image slider (`react-use`) |
| `compare-04` | **[New]** Feature matrix table |
| `compare-05` | **[Pro][New]** Animated plan comparison (`motion`) |
| `compare-06` | **[New]** Pricing tier comparison |
| `compare-07` | **[New]** Competitor feature comparison |

---

## Download

> App download sections — app store links, QR codes; 1 Pro+New block

**6 blocks** · `download-01` through `download-06`

```bash
npx shadcn@latest add @ss-blocks/download-01 -c packages/ui
```

| Slug | Notes |
|---|---|
| `download-01` | **[Pro][New]** Animated download hub with device previews (date: 2026-03-13) |
| `download-02` through `download-06` | Standard app store badge sections, QR code + link combos |

---

## Timeline Component

> Timeline sections — changelog, order tracking, horizontal; all New (2026-02-13)

**5 blocks** · `timeline-component-01` through `timeline-component-05`

```bash
npx shadcn@latest add @ss-blocks/timeline-component-01 -c packages/ui
```

| Slug | Description | Flag |
|---|---|---|
| `timeline-component-01` | Vertical changelog timeline | **[New]** |
| `timeline-component-02` | Order tracking progress | **[New]** |
| `timeline-component-03` | Horizontal auto-play timeline | **[New]** |
| `timeline-component-04` | Project milestone tracker | **[New]** |
| `timeline-component-05` | History/about us timeline | **[New]** |

---

## Login Page

> Full-page login layouts — split-screen, centered, branded

**5 blocks** · `login-page-01` through `login-page-05`

```bash
npx shadcn@latest add @ss-blocks/login-page-01 -c packages/ui
```

Includes: centered card, split-screen with brand image, OTP-based, social OAuth buttons (Google/GitHub), with "remember me" + forgot password.

---

## Register

> Full-page registration / signup layouts

**5 blocks** · `register-01` through `register-05`

```bash
npx shadcn@latest add @ss-blocks/register-01 -c packages/ui
```

---

## Forgot Password

> Forgot password email entry screens

**5 blocks** · `forgot-password-01` through `forgot-password-05`

```bash
npx shadcn@latest add @ss-blocks/forgot-password-01 -c packages/ui
```

---

## Reset Password

> Password reset forms with confirmation field

**5 blocks** · `reset-password-01` through `reset-password-05`

```bash
npx shadcn@latest add @ss-blocks/reset-password-01 -c packages/ui
```

---

## Two-Factor Authentication

> 2FA setup and verification screens

**5 blocks** · `two-factor-authentication-01` through `two-factor-authentication-05`

```bash
npx shadcn@latest add @ss-blocks/two-factor-authentication-01 -c packages/ui
```

---

## Verify Email

> Email verification screens with OTP or link

**5 blocks** · `verify-email-01` through `verify-email-05`

```bash
npx shadcn@latest add @ss-blocks/verify-email-01 -c packages/ui
```

---

## Error Page

> HTTP error pages — 404, 500, maintenance

**4 blocks** · `error-page-01` through `error-page-04`

```bash
npx shadcn@latest add @ss-blocks/error-page-01 -c packages/ui
```

---

## Cookies Consent

> Cookie consent banners — minimal, detailed, bottom bar

**3 blocks** · `cookies-consent-01` through `cookies-consent-03`

```bash
npx shadcn@latest add @ss-blocks/cookies-consent-01 -c packages/ui
```

---

## User Schedule

> Event discovery and meeting scheduler; all New (2026-02-27)

**2 blocks** · `user-schedule-01` through `user-schedule-02`

```bash
npx shadcn@latest add @ss-blocks/user-schedule-01 -c packages/ui
```

| Slug | Description | Flag |
|---|---|---|
| `user-schedule-01` | Event discovery calendar | **[New]** |
| `user-schedule-02` | Meeting scheduler (Calendly-style) | **[New]** |

---

# eCommerce

> 13 sub-categories · 84 blocks · Endpoint prefix: `/ecommerce/<category>/registry`

## eCommerce Category Index

| Category | Slug | Count | Notes |
|---|---|---|---|
| [Announcement Banner](#announcement-banner) | `announcement-banner` | 12 | All New (2026-02-27) |
| [Product Category](#product-category) | `product-category` | 12 | |
| [Product List](#product-list) | `product-list` | 9 | |
| [Product Overview](#product-overview) | `product-overview` | 9 | |
| [Category Filter](#category-filter) | `category-filter` | 6 | |
| [Mega Footer](#mega-footer) | `mega-footer` | 5 | |
| [Offer Modal](#offer-modal) | `offer-modal` | 5 | |
| [Order Summary](#order-summary) | `order-summary` | 5 | |
| [Product Quick View](#product-quick-view) | `product-quick-view` | 5 | |
| [Product Reviews](#product-reviews) | `product-reviews` | 5 | |
| [Checkout Page](#checkout-page) | `checkout-page` | 4 | |
| [Shopping Cart](#shopping-cart) | `shopping-cart` | 4 | |
| [Gift Card](#gift-card) | `gift-card` | 3 | All New |

---

## Announcement Banner

> Site-wide promotional banners — countdown timers, promo codes, free shipping; all New (2026-02-27)

**12 blocks** · `announcement-banner-01` through `announcement-banner-12`

```bash
npx shadcn@latest add @ss-blocks/announcement-banner-01 -c packages/ui
```

All 12 blocks are `[New]`. Variants include: dismissible top bar, countdown sale banner, rotating multi-message marquee, free shipping threshold progress, promo code display, dark/colored themes.

---

## Product Category

> Category browsing pages — grid layouts, filter sidebars, hero banners

**12 blocks** · `product-category-01` through `product-category-12`

```bash
npx shadcn@latest add @ss-blocks/product-category-01 -c packages/ui
```

Includes: category card grids (2-col/3-col/4-col), hero banner + subcategory grid, vertical filter sidebar + product grid, horizontal filter tabs.

---

## Product List

> Product listing/search results pages — grid and list views

**9 blocks** · `product-list-01` through `product-list-09`

```bash
npx shadcn@latest add @ss-blocks/product-list-01 -c packages/ui
```

Includes: 3-col/4-col product card grids, list view with product image + details, infinite scroll vs pagination, sort dropdown, wishlist toggle.

---

## Product Overview

> Individual product detail pages — images, specs, add to cart

**9 blocks** · `product-overview-01` through `product-overview-09`

```bash
npx shadcn@latest add @ss-blocks/product-overview-01 -c packages/ui
```

Includes: image gallery + details two-col, sticky add-to-cart sidebar, size/color variant selectors, quantity stepper, star rating + review count, accordion specs/shipping/returns.

---

## Category Filter

> Filter panels for product browsing — sidebar, horizontal, chip-based

**6 blocks** · `category-filter-01` through `category-filter-06`

```bash
npx shadcn@latest add @ss-blocks/category-filter-01 -c packages/ui
```

Includes: checkbox filter sidebar, price range slider, color swatch filter, horizontal filter chip row, mobile filter sheet (drawer), active filter chips with clear all.

---

## Mega Footer

> Large multi-column eCommerce footers — links, newsletter, social, legal

**5 blocks** · `mega-footer-01` through `mega-footer-05`

```bash
npx shadcn@latest add @ss-blocks/mega-footer-01 -c packages/ui
```

Includes: 5-col link sections, newsletter signup, payment method icons, app store badges, social links, language selector, legal/cookie links.

---

## Offer Modal

> Promotional popup modals — discount codes, email capture, exit intent

**5 blocks** · `offer-modal-01` through `offer-modal-05`

```bash
npx shadcn@latest add @ss-blocks/offer-modal-01 -c packages/ui
```

Includes: exit-intent discount modal, first-purchase email capture, sale countdown popup, "spin to win" style, free shipping threshold reminder.

---

## Order Summary

> Cart / checkout order summary panels — itemized, with promo codes

**5 blocks** · `order-summary-01` through `order-summary-05`

```bash
npx shadcn@latest add @ss-blocks/order-summary-01 -c packages/ui
```

Includes: sticky sidebar summary, expandable item list, promo code input, tax + shipping breakdown, loyalty points display.

---

## Product Quick View

> Quick-view modals for product cards — image + add to cart without leaving the listing

**5 blocks** · `product-quick-view-01` through `product-quick-view-05`

```bash
npx shadcn@latest add @ss-blocks/product-quick-view-01 -c packages/ui
```

---

## Product Reviews

> Review sections — star breakdowns, written reviews, media uploads

**5 blocks** · `product-reviews-01` through `product-reviews-05`

```bash
npx shadcn@latest add @ss-blocks/product-reviews-01 -c packages/ui
```

Includes: star rating breakdown bar chart, paginated review list with avatar, review form with star picker, photo/video review grid, verified purchase badges.

---

## Checkout Page

> Full checkout page layouts; block 04 uses `@stepperize/react`

**4 blocks** · `checkout-page-01` through `checkout-page-04`

```bash
npx shadcn@latest add @ss-blocks/checkout-page-01 -c packages/ui
```

| Slug | Description | Deps |
|---|---|---|
| `checkout-page-01` | Single-page checkout (address + payment + summary) | — |
| `checkout-page-02` | Two-col (form left, summary right) | — |
| `checkout-page-03` | Express checkout with saved addresses | — |
| `checkout-page-04` | Multi-step checkout wizard | `@stepperize/react` |

---

## Shopping Cart

> Cart drawer / page — item list, quantity, totals

**4 blocks** · `shopping-cart-01` through `shopping-cart-04`

```bash
npx shadcn@latest add @ss-blocks/shopping-cart-01 -c packages/ui
```

Includes: slide-out cart drawer (Sheet), full cart page with quantity steppers, mini cart dropdown (popover), empty cart state.

---

## Gift Card

> Gift card purchase / redemption; all New

**3 blocks** · `gift-card-01` through `gift-card-03`

```bash
npx shadcn@latest add @ss-blocks/gift-card-01 -c packages/ui
```

| Slug | Description | Flag |
|---|---|---|
| `gift-card-01` | Gift card purchase form (amount selector, personalized message) | **[New]** |
| `gift-card-02` | Gift card balance check / redeem | **[New]** |
| `gift-card-03` | Digital gift card design selector | **[New]** |

---

# Key External Dependencies

These npm packages appear across multiple blocks — install when needed:

| Package | Used by |
|---|---|
| `motion` | bento-grid, dashboard-dropdown-08/10, onboarding-feed-05, card-nav-02, compare-05 |
| `react-payment-inputs` | dialog-03/07/16, card-nav-02/05, form-layout-09, widget-11 |
| `react-19-credit-card` | dialog-03, account-settings-07, card-nav-02 |
| `@stepperize/react` | dialog-16, multi-step-form, form-layout-08/09, card-nav-05, onboarding-feed-02, checkout-page-04 |
| `@dnd-kit/core` + sortable | dashboard-dropdown-22/23 |
| `@vis.gl/react-google-maps` | widget-component-19 |
| `@tanstack/react-table` | all datatable-component blocks |
| `react-hook-form` + `zod` | form-layout-03/09 |
| `@hookform/resolvers` | form-layout-03/09 |
| `sonner` | account-settings-03, form-layout-03 |
| `react-aria-components` | form-layout-08 |
| `three` + `three-globe` + `@react-three/drei` + `@react-three/fiber` | social-proof-10/11 |
| `react-use` | compare-03 |

---

# RetailOS Usage Guide

## POS / Operations UI

| Need | Recommended blocks |
|---|---|
| Checkout / payment flow | `dashboard-dialog-03`, `dashboard-dialog-07`, `dashboard-dialog-10`, `form-layout-06/07`, `checkout-page-01/02` |
| Product form | `dashboard-dialog-12`, `form-layout-08` |
| Sales metrics | `statistics-component-01–10`, `chart-component-01–10` |
| Transaction widget | `widget-component-03`, `widget-component-14` |
| Order widget | `widget-component-15`, `widget-component-17` |
| Top products | `widget-component-05`, `widget-component-18` |
| DataTable (inventory) | `datatable-component-05`, `datatable-component-07` |
| App shell | `application-shell-01–06` |
| Empty states | `empty-state-01`, `empty-state-05` |
| Notifications dropdown | `dashboard-dropdown-12` |
| Cart dropdown | `dashboard-dropdown-17` |
| Shopping cart | `shopping-cart-01` (drawer), `shopping-cart-04` (dropdown) |
| Product listing | `product-list-01–04` |
| Product detail | `product-overview-01/02` |
| Category browsing | `product-category-01–03` |
| Quick view modal | `product-quick-view-01` |
| Promo banner | `announcement-banner-01–03` |
| Offer popup | `offer-modal-01` |

## Onboarding / Auth

| Need | Recommended blocks |
|---|---|
| Login page | `login-page-01/02` |
| Registration | `register-01/02` |
| Forgot password | `forgot-password-01` |
| Reset password | `reset-password-01` |
| Email verification | `verify-email-01` |
| 2FA setup | `two-factor-authentication-01`, `dashboard-dialog-08` |
| Multi-step signup | `card-nav-02`, `card-nav-05`, `form-layout-09` |
| Onboarding checklist | `onboarding-feed-01`, `onboarding-feed-03` |
| Upload profile photo | `file-upload-04` |
| Plan selection | `dashboard-dialog-01`, `dashboard-dialog-05` |

## Settings Pages

| Need | Recommended blocks |
|---|---|
| Full account settings | `account-settings-01` |
| Notifications | `account-settings-02` |
| Security / 2FA | `account-settings-06` |
| Billing | `account-settings-07` |
| Team members | `account-settings-05` |
| Integrations | `account-settings-04` |
| Workspace config | `account-settings-03` |

## Marketing / Landing

| Need | Recommended blocks |
|---|---|
| Hero | `hero-section-01` (centered), `hero-section-03` (two-col), `hero-section-10` (dashboard preview) |
| Features | `features-section-01/02/07` |
| Testimonials | `testimonials-component-01/02/03` |
| Pricing | `pricing-component-01–05` |
| FAQ | `faq-component-01–05` |
| Navbar | `navbar-component-01/02` |
| Footer | `footer-component-01/02/03` |
| CTA | `cta-section-01/02/03` |
| Feature bento | `bento-grid-01`, `bento-grid-08`, `bento-grid-10` |
| E-commerce bento | `bento-grid-09`, `bento-grid-19` |
| Error page | `error-page-01` |
| Logo cloud | `logo-cloud-01/02` |
