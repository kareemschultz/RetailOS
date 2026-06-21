# Shadcnblocks.com — Evaluated, NOT Configured (viable; overlaps studio Pro)

> **Status: evaluated and live-verified, but not added to RetailOS** (decision 2026-06-21). It works and is
> trivial to wire up, but it overlaps the 735 shadcn studio Pro blocks already configured and needs a separate
> paid license + API key. Add only if a specific section type the studio/Magic UI/ReUI set doesn't cover appears.

## What it is

**Shadcnblocks** is a commercial premium **block / section / page** library for the shadcn/ui ecosystem
(copy-paste, production-ready marketing & app sections, full pages, templates). Same conceptual category as
**shadcn studio Pro** — static, prop-driven sections — **not** a new capability class like Magic UI (animation)
or ReUI (data/app components). Stack: React + Tailwind + shadcn/ui (Radix), lucide; Next.js & Astro support;
the verified free sample had **no Framer Motion**. Compatible with this repo (`rsc: false`, lucide, `base-lyra`).

- **Pricing (marketing copy, not independently verified):** one-time lifetime — Pro $149 / Premium $299 /
  Elite $399; a **free tier** (login-only basic blocks) exists.
- **Maintained:** appears active (live JSON registry, MCP server, IDE extensions, changelog v1.1) — not
  independently confirmable beyond a healthy live endpoint.

## Registry — VERIFIED LIVE (2026-06-21)

| Field | Value |
|---|---|
| Namespace | `@shadcnblocks` |
| URL template | `https://shadcnblocks.com/r/{name}` (308 → `www.`; returns `application/json` registry-item) |
| Auth | **Bearer header** `Authorization: Bearer ${SHADCNBLOCKS_API_KEY}` (key from `shadcnblocks.com/dashboard/api`) — header-only, **no** email/license_key query params |
| Free blocks | resolve **without** auth (`hero1` → 200 JSON, verified via `shadcn view`) |
| Pro blocks | HTTP **401** without a key |
| Install | `npx shadcn@latest add @shadcnblocks/<name> -c packages/ui` |

⚠️ **Slug gotcha (verified):** real slugs are **non-hyphenated** — `hero1` ✅, `hero-1` ❌ 404; `hero125` ✅ (401 auth), `hero-125` ❌ 404. The docs' hyphenated examples are misleading.

### To configure later (do NOT add until licensed + needed)

```jsonc
// in BOTH root components.json and packages/ui/components.json → registries
"@shadcnblocks": {
  "url": "https://shadcnblocks.com/r/{name}",
  "headers": { "Authorization": "Bearer ${SHADCNBLOCKS_API_KEY}" }
}
```
Then add `SHADCNBLOCKS_API_KEY` to `.env` (gitignored) from the dashboard.

## Counts — advertised vs enumerable (§40 honesty)

- **Advertised (marketing copy only):** ~**1,665 blocks / 100+ categories**, 1,684 components, 16 templates,
  49 pages (e.g. Hero 247, Feature 311, Pricing 96, Data Table 32).
- **Enumerable:** **NOT confirmed.** There is no public registry index/listing endpoint — items resolve by
  direct slug only. The ~1,665 figure is **advertised, not enumerated**; treat as unverified.
- **Live-verified:** registry endpoint health, auth behavior (free 200 / Pro 401), slug format, and one CLI
  resolution (`hero1`). Nothing else was enumerated.

## Recommendation

**Skip for now.** Heavy functional overlap with the configured shadcn studio Pro (735 blocks, fully verified)
and the marketing sections in Magic UI Pro; it adds breadth, not a missing capability, and costs a separate
license + key. Revisit only on a concrete gap — then add the `@shadcnblocks` entry above, remember
non-hyphenated slugs, and record it in `lessons-learned.md`.
