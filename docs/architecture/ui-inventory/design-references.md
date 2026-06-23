# Design References — TABLE/ADMIN Aesthetic Baseline (Phase 4+)

> Companion to `.agents/skills/retailos-design-language/SKILL.md` (the visual law). This file records the owner-provided reference material and the principles extracted from it. Used only in UI-bearing phases (Phase 4+); ignored during backend phases.

## What these references are
The owner uploaded a set of dashboard/admin reference screenshots and Figma files as the **TABLE / ADMIN aesthetic baseline** for RetailOS. They demonstrate:
- Clean, **Notion/Airtable-style data density** — calm, scannable tables.
- **Semantic status chips** (icon + text), never raw status strings.
- **In-card sparklines / mini-charts** for at-a-glance trend.
- **Subdued secondary text** to establish a clear hierarchy.

## Rules of engagement (important)
- These are the baseline for **admin / catalog / inventory TABLE surfaces only**. They do **NOT** override the module-specific rules for **POS, warehouse, or dashboard** layouts in the design-language skill.
- **Brand shift:** the references use a **green** status accent; RetailOS uses **BLUE** as its primary accent. Green/amber/red stay semantic only.
- RetailOS is an **offline-first ERP, not a database tool** — usability in physical, dimly-lit, fast-paced environments always supersedes "matching a screenshot." The golden rule (would a cashier/warehouse worker/CFO/CEO get it?) governs over any reference image.

## Where the binaries live (and why they're not in git)
The actual reference files (13 PNG screenshots + 9 Figma `.fig` files, **~52 MB total** — the `.fig` files alone are ~46 MB) are **intentionally kept OUT of version control** — large binary design assets bloat a code repo permanently and don't diff. They live in the owner's local `uploaded reference designs for inspiration/` working directory (gitignored) and the design-asset store.

Reference files (by name, for traceability):
- Screenshots (PNG): `D321349D-…PNG`, `IMG_5253`–`IMG_5265.PNG`.
- Figma (`.fig`): `Dashboard UI`, `Dashboard Flaws 2`, `Sidebar Tutorial`, `Software Sections`, `Every UI Concept-1`, `4 levels`, `Mobile App UI`, `Micro-Animations`, `Micro Dashboard`.

> If the pixels need to be versioned for a specific build, add a **curated subset** via **Git LFS** (not a raw 52 MB commit) — owner's call. The extracted principles above + the design-language skill are the durable record regardless.
