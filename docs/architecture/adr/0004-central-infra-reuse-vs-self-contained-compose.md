# ADR 0004 — Production reuses central VPS Postgres/Redis; base compose stays self-contained

- **Status:** Accepted
- **Date:** 2026-06-21
- **Charter refs:** §9, §28, §36, §47

## Context

RetailOS must run identically across deployment modes (§9): multi-tenant SaaS, dedicated cloud, managed private, and self-hosted. Endpoints (DB, Redis, object storage, backups) must be environment-configurable, never hardcoded (§9/§36).

The KareTech VPS that hosts *our* SaaS instance already runs a shared `postgres-central` (`postgres:18-alpine`) and `redis-shared` on an external `pangolin` Docker network, reachable by container name. Standing up per-app Postgres/Redis containers there would waste VPS resources and collide on host port 5432 (already bound). At the same time, contributor laptops, dedicated-cloud tenants, and self-hosted customers have **no** such shared infrastructure and need a turnkey, batteries-included compose file.

These two needs pull in opposite directions: reuse shared infra *here*, but ship something self-contained *everywhere else*.

## Decision

Adopt a **hybrid two-file compose model**, with all endpoints env-driven:

1. **`docker-compose.yml` (committed, portable)** stays **self-contained**: it defines its own `postgres`, `redis`, and `minio` services with persistent named volumes. This is what contributors, dedicated-cloud, managed-private, and self-hosted deployments use — `docker compose up` just works with no external prerequisites.
2. **`docker-compose.prod.yml` (our VPS override)** **reuses central shared infra**: it joins the external `pangolin` network and points the app at `postgres-central` / `redis-shared` by container name, pulls secrets from self-hosted Infisical (`/credentials/retailos`), and runs MinIO locally (no central object store). Redis is namespaced to a logical DB + `retailos:` key prefix to avoid cross-app collision.

No business logic branches on deployment mode; only environment configuration differs (§9/§36).

## Consequences

- **Positive:** saves VPS RAM/CPU and avoids the host-port-5432 conflict for our instance; keeps the portable path frictionless for every other tier; matches the §9 "endpoints are environment-configurable" mandate; isolates VPS-specific wiring in an override file rather than polluting the base.
- **Negative / trade-offs:** two compose files to keep in sync; the prod path has an implicit dependency on the `pangolin` network + central services existing (documented in `lessons-learned.md`); a shared central Postgres is a noisy-neighbour / blast-radius consideration mitigated by a least-privilege per-app role (`rolsuper=f, rolcreatedb=f`) and a dedicated `retailos` database.
- **Follow-ups:** Edge Hub and backup/DR targets follow the same env-driven rule (§15/§28); container-image hardening + size limits tracked under §28 (see the multi-stage `apps/web/Dockerfile`).

## Alternatives considered

- **Per-app Postgres/Redis on the VPS too (single compose file):** rejected — wastes resources, conflicts on port 5432, and duplicates infra the VPS already runs.
- **Central shared infra as the only model (drop self-contained services):** rejected — breaks contributor laptops, dedicated-cloud, and self-hosted tiers that have no shared infra; violates the deployment-agnostic principle (§3/§9).
- **One compose file with profiles toggling external vs local infra:** considered; rejected for now as harder to reason about than an explicit prod override, but a reasonable future consolidation.
