# RetailOS Product & Platform Roadmap (future directions)

> **Status:** GOVERNANCE — *recording only*. This document captures **future** product/platform directions that are
> now clearly understood, so they are not re-derived later and do not leak into today's implementation. **Nothing here
> is built, designed, or planned for the current thread.** Each item states its kind (capability / design-first /
> planning / direction) and an explicit *do-not-implement* boundary.
>
> Read with `engineering-principles.md` (the constitution), `phase-roadmap.md` (phase sequencing), and the charter
> (§10 licensing/feature-flags, §11 white-label, §9 deployment modes). **After this document merges, governance
> freezes again** — no further roadmap/constitution/principles docs unless implementation uncovers a *genuinely new
> architectural category* (the "track findings by KIND" discipline).

---

## The layering (why these items are distinct)

These five items are frequently conflated. They are different layers, and the distinction is load-bearing:

```
Engineering dependency graph   ← which modules technically require which (architecture)
        ↓
Valid module bundles           ← which combinations actually function (architecture)
        ↓
Commercial Product Packages    ← named, priced offerings (commercial)
        ↓
Licensing / feature flags      ← enforcement of what a tenant bought (commercial → enforced server-side)
        ↓
Industry presets               ← named, validated configurations per vertical (configuration)

Deployment Profiles            ← how/where an instance runs (operational) — ORTHOGONAL to all of the above
White Label & Branding         ← per-tenant aesthetics (capability) — independent of all of the above
Marketplace / Extensions       ← third-party + first-party integrations (long-term platform direction)
```

A theme does not affect what a sale does. A deployment profile is not a license tier. A product package is a
commercial bundling of *architecturally valid* module combinations — so the dependency graph must be designed
**before** the bundles, the bundles **before** the packages, and the presets are a **consequence**, not an input.

---

## 1. Future Capability — RetailOS White Label & Branding

**Kind:** future *capability* (build normally, the standard way, AFTER core POS/inventory screens stabilize).
**Status:** **GREENFIELD — no implementation currently exists** (see §6 recon).

Per-tenant white-label so each tenant matches their own aesthetic. To capture:

- `tenant_ui_config` (future — the per-tenant config record)
- tenant branding
- logo
- favicon
- company colours
- typography
- receipt branding
- invoice branding
- email branding
- login branding
- runtime CSS-variable token application (components are already token-based — this is the free, theming-ready half)
- shadcn Studio **Theme Generator** / documentation as the implementation reference
- **WCAG AA** compliance (contrast enforced before a tenant theme can be saved; branding must never break usability/accessibility)

**Boundary:** do NOT implement. Sequenced after the core screens are settled (theme stable surfaces, not moving
ones). When built, it is a frontend capability + one small backend read that returns the tenant's config; the
frontend applies tokens at runtime instead of the hardcoded RetailOS tokens. Its own capability, never braided.

---

## 2. Future Design Phase — Module Entitlements

**Kind:** ⚠️ **DESIGN-FIRST** — NOT a build item, NOT a UI toggle. The output is a **design document, adversarially
reviewed and owner-gated** (the way `event-map-phase4.md` and `posting-model.md` were), **not a PR.**
**Status:** **GREENFIELD — tenant module licensing does not exist** (see §6 recon).

The product goal: a tenant licenses a **subset** of modules. This is an **architecture decision, not a presentation
concern, because the backend modules INTEGRATE** — POS writes inventory movements; inventory feeds COGS; the GL
consumes POS/inventory events. So "a tenant with POS but no inventory" is not "which sidebar items render"; it is
*what a sale physically does when there is no inventory module to deduct from.* This is the project's recurring
defect class — **a guarantee that holds in isolation but the integration path routes around the missing module.**

The design must eventually define:

- **dependency graph** — which modules are standalone, which require which (can POS exist without inventory? what
  does a sale do with no inventory module? does COGS/GL even function?)
- **valid module bundles** — which combinations actually work as products + the minimum viable bundle (not every
  checkbox combination is coherent)
- **absent-module behaviour** — what each present module does at every boundary where it expects an absent one
- **server-side enforcement** — gated routes alongside RLS; the UI reflects entitlement but never enforces it
- **licensing**
- **feature flags**

**State clearly:**
- **RBAC already exists** (user role → action permission, e.g. `pos.create_sale`; enforced in services + routers).
- **Tenant module licensing does NOT exist.**
- **Components must remain token-based, never module-aware** — they must NOT start branching on "is module X
  enabled," which would pre-build entitlement as scattered client-side conditionals before the dependency graph is
  designed (the toggle-trap in miniature).

**Boundary:** do NOT build, design, or scaffold entitlements now. The design phase comes first, owner-gated.

---

## 3. Future Planning — Product Packages

**Kind:** future *product-planning* item (commercial). Depends on §2's design output.

**The distinction to preserve:**

> Engineering dependency graph → Valid bundles → **Commercial Product Packages** → Licensing → Industry presets

Examples (illustrative names only, not committed offerings):

- POS Starter
- Retail Pro
- Commerce
- ERP

**State clearly:** Product Packages are **commercial decisions, not architectural ones.** A package is a named,
priced selection of *architecturally valid* bundles (from §2). It cannot be designed before the dependency graph and
valid bundles exist — pricing a combination that doesn't function is the failure mode.

**Boundary:** recording only. No design, no implementation.

---

## 4. Future Platform Direction — Marketplace / Extensions

**Kind:** long-term *platform direction* — recorded only.

Examples of the integration surface a marketplace/extension model would eventually cover:

- Shopify
- WooCommerce
- QuickBooks
- Xero
- Stripe
- WhatsApp
- Fiscal devices
- Barcode hardware
- Biometric devices
- IoT integrations

**Boundary:** **No design. No implementation. No planning beyond recording the direction.** (Device/IoT integrations
in particular re-open the authenticated-device-identity / tenant-resolution-without-RLS-bypass / replay-idempotency
contract questions already fenced in PROGRESS — each is its own slice with its own contract when its time comes.)

---

## 5. Future Platform Direction — Deployment Profiles

**Kind:** future *platform capability* (operational). Orthogonal to product packages and module entitlements.

Deployment profiles are **operational deployment models** — how and where an instance runs:

- Single-store cloud
- Multi-store cloud
- Self-hosted
- MSP-managed
- Offline-first
- Enterprise HA

**State clearly:**
- Deployment profiles are **operational deployment models.**
- They are **NOT** product packages (commercial bundling).
- They are **NOT** module entitlements (licensed module set).

A tenant on any product package can run under any compatible deployment profile; the two axes are independent.
(Aligns with charter §9 deployment modes + data residency.) **Boundary:** recording only.

---

## 6. Recon Findings (verified read-only, 2026-06-27)

Both seams were audited across schema, migrations, API routers, and frontend consumption. **Both are greenfield —
unlike previous "merged-but-unwired" backend seams** (e.g. the number-lease allocator, which was merged but not yet
consumed by `createSale`). Here there is no merged infrastructure to wire at all.

**Branding (`tenant_ui_config`):**
- **no `tenant_ui_config`** table/column — the `organization` table carries `logo` + `metadata` (text) only; zero
  migration match
- **no runtime theme config** — no read/write endpoint
- **hardcoded CSS tokens** — all custom properties are fixed oklch values in `packages/ui/src/styles/globals.css`
- **dark/light only** — `theme-provider.tsx` is a thin `next-themes` wrapper that only toggles the `.dark` class
- exists ONLY as an *illustrative* shape in `platform-saas-integrations.md` + charter §11 / Phase 11

**Module entitlements:**
- **RBAC exists** — `entitlements.ts` maps user role → action permission (e.g. `pos.create_sale`), enforced in
  services + routers; `membership` carries `role` only
- **tenant licensing does not** — no entitlement/feature-flag/subscription table, no module-level gate in any
  router or component
- **feature flags deferred** — `entitlements.ts`'s own header states the full Entitlements Service (feature flags,
  license limits, approval rules) is deferred

**State clearly:** these are **greenfield capabilities**, unlike previous "merged-but-unwired" backend seams. There
is no hidden half-built mechanism to discover later — branding is a clean build (§1), entitlement has nothing to
route around yet, which is exactly why its dependency graph is designed on paper first (§2).

---

## 7. Engineering Principles (recorded in the constitution)

Two governing principles confirmed/added to `engineering-principles.md` as part of this docs pass:

- **One Writer Per Working Tree** — only one agent writes at a time; a coordinator may inspect read-only; explicit
  ownership handoff before edits.
- **Action Availability Rule** — the backend decides which actions are available, the frontend renders them, the
  backend always enforces them; **UI visibility is never security.** (This governs the upcoming sale-detail
  `availableActions` read.)

See `engineering-principles.md` for the authoritative wording.

---

## Governance freeze (after this document merges)

This completes the recording of currently-understood future directions. **Governance freezes again:** no additional
roadmap / constitution / principles documents unless implementation uncovers a *genuinely new architectural
category*. From here the project stays focused on delivering capabilities. The active implementation thread is
unchanged: review/merge PR #39 → build the sale-detail read with `availableActions` → build Frontend Capability 2
(Cashier Post-Sale Workflow).
