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

17. The standing loop, non-negotiable:
    - **Adversarial review** (fresh `codex:codex-rescue`, never a fork) for CRITICAL/HIGH — on contracts *before* building the producer, and on code per commit.
    - **Tests** (incl. real-Postgres RLS where relevant) + the write-path-invokes-service gate.
    - **CI green** — verified from logs, not the checkmark.
    - **PR to master** — never push to master directly; **never merge without owner approval**; small, reviewable commits.
    - **`lessons-learned.md` + `PROGRESS.md` updated in the same commit** as the change, so docs/state/code never drift.
18. **No architecture change without an ADR.** Surface a decision only after confirming it isn't already settled by the charter/an ADR/a locked prior decision (don't waste the owner's time on falsely-open decisions).

---

## F. Mental model: think in PRODUCTS, not phases

The roadmap stays phased for sequencing, but the **mental model is products**. Each product accretes its layers over time:

> **Product → Backend → Events → Contracts → (eventually) UI**

Products: **POS · Inventory · Accounting · CRM · Procurement · Warehouse · Payroll/HR · Reports · Ecommerce · Platform/MSP.**

Why it matters: a phase is a *time slice*; a product is a *durable thing with an owner, invariants, events, and a surface*. Thinking in products makes the event contracts, the posting model, and (later) the UI compose naturally — each product's events feed the GL and analytics, and each product's UI is assembled from its own blocks. When UI work begins, you build **layers, not pages** (see `frontend-strategy.md`): Application Shell → Module Shell → Reusable Workflows → Blocks → Screens — so reuse is maximized and a screen is the thin top, not the unit of work.

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
