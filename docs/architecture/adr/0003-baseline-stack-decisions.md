# ADR 0003 — Baseline stack & architectural seams

- **Status:** Accepted
- **Date:** 2026-06-21
- **Charter refs:** §4, §8, §9, §14, §17, §18, §19, §23, §24, §27, §33

## Context

The charter locks several foundational technology and seam decisions. They are recorded here as one baseline ADR (uncontested, charter-derived). If any is later revisited, split it into its own superseding ADR.

## Decisions

1. **ORM: Drizzle, not Prisma** (§33). Strict TypeScript + Zod validation throughout.
2. **Backend: Hono + oRPC + Better Auth + PostgreSQL** (§4) — the verified scaffold; oRPC procedures (`publicProcedure`/`protectedProcedure`) are the API surface.
3. **Tenant isolation is deployment-mode-specific** (§8/§9): shared schema + `tenant_id` + PostgreSQL RLS for multi-tenant SaaS; database-per-tenant for dedicated/managed-private; customer DB for self-hosted. Migration fan-out via expand/contract (add → backfill → switch → verify → drop later).
4. **Money = integer minor units** (§19/§33): store amount + currency code + minor-unit scale together; never floats; one rounding policy; no assumption of 2 decimals.
5. **Offline conflict policy is a per-tenant/location seam** (§14): oversell-with-backorder | hard Edge-Hub reservation | optimistic-deduction-with-compensation. The stock **ledger** is the source of truth; append-only events replay by idempotency key; mutable shared state never blind last-write-wins.
6. **Event Outbox pattern** (§24): major business actions emit versioned, tenant-scoped, idempotent, correlation-aware domain events via an outbox; future modules subscribe rather than couple directly.
7. **Webhook dispatch behind a self-hostable interface** (§23): reserve a seam for a standardized dispatcher (Svix or OSS equivalent) for signing/backoff/DLQ/replay; must work in self-hosted/data-sovereign deployments — no managed-only dependency.
8. **Pluggable provider seams** (§17/§18): fiscalization/e-invoicing, tax, payments, and OCR/LLM document parsing are all provider interfaces (tenant-scoped, human-review-before-post for OCR), so country/vendor specifics never leak into domain code. No country's fiscal rules hardcoded.
9. **Search behind an interface** (§27): PostgreSQL FTS first; swap to Typesense/Meilisearch/OpenSearch past catalog thresholds without touching callers; always tenant-scoped.

## Consequences

- Positive: deployment-agnostic, audit/ledger-correct, vendor-swappable foundation matching §3/§9/§50.
- Negative: more upfront interface design; justified by the multi-deployment + compliance requirements.
- Follow-up: each seam gets a module spec + tests as its phase is reached; RLS strategy detailed in `tenancy-deployment.md`.

## Alternatives considered

- Prisma, last-write-wins sync, hand-rolled webhooks, hardcoded fiscal rules, direct search-engine coupling — all rejected by the charter for correctness, portability, or compliance reasons.
