# RetailOS Navigation — Information Architecture (decision)

> **Status:** DECISION (frontend build-out, 2026-06-29). The source of truth for `apps/web/src/configs/nav-config.ts`
> and the AdminCN-sourced sidebar/header. Research-backed (Odoo, NetSuite, SAP Business One, Dynamics 365 BC,
> Shopify Polaris, Lightspeed, QuickBooks Online, Zoho, Cin7) + owner blueprint (`admincn-shell-nav-model` memory).
> Companion to `frontend-strategy.md` (sourcing law) and the `retailos-design-language` skill (pixel law).

## The enterprise pattern (why this shape)

Every mature ERP/retail product converges on the same navigation shape:
- A **persistent left sidebar of ~6–9 noun-labeled module groups** as the spine.
- A **role/context switcher** (NetSuite "Centers", Dynamics "Role Centers", Odoo app switcher, QBO Business-vs-Accountant)
  that **re-scopes the same sidebar to the user's job** — not parallel IAs.
- **Shallow nesting** — one expand level (Shopify forbids nested items entirely; UX research caps sidebars at two
  levels because each extra level adds ~25% task time).
- **Tabs / sub-navigation inside a record or workspace** for different views of the *same* thing.
- A **Cmd-K command palette + global search** with recents/favorites for power users.
- A **company/location switcher** in the header (multi-company §8, multi-location §12).
- **Settings/admin deliberately separated** from operational nav (bottom-pinned or behind a gear).

**The load-bearing rule (owner blueprint):** a **sidebar item = a distinct workflow**; **tabs = different views of
one workflow**. Product Info / SKUs / Barcodes / Prices / Media are TABS inside a Product; Stock / Transfers / Lots
are separate sidebar items. Depth lives in tabs and search, never in a 4-level menu.

## Workspace switcher (header, top-left)

Re-orders/filters the same sidebar per role (resolved via existing RBAC); POS is the exception — full-screen, no module sidebar.

- **POS / Register** — full-screen cashier app, minimal chrome (speed path)
- **Store Retail** (store-manager default) · **Inventory & Warehouse** · **Finance / Back-office** · **Commerce** (online store)
- **Platform / MSP Admin** — platform owner only; kept entirely out of tenant nav

## Back-office sidebar (≤8 operational groups + utility items)

Top of sidebar = **Pinned/Favorites + Recents** (QBO bookmarks). Bottom = **Settings**, visually separated.

| Group | Items | Depth-2 nested | Lives as TABS (not sidebar) |
|---|---|---|---|
| **Home** | Role dashboard (owner/store/warehouse/accountant KPIs) | — | — |
| **Sales** | Point of Sale*, Orders / Receipts, Customers, Pricing & Promotions, Shifts & Cash | Customers → Customers · Loyalty · Store credit; Pricing → Price lists · Promotions · Discounts | Customer profile/orders/balance/activity = tabs in the customer record |
| **Catalog** | Products, Categories & Brands | — | SKUs · Variants · Lots · Barcodes · UoM · Media = tabs inside a Product |
| **Inventory & Warehouse** | Stock on hand, Stock ledger / Movements, Adjustments · Counts, Transfers, Lots & Expiry (FEFO), Locations & Warehouses | Locations → Locations · Warehouses · **Bonded goods** | Receiving/putaway/picking = tabs in a location/receiving doc |
| **Purchasing** | Suppliers, Purchase orders, Goods receipts (GRN), Bills & payments, Landed costs | — | PO pipeline = a board/tab view of Purchase Orders |
| **Finance** | Chart of accounts, Journals, Receivables (AR), Payables (AP), Banking & reconciliation, Tax | — | each ledger's drilldowns = tabs |
| **Online Store** *(feature-flagged)* | Storefront, Online orders, Collections & content | — | — |
| **Reports** *(single item → hub)* | Reports hub | — | report categories = tabs/facets inside |
| **Settings** *(bottom, separated)* | Users & roles, Company/locations setup, White-label/branding, Integrations, Billing/Subscription, Fiscal numbering, **Audit log** | — | — |

\*Point of Sale launches the full-screen register workspace.

7 operational groups + Home + Reports + Settings — within the ≤8 guidance, no flat 20-item list.

## Header utility cluster (not sidebar)

- **Cmd-K command palette + global search** (already built — keep)
- **Company + Location switcher** (Lightspeed model — do NOT bury in Settings)
- **Approvals / Tasks inbox** — badge + dedicated page (charter §22 approval engine: PO thresholds, voids/refunds, bond release, journals, credit). *Biggest missing destination in any mature ERP.*
- **Notifications center** (header bell) — this is where the ported `mail` page goes
- **Help / "Report Issue" diagnostic** (charter §26 in-app telemetry) — where the ported `faq` page goes
- **Account menu**

## Ported AdminCN pages — disposition

| Page | Verdict | Home |
|---|---|---|
| sales-overview dashboard | **nav** | this IS *Home* for the Store/Owner role |
| payments dashboard | **demote → contextual** | tab/tile under Finance › Banking |
| productivity dashboard | **hide (showcase)** | HR/staff-perf is a later phase |
| campaigns dashboard | **demote, flagged** | Sales › Pricing & Promotions (until CRM/marketing built) |
| form-layouts / validation / wizard | **hide demo; keep wizard PATTERN** | reused by setup wizards |
| data-tables showcase | **hide (dev-only)** | the table pattern is reused everywhere |
| error 404 / 500 / maintenance | **router error boundaries / system routes** | not nav |
| kanban (procurement board) | **demote → board tab** | Purchasing › Purchase orders |
| calendar (retail ops) | **hide until backing feature** | later: a tab in Operations |
| contacts (CRM) | **nav** | Sales › Customers (the contacts list) |
| mail (notifications) | **demote → header bell** | Notifications center |
| chat (staff messaging) | **hide / future** | no backing data |
| pricing | **demote → Settings › Billing** | SaaS plan page (or marketing site) |
| faq | **demote → header Help** | Help menu |
| onboarding | **contextual** | first-run wizard launched from Settings |
| empty-states | **hide (pattern, not page)** | reused as empty states across lists |

**Implementation note:** "hide" = the route may still exist (work isn't thrown away; the pattern is reused), but it is
**not a primary sidebar destination**. Showcase/demo routes are reachable via the command palette / a low-prominence
**Design · Components** section, never cluttering operational nav. This honors the owner's "only what's relevant to us."

## Reserved for later (leave room so the IA doesn't force a re-org)

- **Assets** module group (§21) · **HR / Staff** module group (§21)
- **Platform / MSP console** as its own workspace (tenant health, MRR/billing, impersonation banner, feature flags, residency)

## Sources

Odoo nav docs · NetSuite Custom Centers/Tabs (Salto, Oracle) · Shopify Polaris IA + app Navigation · Dynamics 365 BC
Role Centers · Lightspeed Retail BackOffice · QuickBooks Online customizable left nav · Zoho Inventory modules · SAP
Business One Main Menu · command-palette + multilevel-menu UX research (Mobbin, Toptal, PatternFly).
