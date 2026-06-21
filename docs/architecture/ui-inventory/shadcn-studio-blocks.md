# shadcn/studio Pro — Block Inventory

*Source: live MCP catalog via `mcp__shadcn-studio-mcp__get-blocks-metadata` | Generated: 2026-06-21*

Registry configured in `packages/ui/components.json` under `@ss-blocks`, `@ss-components`, `@ss-themes`.
Credentials: `EMAIL` + `LICENSE_KEY` from root `.env` (Infisical `/credentials/shadcnstudio/`).

---

## How to Install a Block

```bash
# Via CLI (from RetailOS root, targets shared packages/ui)
npx shadcn@latest add @ss-blocks/<block-slug> -c packages/ui

# Via MCP (discovery + install command generated for you)
/cui  Add a dashboard shell with collapsible sidebar and top nav
```

**Block slug format:** `<block-type>-<number>` e.g. `application-shell-04`, `hero-section-03`

Numbers map to visual variants — use `/cui` to browse visuals before choosing a number.

---

## Dashboard & Application

| Block | Variants | CLI slugs |
|-------|----------|-----------|
| Application Shell | 9 | `application-shell-01` → `application-shell-09` |
| Dashboard Shell | 9 | `dashboard-shell-01` → `dashboard-shell-09` |
| Dashboard Header | 6 | `dashboard-header-01` → `dashboard-header-06` |
| Dashboard Sidebar | 2 | `dashboard-sidebar-01` → `dashboard-sidebar-02` |
| Dashboard Dialog | 2 | `dashboard-dialog-01` → `dashboard-dialog-02` |
| Dashboard Dropdown | 2 | `dashboard-dropdown-01` → `dashboard-dropdown-02` |
| Dashboard Footer | 1 | `dashboard-footer-01` |
| Charts Component | 5 | `charts-component-01` → `charts-component-05` |
| Statistics Component | 3 | `statistics-component-01` → `statistics-component-03` |
| Widgets Component | 2 | `widgets-component-01` → `widgets-component-02` |
| Card Nav | 1 | `card-nav-01` |
| Multi-Step Form | 3 | `multi-step-form-01` → `multi-step-form-03` |
| Form Layout | 2 | `form-layout-01` → `form-layout-02` |
| Account Settings | 2 | `account-settings-01` → `account-settings-02` |
| File Upload | 1 | `file-upload-01` |
| Empty State | 1 | `empty-state-01` |
| Onboarding Feed | 1 | `onboarding-feed-01` |

**Total: 52 blocks across 17 types**

### RetailOS priority picks (dashboard/POS surfaces)

| Use case | Recommended block |
|----------|-------------------|
| Main app shell with sidebar | `application-shell-04` or `application-shell-05` |
| POS / data-heavy shell | `dashboard-shell-04` or `dashboard-shell-08` |
| Metrics overview | `statistics-component-02` or `statistics-component-03` |
| Product onboarding | `onboarding-feed-01` |
| Settings page | `account-settings-01` |
| Product upload form | `file-upload-01` |
| Multi-step checkout wizard | `multi-step-form-02` |

---

## DataTable

| Block | Variants | CLI slugs |
|-------|----------|-----------|
| DataTable | 2 | `datatable-component-01` → `datatable-component-02` |

**Total: 2 blocks**

---

## Bento Grid

| Block | Variants | CLI slugs |
|-------|----------|-----------|
| Bento Grid | 10 | `bento-grid-01` → `bento-grid-10` |

**Total: 10 blocks**

---

## eCommerce

| Block | Variants | CLI slugs |
|-------|----------|-----------|
| Product Overview | 2 | `product-overview-01` → `product-overview-02` |
| Product Quick View | 1 | `product-quick-view-01` |
| Product Category | 1 | `product-category-01` |
| Product List | 1 | `product-list-01` |
| Product Reviews | 2 | `product-reviews-01` → `product-reviews-02` |
| Shopping Cart | 1 | `shopping-cart-01` |
| Checkout Page | 1 | `checkout-page-01` |
| Order Summary | 1 | `order-summary-01` |
| Category Filter | 1 | `category-filter-01` |
| Offer Modal | 1 | `offer-modal-01` |
| Announcement Banner | 1 | `announcement-banner-01` |
| Mega Footer | 1 | `mega-footer-01` |
| Gift Card | 1 | `gift-card-01` |

**Total: 14 blocks across 13 types**

### RetailOS priority picks (storefront surfaces)

| Use case | Recommended block |
|----------|-------------------|
| Product listing page | `product-list-01` + `category-filter-01` |
| Product detail page | `product-overview-01` |
| Quick-add from list | `product-quick-view-01` |
| Cart / checkout | `shopping-cart-01` + `checkout-page-01` |
| Order confirmation | `order-summary-01` |
| Promo / sale launch | `announcement-banner-01` + `offer-modal-01` |

---

## Marketing UI

| Block | Variants | CLI slugs |
|-------|----------|-----------|
| Hero Section | 15 | `hero-section-01` → `hero-section-15` |
| Features Section | 7 | `features-section-01` → `features-section-07` |
| Pricing | 2 | `pricing-component-01` → `pricing-component-02` |
| Testimonials | 4 | `testimonials-component-01` → `testimonials-component-04` |
| Social Proof | 3 | `social-proof-01` → `social-proof-03` |
| About Us Page | 6 | `about-us-page-01` → `about-us-page-06` |
| Team Section | 2 | `team-section-01` → `team-section-02` |
| CTA Section | 1 | `cta-section-01` |
| Logo Cloud | 1 | `logo-cloud-01` |
| FAQ | 2 | `faq-component-01` → `faq-component-02` |
| Gallery | 1 | `gallery-component-01` |
| Blog | 2 | `blog-component-01` → `blog-component-02` |
| Contact Us | 2 | `contact-us-page-01` → `contact-us-page-02` |
| Download | 1 | `download-01` |
| Timeline | 1 | `timeline-component-01` |
| Navbar | 2 | `navbar-component-01` → `navbar-component-02` |
| Footer | 1 | `footer-component-01` |
| Login Page | 1 | `login-page-01` |
| Register | 1 | `register-01` |
| Forgot Password | 1 | `forgot-password-01` |
| Reset Password | 1 | `reset-password-01` |
| Verify Email | 1 | `verify-email-01` |
| Two Factor Auth | 1 | `two-factor-authentication-01` |
| Error Page | 2 | `error-page-01` → `error-page-02` |
| Compare | 1 | `compare-01` |
| Cookies Consent | 1 | `cookies-consent-01` |
| Portfolio | 2 | `portfolio-01` → `portfolio-02` |
| App Integration | 1 | `app-integration-01` |
| User Schedule | 1 | `user-schedule-01` |

**Total: 67 blocks across 29 types**

---

## Grand Total

| Category | Types | Blocks |
|----------|-------|--------|
| Dashboard & Application | 17 | 52 |
| DataTable | 1 | 2 |
| Bento Grid | 1 | 10 |
| eCommerce | 13 | 14 |
| Marketing UI | 29 | 67 |
| **Total** | **61** | **145** |

> Note: These are `/iui` (inspiration) variant counts from the MCP. The `/cui` workflow targets the same
> blocks by category + number. Block slugs above follow the standard naming convention — use `/cui` with
> the visual description if a slug doesn't resolve, as some may use alternate naming.

---

## Discovery Workflow

The studio registry has no searchable index (`registry.json` 404s). Always use the MCP:

```
# Browse a category
/cui  Show me all dashboard shell variants

# Install a specific one
/cui  Install application-shell-05 into packages/ui

# Refine after install
/rui  Update the sidebar to use RetailOS brand colors
```
