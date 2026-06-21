# Magic UI Pro — Complete Block Inventory

> **Registry:** `@magicui-pro` → `https://pro.magicui.design/registry/{name}`  
> **Auth:** `Authorization: Bearer ${MAGICUI_PRO_REGISTRY_TOKEN}` (set in `.env`, see `.env.example`)  
> **Enumeration method:** Live registry fetch via `GET /registry.json` with token — 2026-06-21  
> **Total:** 103 items — 100 blocks + 2 themes + 1 style

---

## Install

```bash
# Magic UI Pro block (token must be in .env)
npx shadcn@latest add @magicui-pro/hero-1 -c packages/ui

# Magic UI free component (no token)
npx shadcn@latest add @magicui/marquee -c packages/ui
```

---

## TanStack Adaptation Notes (read before installing)

Magic UI Pro blocks are written for **Next.js**. RetailOS web is **Vite + TanStack Start** (`rsc: false`). Individual component code ports fine — but two patterns need patching after every install:

| Pattern in block source | RetailOS fix |
|---|---|
| `import Image from "next/image"` | Replace with `<img src={...} alt={...} />` |
| `import { useTheme } from "next-themes"` | Remove or replace with `document.documentElement.classList` toggle — used only in `header-1` |
| `import { StarFilledIcon } from "@radix-ui/react-icons"` | Replace with `<Star className="fill-current" />` from `lucide-react` (do NOT install `@radix-ui/react-icons`) |
| `import { CheckIcon } from "@radix-ui/react-icons"` | Replace with `<Check />` from `lucide-react` |
| `import { LinkedInLogoIcon, TwitterLogoIcon } from "@radix-ui/react-icons"` | Replace with `<Linkedin />`, `<Twitter />` from `lucide-react` |

> **Charter §5 rule:** Magic UI is motion-first / decorative. Use on **storefront, marketing, auth, onboarding**. Skip on POS checkout and high-frequency data-entry paths.

---

## Block Count by Category

| Category | Blocks | Notes |
|---|---|---|
| [Hero](#hero) | 26 | Largest category — hero-1 through hero-26 |
| [Call to Action](#call-to-action) | 13 | |
| [Footer](#footer) | 11 | |
| [Animated Feature Card](#animated-feature-card) | 10 | All use `motion` |
| [Pricing](#pricing) | 9 | Most use `@number-flow/react` |
| [Stats](#stats) | 5 | |
| [Header](#header) | 5 | header-1 needs `next-themes` fix |
| [FAQ](#faq) | 4 | |
| [Social Proof — Companies](#social-proof--companies) | 4 | |
| [Feature](#feature) | 4 | Gaps: no feature-4/5 |
| [Social Proof — Testimonials](#social-proof--testimonials) | 3 | Uses `StarFilledIcon` → fix |
| [Social Proof — Press](#social-proof--press) | 3 | |
| [Carousel](#carousel) | 2 | Uses `embla-carousel` |
| [Feature Scroll](#feature-scroll) | 1 | Tall scroll-pinned section |
| **Total blocks** | **100** | |
| Themes | 2 | `blue-theme`, `red-theme` |
| Style | 1 | `index` (base style) |
| **Grand total** | **103** | |

---

## Hero

> Full-page hero sections — animated, email capture, badge + CTA, split-screen, dashboard previews

**26 blocks** · `hero-1` through `hero-26`

```bash
npx shadcn@latest add @magicui-pro/hero-1 -c packages/ui
```

| Slug | Key Deps | Description |
|---|---|---|
| `hero-1` | `motion`, `@magicui/border-beam`, `button` | Fade-in animated hero; border beam on dashboard preview card |
| `hero-2` | `@magicui/border-beam`, `@magicui/retro-grid` | Retro grid background; border beam highlights |
| `hero-3` | — | Clean centered SaaS hero — no motion deps |
| `hero-4` | — | Split content, static layout |
| `hero-5` | — | Centered with feature list below |
| `hero-6` | — | Minimal CTA — just heading + buttons |
| `hero-7` | — | Two-column layout |
| `hero-8` | — | Feature preview panel |
| `hero-9` | `badge`, `button` | Badge + headline + description + dual CTAs; `next/image` present ⚠️ |
| `hero-10` | `button`, `input` | Email capture input + CTA button |
| `hero-11` | `badge`, `button`, `input` | Badge + email capture + dual CTAs |
| `hero-12` | `button` | Centered bold headline + button |
| `hero-13` | — | Dark themed full-bleed |
| `hero-14` | — | Feature showcase preview |
| `hero-15` | — | Split with media panel |
| `hero-16` | `badge`, `button`, `input` | Email capture + badge; condensed/compact variant |
| `hero-17` | — | Product image hero |
| `hero-18` | — | Dashboard preview hero |
| `hero-19` | — | Large screenshot showcase |
| `hero-20` | — | Gradient background |
| `hero-21` | `button`, `marquee` | CTA + marquee logo cloud below |
| `hero-22` | `badge`, `button`, `input` | Email capture compact (alternate layout of 16) |
| `hero-23` | `button` | Minimal centered |
| `hero-24` | `button`, `marquee` | CTA + marquee social proof row |
| `hero-25` | — | Feature-list hero |
| `hero-26` | — | Full-bleed with visual panel |

**Common patterns:** heading + description + dual CTA (`button` primary/outline). Several contain `next/image` — replace with `<img>` after install.

---

## Call to Action

> CTA sections — email capture, marquee testimonials, simple banner, gradient

**13 blocks** · `call-to-action-1` through `call-to-action-13`

```bash
npx shadcn@latest add @magicui-pro/call-to-action-1 -c packages/ui
```

| Slug | Key Deps | Description |
|---|---|---|
| `call-to-action-1` | `@magicui/marquee` | CTA with scrolling testimonial marquee above |
| `call-to-action-2` | `@magicui/marquee` | Double-row marquee with logo cloud |
| `call-to-action-3` | — | Dark gradient CTA card |
| `call-to-action-4` | — | Bordered card with heading + two CTAs |
| `call-to-action-5` | — | Light background, centered |
| `call-to-action-6` | — | Colored background section |
| `call-to-action-7` | — | Compact inline CTA |
| `call-to-action-8` | — | With decorative graphic element |
| `call-to-action-9` | — | Minimal — just headline + button |
| `call-to-action-10` | — | Bordered section card |
| `call-to-action-11` | — | Ultra-minimal centered text + button |
| `call-to-action-12` | `button` | Email input + submit CTA |
| `call-to-action-13` | — | Full-width colored banner |

---

## Footer

> Marketing site footers — multi-column, minimal, dark, branded

**11 blocks** · `footer-1` through `footer-11`

```bash
npx shadcn@latest add @magicui-pro/footer-1 -c packages/ui
```

| Slug | Description | ⚠️ Note |
|---|---|---|
| `footer-1` | 4-col links + newsletter + social icons | Uses `@radix-ui/react-icons` — replace `LinkedInLogoIcon`, `TwitterLogoIcon` with lucide |
| `footer-2` | Single-row minimal (height 111px) | |
| `footer-3` | Ultra-minimal — logo + links + copyright (height 72px) | |
| `footer-4` | Multi-col with newsletter input | |
| `footer-5` | Single-line centered links (height 72px) | |
| `footer-6` | Two-row with social icons | |
| `footer-7` | Minimal with logo + copyright (height 72px) | |
| `footer-8` | Full footer with logo section + columns | |
| `footer-9` | Compact with border-top (height 88px) | |
| `footer-10` | Branded with colored accents | |
| `footer-11` | Full-featured with newsletter + social | |

**Size guide:** Heights 72–111px = minimal single-row; 204–414px = multi-section; pick based on page density.

---

## Animated Feature Card

> Individual animated feature cards — hover-triggered motion effects, icon animations, marquee integration

**10 blocks** · `animated-feature-card-1` through `animated-feature-card-10`

```bash
npx shadcn@latest add @magicui-pro/animated-feature-card-1 -c packages/ui
```

All blocks use `motion` (Framer Motion). Designed to be composed into a **bento grid** or feature section — not standalone page sections.

| Slug | Key Deps | Animation style |
|---|---|---|
| `animated-feature-card-1` | `motion` | Scale + hover reveal |
| `animated-feature-card-2` | `motion` | Content slide reveal |
| `animated-feature-card-3` | `motion` | Compact — hover highlight |
| `animated-feature-card-4` | `motion` | Content reveal on hover |
| `animated-feature-card-5` | `motion` | Stagger reveal |
| `animated-feature-card-6` | `motion` | Card flip / perspective |
| `animated-feature-card-7` | `motion`, `@magicui/marquee` | Icon grid + mini-marquee inside card |
| `animated-feature-card-8` | `motion` | Subtle hover lift |
| `animated-feature-card-9` | `motion` | Tall card with animated content (height 500px) |
| `animated-feature-card-10` | `motion` | Large animated showcase (height 652px) |

> Use 3–4 of these together as a bento grid feature section. Pair with `@magicui/bento-grid` (free) as the layout wrapper.

---

## Pricing

> Pricing tables — monthly/annual toggle, usage-based slider, animated number transitions

**9 blocks** · `pricing-1` through `pricing-9`

```bash
npx shadcn@latest add @magicui-pro/pricing-1 -c packages/ui
```

| Slug | Key Deps | Description | ⚠️ |
|---|---|---|---|
| `pricing-1` | `@number-flow/react`, `button`, `label`, `switch` | 3-tier monthly/annual toggle + animated prices | `@radix-ui/react-icons` → replace `CheckIcon` |
| `pricing-2` | `@number-flow/react`, `lucide-react`, `badge`, `button` | Animated tier cards with popular badge | |
| `pricing-3` | `@number-flow/react`, `lucide-react`, `motion`, `button` | Animated toggle + motion transitions | |
| `pricing-4` | `lucide-react`, `button` | Static 3-tier comparison | `@radix-ui/react-icons` → replace `CheckIcon` |
| `pricing-5` | `@number-flow/react`, `lucide-react`, `motion`, `button` | Animated cards with highlight ring | |
| `pricing-6` | `@number-flow/react`, `lucide-react`, `motion`, `button`, `slider` | **Usage-based** — slider for seat/usage count + animated price | `@radix-ui/react-icons` → replace `CheckIcon` |
| `pricing-7` | `@number-flow/react`, `button`, `label`, `switch` | Toggle + simple tier cards | |
| `pricing-8` | `@number-flow/react`, `motion`, `badge`, `button` | Animated with highlighted tier + badge | `@radix-ui/react-icons` → replace `CheckIcon` |
| `pricing-9` | `lucide-react`, `button` | Static no-animation pricing (lightest weight) | |

**Required install for most:** `bun add @number-flow/react`

> `pricing-6` is the pick for usage-based SaaS (quantity/seat slider with live price update). `pricing-9` for simple static display.

---

## Stats

> Metric / statistics sections — counters, bar charts, KPI grids

**5 blocks** · `stats-1` through `stats-5`

```bash
npx shadcn@latest add @magicui-pro/stats-1 -c packages/ui
```

| Slug | Key Deps | Description |
|---|---|---|
| `stats-1` | `card` | 4-col stat grid — static values (`10K+`, `500+`, `99.9%`, `24/7`) |
| `stats-2` | — | Stat cards with icon + description |
| `stats-3` | — | Horizontal stat row with separators |
| `stats-4` | `chart` (Recharts) | Bar chart with monthly stats + Recharts |
| `stats-5` | — | Large number KPI grid with descriptions |

> Pair `stats-1`/`stats-2` with `@magicui/number-ticker` (free) to animate the numbers on scroll.

---

## Header

> Site navigation headers — animated scroll-aware, static, minimal

**5 blocks** · `header-1` through `header-5`

```bash
npx shadcn@latest add @magicui-pro/header-1 -c packages/ui
```

| Slug | Key Deps | Description | ⚠️ |
|---|---|---|---|
| `header-1` | `motion`, `next-themes` | Scroll-aware animated header; shrinks on scroll, animated menu transitions | Remove `next-themes` dep — use your own theme toggle |
| `header-2` | — | Static standard nav (logo + links + CTA button) | |
| `header-3` | `motion` | Animated underline on active link | |
| `header-4` | `motion` | Slide-down mobile menu animation | |
| `header-5` | — | Minimal top bar (height 96px) | |

> `header-2` is the safest drop-in for TanStack. `header-1` needs `next-themes` removal — replace `useTheme()` with a `useState` + `document.documentElement.classList` toggle or your existing mode-toggle component.

---

## FAQ

> FAQ sections — accordion, categorized, simple

**4 blocks** · `faq-1` through `faq-4`

```bash
npx shadcn@latest add @magicui-pro/faq-1 -c packages/ui
```

| Slug | Description |
|---|---|
| `faq-1` | Categorized accordion FAQ (General / Billing / Technical sections) |
| `faq-2` | Single-category accordion FAQ |
| `faq-3` | Multi-section accordion with category navigation |
| `faq-4` | Compact single accordion (height 548px — lightest) |

---

## Social Proof — Companies

> Company / client logo sections — static grid, animated marquee

**4 blocks** · `social-proof-companies-1` through `social-proof-companies-4`

```bash
npx shadcn@latest add @magicui-pro/social-proof-companies-1 -c packages/ui
```

| Slug | Key Deps | Description |
|---|---|---|
| `social-proof-companies-1` | — | Static 6-logo centered grid (height 244px) |
| `social-proof-companies-2` | — | Static grid with "Trusted by" headline |
| `social-proof-companies-3` | `@magicui/marquee` | Horizontal scrolling logo marquee |
| `social-proof-companies-4` | — | Large full-page company grid with 14+ logos |

---

## Feature

> Full feature sections — accordion with image, two-col, badge grid

**4 blocks** · `feature-1`, `feature-2`, `feature-3`, `feature-6`  
*(no feature-4 or feature-5 in registry)*

```bash
npx shadcn@latest add @magicui-pro/feature-1 -c packages/ui
```

| Slug | Key Deps | Description |
|---|---|---|
| `feature-1` | `motion` | Accordion feature list with animated image swap — click item → image changes |
| `feature-2` | `motion` | Two-column feature section with motion reveal |
| `feature-3` | `motion` | Feature grid with icon cards + motion |
| `feature-6` | `badge` | Feature grid with badge labels on each card |

> `feature-1` is the highest-impact Pro feature section — accordion with image reveal is a proven SaaS pattern. Uses raw `@radix-ui/react-accordion` internally (not the shadcn wrapper) but this is fine as it's bundled in the block.

---

## Social Proof — Testimonials

> Testimonial sections — scrollable cards, grid, marquee

**3 blocks** · `social-proof-testimonials-1` through `social-proof-testimonials-3`

```bash
npx shadcn@latest add @magicui-pro/social-proof-testimonials-1 -c packages/ui
```

| Slug | Key Deps | Description | ⚠️ |
|---|---|---|---|
| `social-proof-testimonials-1` | — | Horizontal scrollable testimonial cards with star rating | Uses `StarFilledIcon` from `@radix-ui/react-icons` → replace with `<Star className="fill-current" />` (lucide) |
| `social-proof-testimonials-2` | — | Grid layout testimonials with avatar + quote |
| `social-proof-testimonials-3` | `@magicui/marquee` | Auto-scrolling testimonial marquee (two rows) |

---

## Social Proof — Press

> Press / media mention sections — logo + quote, coverage list

**3 blocks** · `social-proof-press-1` through `social-proof-press-3`

```bash
npx shadcn@latest add @magicui-pro/social-proof-press-1 -c packages/ui
```

| Slug | Key Deps | Description |
|---|---|---|
| `social-proof-press-1` | — | Static press logo + pull quote grid |
| `social-proof-press-2` | — | Horizontal press mentions bar |
| `social-proof-press-3` | `@magicui/marquee` | Scrolling press logo marquee |

---

## Carousel

> Full-section carousels — testimonials, content slides; use `embla-carousel`

**2 blocks** · `carousel-1`, `carousel-2`

```bash
npx shadcn@latest add @magicui-pro/carousel-1 -c packages/ui
```

**Required install:** `bun add embla-carousel-react embla-carousel-autoplay`

| Slug | Description |
|---|---|
| `carousel-1` | Testimonial carousel with autoplay, prev/next buttons, dot indicators |
| `carousel-2` | Content/feature carousel (height 740px) |

---

## Feature Scroll

> Scroll-pinned alternating feature sections — sticky image swap as user scrolls

**1 block** · `feature-scroll-1`

```bash
npx shadcn@latest add @magicui-pro/feature-scroll-1 -c packages/ui
```

| Slug | Key Deps | Description |
|---|---|---|
| `feature-scroll-1` | `button` | Tall scroll-pinned section (height 2177px) — alternating LTR/RTL image + text blocks that swap as user scrolls through |

> Highest visual impact Pro block for SaaS feature demos. The 2177px height means it spans ~3 viewport scrolls — good for "scroll to explore" marketing flows. Verify scroll behavior in TanStack Start (SSR hydration is fine; this is client-rendered).

---

## Themes

> Pre-built color themes applied via the registry style system

**2 themes** — install as a style, not a component

```bash
npx shadcn@latest add @magicui-pro/blue-theme -c packages/ui
npx shadcn@latest add @magicui-pro/red-theme -c packages/ui
```

These patch `globals.css` with a full set of CSS token overrides. Apply only once — they will overwrite existing color tokens. Useful as a starting point for theming; then customize from there.

---

## Key External Dependencies

Install these when needed — Magic UI Pro blocks reference them but don't auto-install:

| Package | Used by | Install |
|---|---|---|
| `motion` | hero-1, header-1/3/4, animated-feature-card-*, feature-1/2/3, pricing-3/5/6/8, call-to-action-* | `bun add motion` |
| `@number-flow/react` | pricing-1/2/3/5/6/7/8 | `bun add @number-flow/react` |
| `@magicui/marquee` | call-to-action-1/2, social-proof-companies-3, social-proof-press-3, social-proof-testimonials-3, hero-21/24, animated-feature-card-7 | `npx shadcn@latest add @magicui/marquee -c packages/ui` |
| `@magicui/border-beam` | hero-1/2 | `npx shadcn@latest add @magicui/border-beam -c packages/ui` |
| `@magicui/retro-grid` | hero-2 | `npx shadcn@latest add @magicui/retro-grid -c packages/ui` |
| `embla-carousel-react` + `embla-carousel-autoplay` | carousel-1/2 | `bun add embla-carousel-react embla-carousel-autoplay` |
| ~~`@radix-ui/react-icons`~~ | pricing-1/4/6/8, social-proof-testimonials-1, footer-1 | **Do NOT install** — replace icons with lucide equivalents (see adaptation notes above) |

---

## RetailOS Usage Guide

### Marketing / Storefront Landing Page

Build a full marketing page by composing these in order:

```
header-2            ← Navigation (static, no next-themes issue)
hero-1 or hero-11   ← Animated hero with border-beam / email capture
social-proof-companies-1 or -3  ← Logo cloud / trusted-by
feature-1           ← Accordion feature demo (image swap)
animated-feature-card-* (3–4)  ← Bento feature cards
stats-1 or stats-2  ← Metrics (pair with @magicui/number-ticker)
pricing-1 or pricing-7  ← Pricing table with toggle
social-proof-testimonials-3  ← Scrolling testimonial marquee
faq-1 or faq-4      ← FAQ accordion
call-to-action-9 or -11  ← Final CTA
footer-4 or footer-8  ← Footer
```

### Specific Needs

| Need | Recommended block |
|---|---|
| Hero with email capture | `hero-10`, `hero-11`, `hero-16` |
| Hero animated / high-impact | `hero-1` (border-beam), `hero-2` (retro-grid) |
| Static clean hero | `hero-3`, `hero-9` |
| Feature accordion with image | `feature-1` |
| Feature scroll-pinned demo | `feature-scroll-1` |
| Animated bento feature cards | `animated-feature-card-1` through `-4` (compose 3–4) |
| Pricing with annual/monthly toggle | `pricing-1`, `pricing-7` |
| Usage-based pricing slider | `pricing-6` |
| Static simple pricing | `pricing-9` |
| CTA with social proof | `call-to-action-1` (marquee testimonials) |
| Simple CTA banner | `call-to-action-11` |
| Scrolling testimonials | `social-proof-testimonials-3` |
| Press logos | `social-proof-press-1` |
| Scrolling logo cloud | `social-proof-companies-3` |
| Stats counters | `stats-1` + `@magicui/number-ticker` |
| FAQ | `faq-4` (compact) or `faq-1` (categorized) |
| Nav header | `header-2` (static) or `header-1` (animated, needs patch) |
| Footer | `footer-3` (minimal) or `footer-8` (full) |
| Testimonial carousel | `carousel-1` |

### What to Skip on POS / Data-Entry Surfaces

Per charter §5 — do not use any of these on POS checkout, invoice entry, or high-frequency admin tables:
- All `animated-feature-card-*` blocks (decorative only)
- `feature-scroll-1` (marketing-only scroll UX)
- `carousel-1/2` (testimonials — no operational value)
- All `hero-*` blocks (marketing only)

Use shadcn/studio Pro blocks for POS and operational UI instead.
