# RetailOS Engineering Principles (the constitution)

- **Status:** GOVERNANCE — the durable engineering principles every contributor (human or agent) follows. These are not new rules; they are the **recurring lessons of this project graduated into law** (charter §40: structural lessons graduate into durable governance) so nobody has to rediscover them. Read with the charter, `CLAUDE.md`/`AGENTS.md`, and `lessons-learned.md`.
- **How to use:** when a principle and a convenience conflict, the principle wins. When in doubt, the source of each principle is a real, costly lesson — see `lessons-learned.md`.

---

## A. Truth & ownership

1. **Backend owns truth; frontend owns presentation.** The server computes, validates, and persists; the UI renders and collects input. The authoritative state lives in PostgreSQL under RLS, fed by the domain model and events.
2. **Every invariant has exactly one owner.** A rule (balance, tenant-scoping, costing, posting) is enforced in one place — a service, a DB constraint/trigger, or a checkable test — never re-implemented in three. *(Source: the source-of-truth lessons — `posting-model.md`, the settings-resolver collapse.)*
3. **Never duplicate business logic.** Two copies drift; one becomes wrong silently. Share the primitive, not the policy. When the same class of gap recurs across reviews, the artifact is missing an upstream **spec** — write the spec once, then validate against it (the reason `posting-model.md` exists).
4. **Share primitives, not policy-bearing services.** "DRY" across paths with *different* invariants is a footgun — a single flagged super-service lets a write path route around an invariant (the "unify can restate #8" lesson). Extract the low-level primitive; keep separate wrappers with their own invariants.

## B. Write-path & data integrity

5. **Every write path goes through the owning service.** The defining defect class of this project (#8): a *correct, tested* component exists, but a primary write path doesn't call it, so the guarantee silently doesn't hold. For every invariant/guarantee, grep that the **production write path actually invokes** the enforcing component — a green service suite is not evidence the path uses the service.
6. **Every financial amount uses the Money primitives.** Integer minor units + currency + scale, always travelling together; never floats. All division (tax, discount, FX, commission, allocation) routes through `mulDivRound(a,b,c,mode)` with the policy-resolved mode. No money math outside this seam.
7. **No UI performs business calculations.** Totals, tax, COGS, commission, FX, valuation are computed server-side and sent to the UI as results. The client never re-derives a financial figure.
8. **Stamp the irreproducible fact on the immutable record at transaction time.** A value that cannot be reconstructed later — server time (`occurredAt`), the resolved costing method (`costing_method_applied`), the FX rate (`fxRateToFunctional`), the commission accrual — is captured once, server-authoritative, on the event/movement, and **never re-resolved**. This is the single most repeated structural fix in the project (4+ instances).
9. **Every new tenant-owned table gets fail-closed RLS in the same commit.** The `tenant-isolation-coverage` test mechanically blocks any uncovered tenant table. Cross-tenant FK references get composite `(tenant_id, id)` FKs — FK existence checks bypass RLS, so validate the tuple, not each id (the H1 class).
10. **Extensible value sets use `text({ enum })` + CHECK/Zod, never native `pgEnum`** (`ALTER TYPE … ADD VALUE` is non-transactional and can't reorder/remove). Migrations are **expand/contract** — add, backfill, switch, drop later; never destructive in the release that starts using the new shape.

## C. Sourcing & ownership of third-party work

11. **Imported components become owned code.** Every block from any registry/MCP is committed source we maintain in `packages/ui`, re-themed to RetailOS tokens, wired to oRPC — never an opaque runtime dependency.
12. **Never fork third-party projects.** We mine source material (shadcn Studio, AdminCN, Magic UI) and adapt; we do not carry a foreign app shell, data layer, auth, or routing. (See `frontend-strategy.md` for the sourcing pyramid + the import→normalize→adapt→extend rule.)

## D. Verification discipline

13. **Verify external facts against official docs + a live probe.** Never assert a registry's contents, a tool's behavior, or a version default from memory, marketing copy, or guessed slugs. A style-parameterised registry serves *your* configured style, which can differ from the vendor showcase (the AdminCN/Base-UI correction). State only enumerated counts.
14. **Track gate findings by KIND, not count.** A falling count of the *same* kind = converging. A finding of a *new structural kind* = the artifact is being **discovered, not designed** — stop point-fixing, impose a checkable invariant the gap is an instance of, and **re-derive** the whole artifact under it. Decide the response to each outcome *before* running the gate.
15. **A gate that never ran is not a passing gate.** Read the actual CI logs (look for "N passed", not a green checkmark); confirm env-gated suites actually executed (turbo `env`, not `passThroughEnv`, for behavior-deciding vars). A docs claim ("decision documented", "guarantee held") is not true until the write path is grepped and a test proves it.
16. **A fix pass needs its own gate.** Folding review findings is itself a change that can introduce new asymmetries — re-review until clean before proceeding.

## E. Process (every phase / commit finishes with)

### The RetailOS Development Loop (🔒 FROZEN — proven repeatedly; do not deviate)

This is the methodology, frozen by owner directive (2026-06-24) after it caught a disguised #8 valuation defect that 83 green tests missed, and again separated two real invariant bugs from a feature-boundary decision in Commit 3. **Freeze the process, not the code.** Every implementation slice runs all twelve steps, in order:

```
1.  Locked design decision        → don't build on an open business rule (defer it to the owner)
2.  Small implementation commit    → one bounded, reviewable slice
3.  Local gates                    → check-types · lint · mojibake
4.  Real Postgres verification     → migrate as retailos_migrator, test as retailos_app; "N passed", zero skips
5.  Independent Codex review       → fresh codex:codex-rescue (never a fork); adversarial, by-kind not by-count
6.  Fix CRITICAL/HIGH only         → fold invariant bugs; surface business-rule boundaries to the owner, never guess
7.  Re-run verification            → real Postgres again; frozen layers stay byte-identical
8.  Codex confirm gate             → a fix pass needs its OWN gate (the fold can introduce new defects)
9.  Open PR                        → with the summary sections below
10. Human review                   → owner; never merge without approval
11. Merge                          → then sync master
12. Update PROGRESS + lessons      → in-repo state never drifts from code
```

**Every implementation PR summary carries three sections** (presentational — reinforces user value + the architecture; skip for pure-docs PRs):
- **Customer-visible capability delivered** — demo flow + business value per role (cashier / manager / accountant).
- **Frontend surfaces unlocked** — the UI screens this backend now makes buildable.
- **Backend services reused** — the existing primitives this slice built on (e.g. `applyValuation`, `appendStockMovement`, Money, idempotency, audit, outbox, number-block) — proving we compose, not duplicate.

17. The loop above is non-negotiable. Its load-bearing rules restated: adversarial review (fresh `codex:codex-rescue`, never a fork) on contracts *before* building the producer AND on code per commit; the write-path-invokes-service gate; **CI green verified from logs, not the checkmark**; **never push to master directly, never merge without owner approval**; `lessons-learned.md` + `PROGRESS.md` updated in the **same commit** as the change.
18. **No architecture change without an ADR.** Surface a decision only after confirming it isn't already settled by the charter/an ADR/a locked prior decision (don't waste the owner's time on falsely-open decisions).
19. **One writer per working tree.** Only one agent writes at a time. A coordinator may **inspect, review, and analyze read-only** while an implementation agent runs, but must not modify the same working tree until the implementation agent has **fully stopped and ownership has been explicitly handed over.** Never rely on concurrent writers producing identical edits; before any takeover, verify the prior agent has *completely* stopped. *(Source: a coordinator/build-fork race that committed concurrent edits — they happened to match, which is luck, not a guarantee.)*
20. **Action Availability Rule: the backend decides available actions, the frontend renders them, the backend always enforces them.** A surface asks the backend which actions are valid for the current state/role/entitlement; the UI renders exactly those; every action is **independently re-authorized server-side** when invoked. **UI visibility is never security** — hiding a button is presentation, not enforcement (the ownership model of principle 1 + the write-path gate of principle 5, applied to authorization). *(Governs the upcoming sale-detail `availableActions` read.)*

---

## F. Mental model: think in PRODUCTS, not phases

The roadmap stays phased for sequencing, but the **mental model is products**. Each product accretes its layers over time:

> **Product → Backend → Events → Contracts → (eventually) UI**

Products: **POS · Inventory · Accounting · CRM · Procurement · Warehouse · Payroll/HR · Reports · Ecommerce · Platform/MSP.**

Why it matters: a phase is a *time slice*; a product is a *durable thing with an owner, invariants, events, and a surface*. Thinking in products makes the event contracts, the posting model, and (later) the UI compose naturally — each product's events feed the GL and analytics, and each product's UI is assembled from its own blocks. When UI work begins, you build **layers, not pages** (see `frontend-strategy.md`): Application Shell → Module Shell → Reusable Workflows → Blocks → Screens — so reuse is maximized and a screen is the thin top, not the unit of work.

**Ship the smallest valuable thing (owner directive 2026-06-24).** The next slice is not chosen by asking *"what's next in the roadmap?"* but *"what is the smallest valuable thing we can ship?"* — and, once a pilot deployment exists, **let the first real customer drive the slice order, not the original phase sequence.** This is exactly what re-sequenced Phase 4 (Minimum Sellable POS → Returns/Refunds/Voids before shift/cash) and deferred the Exchange Settlement Engine. The architecture is strong enough that **customer value, not planning order, drives implementation** — the roadmap is a default, not a mandate; a customer need re-sequences it.

### 🔒 Platform first: default to the broadest common denominator (owner directive 2026-06-24)

RetailOS is a **configurable retail/business platform** — for supermarkets, mini-marts, pharmacies, hardware, electronics, boutiques, wholesalers/distributors, restaurants/hospitality, service businesses, and future vertical packs — **not a POS for one store type.** A pilot customer determines **configuration defaults**, never the architecture. The load-bearing rule:

> **Default to the broadest common denominator. Specialize through configuration, onboarding presets, feature flags, RBAC, templates, and vertical packs — NEVER through architecture forks** (unless legally or technically required).

- **The two-paths rule:** if one path solves a *specific customer's* workflow and another solves the *general* workflow with configuration, **default to the general one** unless the specific is legally/technically required. RetailOS is a **platform first, implementation second**.
- **We already have the machinery to do this without forking:** the **settings resolver** (per-tenant/company/location/role), **RBAC/entitlements**, **feature flags**, and **tenant/company/location config**. Behavior is chosen by *configuration*, resolved at the appropriate scope — not by a business-type branch in the code or a separate edition.
- **No `RestaurantEdition` / `PharmacyEdition` forks.** Like Odoo: **Core + Modules**, never per-vertical editions. Vertical packs (pharmacy FEFO, hospitality tables/checks, liquor, automotive, agriculture) are **configuration + optional modules layered on the generic spine**, added when their customer arrives — never a fork of the core.
- **Build the spine with config seams.** Every cash-control / workflow feature ships with toggles (e.g. shift enforcement required/optional/disabled, blind-close on/off, cash-drawer on/off, X/Z on/off, oversell policy, returns policy, fiscal mode, offline mode) resolved through the settings resolver, so a single-store owner-operator can simplify/disable what a multi-register chain enables — same code, different config.

---

## G. Cross-references

| Concern | Authoritative source |
|---|---|
| Governing charter | `retailos-master-charter.md` |
| Verified mistakes → never repeat | `lessons-learned.md` |
| Posting model (GL journal spec) | `posting-model.md` |
| Frontend sourcing & adaptation law | `frontend-strategy.md` |
| Design law | `.agents/skills/retailos-design-language/SKILL.md` |
| Decisions | `adr/` · module specs `module-specs/` |
| Live state / changelog | `PROGRESS.md` |
