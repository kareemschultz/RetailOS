# RetailOS Vertical Presets (platform, not product)

- **Status:** GOVERNANCE — the **configuration strategy** for serving many business types from one codebase. **Docs-only; NOT built.** The onboarding wizard that applies these presets is **Phase 11** (SaaS / licensing / feature flags); this doc locks the philosophy and the preset list now so nothing is forked by business type before then.
- **Companion to:** the platform-first principle in `engineering-principles.md` (graduated into the constitution via the open process-freeze PR), the charter's per-tenant configuration (§8/§10/§11), and the settings resolver.

---

## The philosophy: ship Core, then configure

RetailOS is a **configurable retail/business platform**, not a POS for one store type. We ship **RetailOS Core**, then an **onboarding wizard configures it** for a given business. A pilot customer determines **configuration defaults**, never architecture.

> **Default to the broadest common denominator. Specialize through configuration, onboarding presets, feature flags, RBAC, templates, and vertical packs — never through architecture forks** (unless a difference is legally or technically required).

There is **no `RestaurantEdition`, no `PharmacyEdition`, no per-vertical fork.** A pharmacy and a hardware store run the **same binaries**; they differ only in **resolved configuration** (Odoo-style Core + Modules, not divergent code paths). When two paths are possible — a specific-customer build vs a general-with-config build — **default to general-with-config**.

## A preset only changes configuration

Each preset is a bundle of **defaults across these dimensions** — nothing more:

- **Enabled modules** (which products are switched on)
- **Workflow defaults** (e.g. order flow, approval thresholds)
- **Feature flags** (per charter §10)
- **Required fields** (what onboarding/forms demand)
- **Shift policies** (enforcement required / optional / disabled)
- **Cash-drawer policies** (on / off; blind close on / off)
- **Inventory policies** (costing method, expiry/FEFO, oversell)
- **Tax defaults** (jurisdiction, inclusive/exclusive)
- **Receipt behavior** (template, fiscal fields)
- **Dashboard widgets** (which KPIs surface by default)
- **Menu visibility** (which nav entries show for the role)

All resolved through the **settings resolver / feature flags / RBAC** (location → tenant → platform) — exactly the configurable mechanism already used for cash control (shift enforcement, blind close, cash drawer).

## The presets

| Preset | Key config emphasis |
|---|---|
| **General Retail** (supermarket, minimart, electronics, boutique, hardware) | The broadest default: POS + inventory + basic accounting; AVCO costing; shift optional, blind close + cash drawer on; standard receipt |
| **Pharmacy** | Batch/expiry + **FEFO** required; expiry alerts; serialized/controlled items; stricter audit on adjustments |
| **Wholesale & Distribution** | Multi-UoM (cartons/eaches) + tiered/customer-group pricing; credit limits + AR emphasis; bonded/landed-cost on |
| **Restaurant & Hospitality** | Fast order flow; modifiers; table/tab semantics via config; minimal receipt; tips behavior (later) |
| **Service Business** | Service orders / tickets emphasis; inventory light; labor + parts; appointment/calendar surfaces |
| **Custom** | Start from General Retail; the onboarding wizard exposes every dimension for manual tuning |

> Restaurant- and pharmacy-specific tables/workflows are **NOT** built as forks — where a vertical genuinely needs a new capability it lands as an **optional module / vertical pack** switched on by the preset, sharing the same domain model and primitives.

## The invariant

**The architecture stays identical across every preset.** Verticals are achieved by configuration (settings resolver), feature flags, RBAC, onboarding presets, and optional modules — never by divergent code paths. This is what lets RetailOS grow across many industries on a **single coherent codebase** with a **consistent user experience**.

## Cross-references

| Concern | Authoritative source |
|---|---|
| Platform-first principle (the constitution) | `engineering-principles.md` (Group F) |
| Charter tenant/config/feature-flags/white-label | `retailos-master-charter.md` §8 / §10 / §11 |
| Configuration over customization (design principle) | `.agents/skills/retailos-design-language/SKILL.md` (Core design principles) |
| Frontend sourcing law | `frontend-strategy.md` |
