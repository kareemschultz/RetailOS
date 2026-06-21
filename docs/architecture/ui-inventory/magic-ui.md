# Magic UI (Free) — Complete Component Inventory

> **Registry:** `@magicui` → `https://magicui.design/r/{name}.json` — **Free, MIT, no token**.
> **Install:** `npx shadcn@latest add @magicui/<slug> -c packages/ui`
> **Enumeration:** live `shadcn search @magicui` (paginated, 2026-06-21) — **245 registry items = 77 distinct components + 165 demos/examples + `index` (style) + `utils` (lib)**.
> Magic UI **Pro** (`@magicui-pro`, 103 items) is catalogued separately in [`magic-ui-pro.md`](magic-ui-pro.md).

## Framework & verdict rules (charter §5, Phase-0)

Magic UI is **React + Tailwind + Framer Motion** — nearly every component is animated/decorative. Per §5:
**Use on storefront / marketing / onboarding / auth / executive-dashboard landing; keep OFF the POS checkout and
high-frequency data-entry paths.** All items must be re-themed to RetailOS tokens. The table flags the handful
with genuine product value on dense app surfaces.

> Of 245 rows, ~67% are **demos** (e.g. `text-animate` ships 9, `confetti`/`typing-animation` 8 each). The 77
> `ui` rows below are the real install surface.

## Special Effects (17)

| Slug | What it is | Motion | Verdict (surface) |
|---|---|---|---|
| `magic-card` | Spotlight follows cursor, highlights borders | Y | **Use** (marketing/landing) |
| `neon-gradient-card` | Neon card glow | Y | **Maybe** (marketing) |
| `border-beam`*, `shine-border`* | Light traveling a border | Y | **Use** (featured cards, marketing) |
| `glare-hover` | Diagonal glare on hover | Y | **Maybe** |
| `warp-background` | Time-warp animated bg | Y | **Maybe** (hero only) |
| `light-rays` | Light rays from above | Y | **Maybe** (hero) |
| `lens` | Interactive image zoom | Y | **Use** (storefront product zoom) |
| `pointer`, `smooth-cursor`, `cool-mode` | Custom cursor / particle burst | Y | **Skip** (gimmick; never on app) |
| `confetti` | Celebration burst | Y | **Use** (onboarding/order-complete only) |
| `backlight` | Glow behind media | Y | **Maybe** (marketing) |
| `pixel-image` | Pixelated reveal | Y | **Maybe** (marketing) |
| `highlighter` | Marker-stroke text highlight | Y | **Use** (marketing emphasis) |
| `spinning-text` | Circular spinning text | Y | **Skip** (decorative) |
| `scroll-progress` | Page scroll progress bar | Y | **Use** (long docs/marketing) |
| `progressive-blur` | Static blur gradient | N | **Use** (overlays, marketing) |
| `animated-theme-toggler` | View-Transitions light/dark switch | Y | **Use** (app chrome; vs core `mode-toggle`) |

\* `*-beam`/`shine` also classed as core animations.

## Text Animations (17)
`text-animate`, `typing-animation`, `line-shadow-text`, `aurora-text`, `morphing-text`, `text-reveal`, `dia-text-reveal`, `hyper-text`, `animated-gradient-text`, `animated-shiny-text`, `word-rotate`, `sparkles-text`, `comic-text`, `scroll-based-velocity`, `video-text`, `kinetic-text`, `text-3d-flip`.

All Framer-Motion animated. **Verdict: Use on marketing hero/landing only; Skip on app surfaces.** No product-data value.

## Core Animations (14)

| Slug | What it is | Verdict (surface) |
|---|---|---|
| `number-ticker` | Count-up/down to a target | **Use** — KPI counters (dashboards/stats); **the most product-useful Magic UI item** |
| `animated-circular-progress-bar` | Progress/quota ring gauge | **Use** (dashboards, onboarding, usage) |
| `animated-list` | Sequenced item reveal | **Use** (activity/notification feeds) |
| `marquee` | Infinite scrolling row | **Use** (logo/testimonial strips — marketing/storefront) |
| `orbiting-circles`, `globe`, `icon-cloud` | Orbit / WebGL globe / 3D tag cloud | **Maybe** (marketing hero; heavy) |
| `meteors`, `particles`, `ripple` | Background motion FX | **Maybe/Skip** (hero only) |
| `border-beam`, `animated-beam`, `shine-border` | Beam/glow paths | **Use** (marketing: connect-nodes diagrams, featured) |
| `blur-fade` | Blur fade-in on enter/scroll | **Use** (marketing sections) |

## Buttons (6)
`shimmer-button`, `shiny-button`, `pulsating-button`, `ripple-button`, `rainbow-button`, `interactive-hover-button`.
**Verdict: Maybe** (marketing CTAs / storefront promos, must re-theme) · **Skip** on POS — the owned core `button` is preferred in-app.

## Backgrounds (10)

| Static (Use — marketing/auth section bg) | Animated (Maybe/Skip — hero only) |
|---|---|
| `grid-pattern`, `dot-pattern`, `hexagon-pattern`, `striped-pattern`, `noise-texture` | `interactive-grid-pattern`, `flickering-grid`, `animated-grid-pattern`, `retro-grid` |

`dotted-map` — dotted world map (N; pulse variant animates) → **Use** (lightweight geo/coverage viz, no map dep).

## Device Mocks (4)
`safari`, `iphone`, `android` (static) → **Use** (marketing app showcase). `terminal` (animated) → **Maybe** (devtools/docs marketing).

## Other Components (~9)

| Slug | What it is | Verdict (surface) |
|---|---|---|
| `bento-grid` | Feature/metric layout grid | **Use** (marketing & dashboards) |
| `hero-video-dialog` | Hero video modal | **Use** (marketing) |
| `avatar-circles` | Overlapping avatars | **Use** (social proof, team) |
| `tweet-card` / `client-tweet-card` | Rendered tweet | **Maybe** (marketing social proof) |
| `file-tree` | Folder/file tree | **Use** (docs/devtools, fumadocs site) |
| `code-comparison` | Diff two snippets | **Use** (docs/devtools) |
| `dock` | macOS-style dock nav | **Maybe** (app-shell nav experiment) |

## Top picks for RetailOS (the non-decorative subset)

`number-ticker`, `animated-circular-progress-bar` (dashboards/KPIs) · `marquee`, `avatar-circles`, `bento-grid`,
`hero-video-dialog` (marketing/storefront) · `confetti` (onboarding success) · `scroll-progress`, `file-tree`,
`code-comparison`, `terminal` (docs/devtools) · `animated-theme-toggler` (chrome). Everything else is
marketing-surface motion — **never on POS/data-entry**.
