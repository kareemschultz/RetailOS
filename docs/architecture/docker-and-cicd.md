# RetailOS — Docker & CI/CD Optimization

> Charter refs: §9 (deployment modes / residency), §11 (white-label build args), §28 (Docker hardening,
> multi-stage, image-size limits, container scanning, CI/CD), §29 (security), §36 (env matrix).
> Patterns adapted from the same-stack **heimdallone** reference (`docs/architecture/07-docker-and-cicd.md`
> there), corrected for RetailOS's differences. This doc is the source of truth for our image strategy.

## Design goals

| Goal | Mechanism (what RetailOS does) |
|---|---|
| Smallest final image | Multi-stage build; **distroless** runtime; ship only the bundled app output; no dev deps, no source, no build toolchain in the final image |
| Fastest rebuild | BuildKit cache mounts for Bun's install cache; **dependency layer separate from source layer**; Turborepo `prune`; **GHA layer cache** (`type=gha`) across CI runs |
| Reproducible | Pin base images by version (Bun `1.3.12`, Postgres `18-alpine`, Redis `7-alpine`); root `bun.lock` committed as the reproducibility source of truth |
| Secure | distroless (no shell / package manager) + **non-root** (`nonroot:nonroot`); secrets only at runtime via env / Infisical, never baked into layers (§25/§29) |
| Env-driven | All endpoints (DB/Redis/S3) come from the environment; public build-time values (`VITE_SERVER_URL`) via build args (§9/§36) |

## Key difference from the heimdallone reference

heimdallone's `web` is a **static SPA → `nginx:alpine`**. RetailOS `apps/web` is **TanStack Start SSR**
(Nitro `node-server` preset → `.output/server/index.mjs`), so it maps to the **Bun-app / SSR runtime**
pattern, **not** the nginx-static pattern. Concretely: the build runs under Bun, so Nitro/srvx bundles the
**Bun** server adapter (`Bun.serve`) — the runtime image must therefore be **Bun**, not Node. A Node runtime
throws `ReferenceError: Bun is not defined`. (Verified empirically — see `lessons-learned.md`.)

## `apps/web` image (implemented)

Three stages in `apps/web/Dockerfile`:

1. **pruner** (`oven/bun:1.3.12-alpine`) — `bunx turbo prune web --docker` → minimal workspace
   (`out/json` package.jsons, `out/full` source, pruned `bun.lock`).
2. **builder** (`oven/bun:1.3.12-alpine`) — install the pruned dep set first (cacheable layer via
   `--mount=type=cache,target=/root/.bun/install/cache`), then copy source and `turbo run build --filter=web`.
   `--ignore-scripts` (skips husky/postinstall that need the full repo + `.git`); `--frozen-lockfile` is
   **intentionally omitted** because `turbo prune` emits a lockfile subset whose resolution can differ and
   trip the check (the committed root `bun.lock` remains the source of truth).
3. **runtime** (`oven/bun:1.3.12-distroless`, `USER nonroot:nonroot`) — copies **only** `apps/web/.output`.
   Nitro bundles runtime deps into `.output/server/_libs`, so no `node_modules`, source, or toolchain ships.

**Result:** fat single-stage baseline **2.38 GB → 168 MB** (~93% smaller). Verified: the container boots and
serves (`Listening on http://localhost:3001/`).

## `.dockerignore`

Excludes `node_modules`, `.git`, `.github`, `.claude`, `.agents`, `docs`, test/coverage artifacts, build
outputs, and all `.env*` (except `.env.example`). The pruner stage still does `COPY . .`, so a tight context
matters (don't upload gigabytes; never leak secrets into a layer).

## CI (`.github/workflows/ci.yml`)

- **quality** job: `check`, `check-types`, `test`, `build` (`turbo build --filter=!fumadocs` — the docs-site
  addon is excluded from the product build gate; see `lessons-learned.md`).
- **docker** job: builds the `apps/web` image with `docker/build-push-action` + Buildx, **GHA layer cache**
  (`cache-from/cache-to: type=gha,scope=web`), and enforces an **image-size budget** (web ≤ 350 MB) so a
  regression (dev dep leaking into runtime, etc.) fails the build (§28). Build-only (`load`, no push) for now.
- **e2e** job: Playwright (uploads traces/report on failure).

## Production compose hardening (`docker-compose.prod.yml`)

Per-service **resource limits** (`deploy.resources.limits` — app 1 CPU/512M, minio 0.5 CPU/256M) so one
container can't starve the shared VPS (noisy-neighbour, §8), and **json-file logging** with rotation
(`max-size: 10m`, `max-file: 3`) to cap log growth (§26). See ADR-0004 for the central-infra-reuse model.

## Size-audit ritual (§28)

Periodically: `docker images --format "{{.Repository}}:{{.Tag}}\t{{.Size}}" 'retailos-*'`. If an image
exceeds its budget, the usual culprits are a dev dep that leaked into the production install, `@types/*` in
`dependencies` instead of `devDependencies`, or a heavy optional dep. The CI size gate catches web regressions
automatically.

## Deferred / roadmap (not yet wired — tracked for later phases)

- **`apps/server` Dockerfile** — same Bun multi-stage pattern (distroless bun runtime) once the server image
  is needed for deployment. The prod compose `app` is the web client; a `server` service is added then.
- **Image registry + push + signing** — GHCR push, multi-arch (amd64+arm64) buildx, keyless **cosign**
  signatures + **SLSA provenance** + **SBOM**. Needs a registry/namespace decision; deferred until deployment.
- **Container vulnerability scanning (Trivy)** and **base-image digest pinning** (§28) — wire into the docker
  CI job.
- **Web `HEALTHCHECK`** — deferred until a dedicated `/health` route exists (Phase 1); `/` currently 500s
  without a DB, which would make a healthcheck flaky. Add a bun-based healthcheck against `/health` then.
- **Base-image refresh cadence** — re-pin base images quarterly for security patches.
- **Bun `--compile` single-binary images** (post-MVP) — compile the server to a standalone binary to shave a further ~40–60 MB off the runtime image.

## Known limitations / intentionally deferred

This doc covers the **web** image and the CI build-cache/size gate that exist today. Registry publishing,
signing, multi-arch, server/native images, and Trivy scanning are deliberately deferred to the deployment
phase (§28/§13) and listed above so the scope boundary is explicit.
