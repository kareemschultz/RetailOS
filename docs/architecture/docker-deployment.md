# RetailOS — Docker & Deployment Reference

> Charter refs: §9 (deployment modes / residency), §28 (Docker optimization, multi-stage,
> distroless/alpine, image-size limits, container scanning, CI), §29 (zero-trust edge),
> §36 (env matrix). Companion to `quality-security-ops.md` (strategy prose) and ADR-0004
> (central-infra reuse). This doc is the **concrete, verified** image/build reference.
>
> Patterns here were harvested from the same-stack **heimdallone** project
> (`docs/architecture/07-docker-and-cicd.md`, its `docker/*.Dockerfile`, `docker-compose*.yml`,
> and `.github/workflows/docker.yml`) — a production-hardened Better-T-Stack (Bun + Hono +
> TanStack + Turborepo) pipeline. Adapted to RetailOS, whose `web` is **SSR (TanStack Start /
> Nitro)**, not a static SPA, so it uses a Bun runtime image rather than nginx.

## 1. Current state (verified 2026-06-21)

| Image | Dockerfile | Base (runtime) | Size | Status |
|---|---|---|---|---|
| `apps/web` (SSR) | `apps/web/Dockerfile` | `oven/bun:1.3.12-distroless`, non-root | **168 MB** (was 2.38 GB single-stage) | ✅ builds + boots + listens |

The web image is multi-stage: **pruner** (`turbo prune web --docker`) → **builder** (BuildKit-cached `bun install`, then `turbo run build`) → **runtime** (distroless Bun, ships only Nitro's self-contained `.output/`). No source, no dev deps, no toolchain in the final image.

Other compose services use upstream images (not ours, not optimized here): `postgres:18-alpine`, `redis:7-alpine`, `minio/minio`.

## 2. Adopted patterns (in the repo now)

- **Multi-stage with Turborepo prune.** `bunx turbo prune <app> --docker` emits `out/json` (only needed package.json files), `out/full` (only needed source), and a pruned `bun.lock` — so the install layer carries one app's deps, not the whole monorepo.
- **BuildKit cache mount** for Bun's install cache: `RUN --mount=type=cache,target=/root/.bun/install/cache bun install`. Dependency layer is separate from the source layer, so code edits don't bust the install cache.
- **`--ignore-scripts`** on install (skips dev-only postinstall hooks — husky, fumadocs-mdx — that need the full repo + `.git/`, absent in the pruned context).
- **`--frozen-lockfile` intentionally omitted** in the pruned build: `turbo prune` emits a lockfile *subset* whose resolution can differ slightly and trip the check; the committed root `bun.lock` remains the reproducibility source of truth.
- **Distroless runtime, non-root** (`USER nonroot:nonroot`): no shell, no package manager → smallest attack surface (§28/§29).
- **Runtime must match build runtime.** The build runs under Bun, so Nitro/srvx bundles the **Bun** server adapter (`Bun.serve`); a Node runtime throws `ReferenceError: Bun is not defined`. RetailOS web therefore runs on distroless **Bun**, not distroless Node. (See lessons-learned.)
- **Rigorous `.dockerignore`** — excludes `node_modules`, `.git`, `.github`, `.claude`, `.agents`, `docs`, build outputs, test artifacts, and all `.env*` except `.env.example`. The pruner still does `COPY . .`, so a tight context matters.
- **Secrets never in image layers** — runtime env via compose `env_file`; only build-time *public* values via build args (§25/§36).

## 3. Image-size targets (charter §28 — CI should enforce)

Adapted from heimdallone's targets; RetailOS web is SSR so its target is higher than a static SPA:

| App | Base | Target (uncompressed) |
|---|---|---|
| `apps/web` (TanStack Start SSR) | `oven/bun:1.x-distroless` | ≤ 250 MB (currently 168 MB ✅) |
| future `apps/server` (Hono API) | `oven/bun:1.x-distroless` | ≤ 120 MB |
| future static admin/storefront (if split to SPA) | `nginx:1.27-alpine` | ≤ 30 MB |

**Size-audit ritual** (per release): `docker images --format "{{.Repository}}:{{.Tag}}\t{{.Size}}"`; if an app exceeds target, open a tracking issue. Common culprits: a dev dep leaked into the production install, `@types/*` in runtime deps, or a library pulling heavy optional deps.

## 4. Backlog — adopt in the deployment/CI-CD phase (Phase 11/13)

Not built now (Phase 0 is foundation-only); reserved with the right shape:

- **GHA BuildKit layer cache**: `cache-from: type=gha,scope=<app>` + `cache-to: type=gha,mode=max,scope=<app>` per app, via `docker/build-push-action`. Persists layers across CI runs.
- **A CI image-build gate** (§28): build the web image on PRs (`load: true`, amd64-only, no push) so a broken Dockerfile fails before merge; build+push on master/tags.
- **Multi-arch** (`linux/amd64,linux/arm64`) for releases (on-prem sites may be arm64).
- **Supply-chain**: keyless **cosign** signing via GitHub OIDC + **SLSA provenance** (`mode=max`) + **SBOM**; **Trivy** container scan before push (§28).
- **Pin base images by digest** (not just tag); refresh pins quarterly for security patches.
- **HEALTHCHECK** on every container (distroless has no shell — use a Bun one-liner healthcheck script, as heimdallone does for its Bun apps), with a longer `start_period` for first-boot migrations.
- **Resource limits** in the prod compose (`deploy.resources.limits`) and JSON log rotation (`max-size`, `max-file`).
- **Zero-trust edge** (§29): Edge Hub ↔ cloud over mTLS / WireGuard / Cloudflare Tunnel with cert rotation.
- **On-prem / air-gap**: ship tagged images from GHCR (public read) + `docker-compose.yml` + `.env.example` + init script; `docker save` tarballs for air-gapped government tenants (§9).
- **Post-MVP**: Bun `--compile` single-binary images (shaves a further ~40–60 MB).

## 5. Deployment modes (see ADR-0004 + §9)

- **Portable `docker-compose.yml`** (committed): self-contained postgres + redis + minio + web — turnkey for contributors, dedicated-cloud, managed-private, self-hosted.
- **`docker-compose.prod.yml`** (our VPS): reuses central `postgres-central` / `redis-shared` over the external `pangolin` network, secrets from self-hosted Infisical, MinIO local. No business logic differs — only env configuration.

> Re-verify base-image tags and the 168 MB figure when the toolchain (Bun, Nitro, TanStack
> Start) moves; append a `lessons-learned.md` entry on any contradiction (§40).
