# Magic UI — Free Components + Magic UI Pro Inventory

> Two registries exist:
> - **Free** components: public registry `https://magicui.design/r/{name}.json` — **no token**.
> - **Pro** templates/sections: `https://r.magicui.design` (configured in `packages/ui/components.json`) — **token-gated** via `Authorization: Bearer ${MAGICUI_PRO_REGISTRY_TOKEN}`.
>
> ⚠️ **Access status (Step 1.4)**: the registry config has been **fixed and verified** (`@magicui` key + `{name}.json` URL template) — `shadcn search @magicui -c packages/ui` now recognizes the registry and reports that **only `MAGICUI_PRO_REGISTRY_TOKEN` is missing** (still empty/unset). So items still cannot be enumerated/installed until the token is set, but the config is no longer the blocker.
> The component lists below are taken from **Magic UI's official public documentation** (`magicui.design/docs`, `pro.magicui.design`) so the catalog is real — set the token (see `INDEX.md` → Remediation) to install.
>
> **Framework note (critical for verdicts):** Magic UI is **React + Tailwind + Framer Motion**, and the **Pro *templates* are Next.js pages**. RetailOS web is **Vite/TanStack (`rsc: false`)** — individual components drop in fine (framework-agnostic React), but Pro *page templates* need porting. Everything here is **motion-first / decorative**, so per charter §5: **Use on storefront / marketing / auth / onboarding / executive landing; Maybe/Skip on POS checkout and high-frequency data entry.**

## Correct install (official) — replaces the `--registry` form in README

```bash
# Free component (public registry, no token) — into shared UI package
npx shadcn@latest add @magicui/marquee -c packages/ui

# Pro component/template (requires MAGICUI_PRO_REGISTRY_TOKEN in env + @magicui configured)
MAGICUI_PRO_REGISTRY_TOKEN=<token> npx shadcn@latest add @magicui/<name> -c packages/ui
```
There is **no `--registry` flag** in the shadcn CLI — items are referenced as `@namespace/name`.

---

## Magic UI Free — components (~70) — Tier: Free, Motion: Y (Framer Motion) unless noted

### Special Effects
| Item | What it is | RetailOS surface(s) | Verdict |
|---|---|---|---|
| @magicui/animated-beam | Animated connector beam between nodes | Marketing diagrams, integrations | **Use** (marketing) / **Skip** (POS) |
| @magicui/border-beam | Animated border glow | Marketing cards, pricing | **Use** (marketing) |
| @magicui/shine-border | Shimmering border | Marketing/auth highlight | **Maybe** |
| @magicui/magic-card | Spotlight-follow card | Marketing/landing | **Use** (marketing) |
| @magicui/glare-hover | Glare on hover | Marketing | **Maybe** |
| @magicui/meteors | Meteor shower bg effect | Marketing hero | **Maybe** (decorative) |
| @magicui/confetti | Confetti burst | Onboarding success, storefront order-placed | **Use** (onboarding only) |
| @magicui/particles | Particle field bg | Marketing hero | **Maybe** |
| @magicui/animated-theme-toggler | Animated light/dark toggle | Any chrome | **Maybe** (core has mode-toggle) |

### Text Animations (18)
Text Animate, Typing Animation, Line Shadow Text, Aurora Text, Video Text, Number Ticker, Animated Shiny Text, Animated Gradient Text, Text Reveal, Dia Text Reveal, Hyper Text, Word Rotate, Scroll Based Velocity, Sparkles Text, Morphing Text, Spinning Text, Text Highlighter, Text 3D Flip.

| Group | RetailOS surface(s) | Verdict |
|---|---|---|
| **Number Ticker** | KPI counters on exec dashboards & marketing stats | **Use** (the one text-anim with real product value) |
| All other text animations | Marketing hero/landing only | **Maybe** (decorative) / **Skip** on app surfaces |

### Core Animations
| Item | What it is | RetailOS surface(s) | Verdict |
|---|---|---|---|
| @magicui/marquee | Infinite scrolling row | Logo cloud, testimonials | **Use** (marketing) |
| @magicui/blur-fade | Scroll/enter blur-fade | Marketing sections | **Use** (marketing) |
| @magicui/animated-list | Staggered list reveal | Marketing, activity feeds | **Maybe** |

### Buttons
| Item | RetailOS surface(s) | Verdict |
|---|---|---|
| @magicui/rainbow-button, shimmer-button, ripple-button, shiny-button, pulsating-button, interactive-hover-button | Marketing CTAs, storefront promos | **Maybe** (must re-theme; core `button` preferred in-app) / **Skip** on POS |

### Backgrounds (11)
Flickering Grid, Animated Grid Pattern, Retro Grid, Ripple, Dot Pattern, Grid Pattern, Hexagon Pattern, Striped Pattern, Interactive Grid Pattern, Light Rays, Noise Texture.

| Group | RetailOS surface(s) | Verdict |
|---|---|---|
| Dot Pattern / Grid Pattern / Striped Pattern (static-ish) | Marketing/auth section backgrounds | **Use** (marketing) |
| Flickering/Animated/Retro Grid, Ripple, Light Rays, Interactive Grid | Marketing hero only | **Maybe** (heavy motion) / **Skip** on app |

### Device Mocks
| Item | RetailOS surface(s) | Verdict |
|---|---|---|
| @magicui/safari, iphone, android | Marketing app showcase | **Use** (marketing) |

### Other Components
Bento Grid, Terminal, Hero Video Dialog, Dock, Globe, Tweet Card, Orbiting Circles, Avatar Circles, Icon Cloud, Lens, Pointer, Smooth Cursor, Progressive Blur, Dotted Map, File Tree, Code Comparison, Scroll Progress, Neon Gradient Card, Comic Text, Kinetic Text, Cool Mode, Pixel Image, Warp Background, Backlight, Animated Circular Progress Bar.

| Notable item | RetailOS surface(s) | Verdict |
|---|---|---|
| @magicui/bento-grid | Marketing/dashboard feature grid | **Use** (marketing) |
| @magicui/hero-video-dialog | Marketing hero video | **Use** (marketing) |
| @magicui/avatar-circles | Social proof, team | **Use** (marketing) |
| @magicui/dotted-map | "Coverage"/locations marketing | **Maybe** |
| @magicui/animated-circular-progress-bar | KPI/onboarding progress | **Use** (dashboards/onboarding) |
| @magicui/scroll-progress | Long marketing/docs pages | **Use** (marketing/docs) |
| @magicui/file-tree, code-comparison, terminal | Dev-tool/docs marketing | **Maybe** (fumadocs site) |
| Globe, Icon Cloud, Orbiting Circles, Marquee-likes | Marketing hero | **Maybe** (decorative) |

---

## Magic UI Pro — templates (9) & sections (50+) — Tier: Pro, Motion: Y, **install BLOCKED (token unset)**

### Templates (Next.js pages — need porting to Vite/TanStack)
Codeforge, AI Agent, Dev Tool, Mobile, SaaS, Startup, Portfolio, Changelog, Blog.

| Template | RetailOS surface(s) | Verdict |
|---|---|---|
| SaaS / Startup | RetailOS marketing site, product landing | **Use** (port sections; don't import whole Next.js page) |
| Mobile | Marketing for the warehouse/native app | **Use** |
| Dev Tool / Codeforge / AI Agent | Platform/MSP/dev-portal marketing | **Maybe** |
| Changelog / Blog | Product changelog, blog (or fold into fumadocs) | **Maybe** |
| Portfolio | (low RetailOS fit) | **Skip** |

### Page Sections (50+)
Header, Hero, Social Proof, Feature Scroll, Feature Slideshow, Feature Cards, Pricing, Call To Action, FAQ, Footer (and more).

| Section group | RetailOS surface(s) | Verdict |
|---|---|---|
| Hero / Feature Cards / Pricing / CTA / FAQ / Footer / Social Proof / Header | Marketing site & storefront landing | **Use** (re-theme to §5 tokens; these are the Pro value) |
| Feature Scroll / Feature Slideshow | Marketing | **Maybe** (heavy scroll motion) |

---

## Verdict summary

Magic UI is a **marketing/storefront/onboarding** asset, not an app-surface one. Highest product value across the whole library: **Number Ticker** (KPI counters), **Animated Circular Progress Bar**, **Marquee + Avatar Circles** (social proof), **Bento Grid**, **Hero Video Dialog**, **Confetti** (onboarding success), and the **Pro marketing sections** (Hero/Pricing/CTA/FAQ/Footer). Everything must be re-tokenized to RetailOS colors/radii, and nothing belongs on the POS checkout or high-frequency data-entry paths (§5 speed/density rule). All of it is currently **blocked until** the registry `@`-prefix fix + `MAGICUI_PRO_REGISTRY_TOKEN` are in place (see `INDEX.md`).
