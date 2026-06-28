# syntax=docker/dockerfile:1.7
#
# Multi-stage image for apps/server (Hono + oRPC + Better Auth, run under Bun).
# Companion to apps/web/Dockerfile — the backend half of the RetailOS deployment
# (charter §28: multi-stage + distroless minimal production image).
#
# Unlike web (Nitro self-bundles everything into .output), the server is built by
# tsdown with `noExternal: [/@RetailOS\/.*/]` — it INLINES the @RetailOS/* workspace
# packages into dist/index.mjs but leaves the npm deps (hono, better-auth, @orpc/*,
# zod, dotenv) external. So the runtime image ships dist/index.mjs PLUS the
# production node_modules those externals resolve from.
#
# Stages:
#   1. pruner   — `turbo prune server --docker` extracts the minimal workspace
#   2. builder  — install (BuildKit-cached), build → dist, prune to prod deps
#   3. runtime  — distroless bun; dist + production node_modules only
#
# Build:  docker build -f apps/server/Dockerfile .

ARG BUN_VERSION=1.3.12

# ---- Stage 1: pruner ----
FROM oven/bun:${BUN_VERSION}-alpine AS pruner
WORKDIR /repo
COPY . .
RUN bunx turbo prune server --docker

# ---- Stage 2: builder ----
FROM oven/bun:${BUN_VERSION}-alpine AS builder
WORKDIR /repo
# Env validation reads runtime secrets that aren't present at build time.
ENV SKIP_ENV_VALIDATION=1
# Install from the pruned dependency manifest first (cacheable layer).
COPY --from=pruner /repo/out/json/ ./
COPY --from=pruner /repo/out/bun.lock ./bun.lock
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --ignore-scripts
# Source, then build the bundled server (workspace pkgs inlined by tsdown).
COPY --from=pruner /repo/out/full/ ./
ENV NODE_ENV=production
RUN bunx turbo run build --filter=server
# Re-resolve to PRODUCTION deps only, so the runtime node_modules excludes the
# build toolchain (tsdown/typescript). The bundled dist still imports the
# externalized npm runtime deps (hono/better-auth/@orpc/zod/dotenv) by name.
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --production --ignore-scripts

# ---- Stage 3: runtime — distroless bun ----
FROM oven/bun:${BUN_VERSION}-distroless AS runtime
WORKDIR /repo
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000
# Bun's isolated install keeps real packages in the ROOT node_modules/.bun store
# and RELATIVE-symlinks them from the workspace node_modules. So both trees must
# land at the SAME relative depth (/repo/node_modules + /repo/apps/server/
# node_modules) for the externalized deps (hono/better-auth/@orpc/zod/dotenv) to
# resolve from the bundled dist. Path layout mirrors the builder exactly.
COPY --from=builder /repo/node_modules ./node_modules
COPY --from=builder /repo/apps/server/node_modules ./apps/server/node_modules
COPY --from=builder /repo/apps/server/dist ./apps/server/dist
EXPOSE 3000
USER nonroot:nonroot
# ENTRYPOINT is ["/usr/local/bin/bun"]; CMD supplies the entry. Bun serves the
# default-exported Hono app on $PORT (3000).
CMD ["apps/server/dist/index.mjs"]
