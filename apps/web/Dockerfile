# syntax=docker/dockerfile:1.7
#
# Multi-stage image for apps/web (TanStack Start SSR via Nitro `node-server`).
# Charter §28: multi-stage builds + distroless minimal production image; CI enforces
# image-size limits. Pattern adapted from the same-stack heimdallone reference, but the
# runtime is a Node SSR server (not an nginx static SPA) because web is server-rendered.
#
# Stages:
#   1. pruner    — `turbo prune web --docker` extracts the minimal workspace for web
#   2. builder   — install the pruned dep set (BuildKit-cached) and build → .output
#   3. runtime   — distroless node; ships ONLY Nitro's self-contained .output bundle
#
# Build:  docker build -f apps/web/Dockerfile --build-arg VITE_SERVER_URL=... .

ARG BUN_VERSION=1.3.12

# ---- Stage 1: pruner ----
FROM oven/bun:${BUN_VERSION}-alpine AS pruner
WORKDIR /repo
COPY . .
# Minimal workspace for web: out/json (package.json files only) + out/full (source) + pruned lockfile.
RUN bunx turbo prune web --docker

# ---- Stage 2: builder ----
FROM oven/bun:${BUN_VERSION}-alpine AS builder
WORKDIR /repo
# Env validation reads runtime secrets that aren't present at build time.
ENV SKIP_ENV_VALIDATION=1
# Install deps from the pruned dependency manifest first (cacheable layer — only
# busts when a package.json changes, not on every source edit).
COPY --from=pruner /repo/out/json/ ./
COPY --from=pruner /repo/out/bun.lock ./bun.lock
# `--ignore-scripts` skips dev-only postinstall hooks (husky) that need the full repo + .git/,
# neither of which exists in the pruned context. `--frozen-lockfile` is intentionally omitted:
# turbo prune emits a lockfile subset whose resolution can differ slightly and trip the check;
# the committed root bun.lock remains the reproducibility source of truth.
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --ignore-scripts
# Now copy source and build.
COPY --from=pruner /repo/out/full/ ./
ARG VITE_SERVER_URL
ENV VITE_SERVER_URL=${VITE_SERVER_URL}
ENV NODE_ENV=production
RUN bunx turbo run build --filter=web

# ---- Stage 3: runtime — distroless bun, self-contained Nitro output only ----
# The build runs under Bun, so Nitro/srvx bundles the Bun server adapter (Bun.serve);
# the runtime must therefore be Bun, not Node (a Node runtime throws "Bun is not defined").
FROM oven/bun:${BUN_VERSION}-distroless AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3001
# Nitro bundles runtime deps into .output/server/_libs, so the production image needs
# nothing else — no node_modules, no source, no build toolchain.
COPY --from=builder /repo/apps/web/.output ./.output
EXPOSE 3001
USER nonroot:nonroot
# ENTRYPOINT is ["/usr/local/bin/bun"]; CMD supplies the entry file → `bun .output/server/index.mjs`.
CMD [".output/server/index.mjs"]
