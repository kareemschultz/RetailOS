# ADR 0002 — No product feature code before Phase-0 lock-in

- **Status:** Accepted
- **Date:** 2026-06-21
- **Charter refs:** §0, §1, §32, §46, §47

## Context

The charter is explicit: the first run produces an architecture review + planning artifacts + Vertical Slice #1 _design_, not code (§0/§1), and no product modules may be implemented until the repository foundation matches the charter (§47) and the Phase-0 lock-in checklist passes (§46). The repo is currently a minimal scaffold (auth schema only; no tenant model, RBAC, audit, RLS, CI, or tests).

## Decision

**No POS, inventory, ecommerce, accounting, CRM, or other feature/module code is written until Phase-0 lock-in is complete.** Phase-0 lock-in = charter + governance docs committed; ADRs + module specs present; CI + vitest + playwright configs present; `bun run check-types`, `bun run check`, and `bun run test` pass; CI green; Docker build verified (§46). Vertical Slice #1 is the first feature work, implemented only after this architecture review is approved (§32).

## Consequences

- Positive: prevents building features on an unsound foundation (no tenant/RBAC/audit/RLS), which §3/§33 would force to be rebuilt; makes the foundation auditable via `phase-0-checklist.md`.
- Negative: slower path to a visible feature; deliberate.
- Follow-up: Phase 1 (identity/tenant/RBAC/audit) and the Vertical Slice #1 design (`vertical-slice-1.md`) gate the first implementation run.

## Alternatives considered

- Build Vertical Slice #1 immediately — rejected; violates §1/§32/§47 and risks tenancy/audit retrofits.
