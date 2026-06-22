# RetailOS — Lessons Learned (append-only)

> Per charter §40 (documentation fidelity), **read this file before every task and append after it.**
> Each entry uses the fields: `Date | Context | Mistake | Root cause | Fix | Rule`.
> Append new entries at the bottom. Never rewrite history — correct a prior entry with a new dated one.

---

### 1. Registry config schema
- **Date:** 2026-06-21
- **Context:** Configuring shadcn registries in `components.json`.
- **Mistake:** Used bare keys (`magicui` / `ss-blocks`) and a URL with no `{name}` placeholder.
- **Root cause:** Didn't check the official shadcn registry spec.
- **Fix:** Registry keys must start with `@` **AND** every `url` must contain `{name}`.
- **Rule:** Validate registry config against `ui.shadcn.com/docs/registry` and run `shadcn info` before relying on it.

### 2. No `--registry` flag
- **Date:** 2026-06-21
- **Context:** README documented installing Magic UI.
- **Mistake:** README used `shadcn add --registry <url>`.
- **Root cause:** Invented a CLI flag that doesn't exist.
- **Fix:** Install via `@namespace/name` or a full item URL.
- **Rule:** Only use documented shadcn CLI flags.

### 3. Framework assumption
- **Date:** 2026-06-21
- **Context:** Documenting how UI libraries install in this repo.
- **Mistake:** Claimed "TanStack Start = MCP-only, no CLI registry."
- **Root cause:** Assumed framework limitations instead of checking.
- **Fix:** The shadcn CLI supports Vite/TanStack — verified via `shadcn info -c apps/web` (reports framework `TanStack Start`, Tailwind v4).
- **Rule:** Verify framework support from official docs/live tooling, not assumption.

### 4. MCP reads root config
- **Date:** 2026-06-21
- **Context:** shadcn MCP could not see configured registries.
- **Mistake:** Registries lived only in `packages/ui/components.json`, invisible to the shadcn MCP.
- **Root cause:** The MCP resolves registries from the **root** `components.json`.
- **Fix:** Mirror registries into the ROOT `components.json` (done); use `-c packages/ui` for CLI installs into the shared package.
- **Rule:** MCP discovery uses the root config; keep root and `packages/ui` registries in sync.

### 5. Schema-valid ≠ resolvable
- **Date:** 2026-06-21
- **Context:** Magic UI Pro registry entry.
- **Mistake:** A Pro entry (`@magicui` → `r.magicui.design`) passed schema validation but was never proven to resolve (token unset, wrong host/namespace).
- **Root cause:** Trusted schema validation instead of a live probe against the official endpoint.
- **Fix:** Use the official Pro endpoint `@magicui-pro` → `https://pro.magicui.design/registry/{name}` with `Authorization: Bearer ${MAGICUI_PRO_REGISTRY_TOKEN}`. **Live-verified: 103 Pro items returned with the token set.**
- **Rule:** Confirm Pro endpoints against official docs **and** a live probe, not just schema validation.

### 6. Don't trust marketing counts
- **Date:** 2026-06-21
- **Context:** Reporting catalog sizes.
- **Mistake:** README claimed "631+ blocks" unverified; a partial MCP "inspire" pull (~60–80 items) was mistaken for the full catalog (advertised 750+).
- **Root cause:** Reported an advertised number rather than an enumerated one.
- **Fix:** Enumerate via CLI/MCP and report actual counts; flag any coverage gap.
- **Rule:** Never state a catalog size you haven't enumerated.

### 7. shadcn studio uses param-auth namespaces, not a Bearer header
- **Date:** 2026-06-21
- **Context:** Fixing the studio (`@ss-blocks`) registry.
- **Mistake:** Configured `@ss-blocks` → `https://shadcnstudio.com/registry/{name}.json` (single namespace, header-style auth) — 404s.
- **Root cause:** Guessed the URL instead of reading shadcn studio's "How to use shadcn CLI" docs.
- **Fix:** Studio exposes four namespaces — `@shadcn-studio` (free) and `@ss-components` / `@ss-blocks` / `@ss-themes` at `https://shadcnstudio.com/r/{components|blocks|themes}/{name}.json`, authenticated with query **`params`** `{ email: "${EMAIL}", license_key: "${LICENSE_KEY}" }` (NOT a Bearer header).
- **Rule:** Auth mechanism is per-registry (header vs params) — copy it verbatim from the vendor's official CLI docs.

### 8. Registries without a searchable index still install by name
- **Date:** 2026-06-21
- **Context:** `shadcn search @ss-blocks` / `@reui` failed on `…/registry.json` 404.
- **Mistake:** Assumed a failing `search` meant a broken registry entry.
- **Root cause:** `search`/`list` require a registry index (`registry.json`) that shadcn studio and ReUI don't publish.
- **Fix:** Keep the entries — items resolve by exact `@ns/name` (verified `@reui/data-grid`). Discover studio items via the studio MCP; discover ReUI/Magic UI items from their docs or (for Magic UI) `search` which *does* work.
- **Rule:** No searchable index ≠ broken. Verify with `view @ns/<item>`, not only `search`.

### 9. ReUI registry is style-templated; pin to a Base-UI style
- **Date:** 2026-06-21
- **Context:** Adding ReUI (`@reui`).
- **Mistake:** Used ReUI's documented `{style}` template, which substitutes our project style `base-lyra` → 404 (ReUI doesn't serve that style).
- **Root cause:** The `{style}` placeholder resolves from our `components.json` style, but ReUI serves its own styles (`base-nova`, `default`).
- **Fix:** Pin `@reui` → `https://reui.io/r/base-nova/{name}.json` (Base-UI style, matching our `base: base`). Verified `@reui/data-grid` resolves.
- **Rule:** When a registry URL carries a `{style}` placeholder, confirm the vendor serves your project's style or pin a compatible one.

### 10. Origin UI is legacy — don't ship an unverifiable entry
- **Date:** 2026-06-21
- **Context:** Task asked to add Origin UI as a free source.
- **Mistake:** Nearly added `@originui` → `https://originui.com/r/{name}.json` on ecosystem memory.
- **Root cause:** The site is bot-protected here (403 / HTML challenge), so the endpoint couldn't be live-verified; the official repo states Origin UI is a *pre-acquisition, maintenance-only* collection (succeeded by `Particles`/coss-ui).
- **Fix:** Did NOT configure Origin UI. Documented the legacy status and chose ReUI as the active free data-dense source.
- **Rule:** Don't add a registry entry you can't live-verify, and prefer actively-maintained sources; record the gap (§40).

### 11. Auth params leak into CLI error URLs — redact in logs
- **Date:** 2026-06-21
- **Context:** `shadcn search`/`view` on param-authed studio registries.
- **Mistake:** A failing studio request echoed the full URL including `license_key=` in terminal output.
- **Root cause:** The CLI prints the resolved URL (with query params) on fetch errors.
- **Fix:** Redact `license_key`/`email`/tokens when capturing CLI output; keep secrets only as `${ENV}` placeholders in committed config.
- **Rule:** Never paste raw CLI error URLs from authenticated registries into logs, issues, or commits.

### 12. `get-blocks-metadata` undercounts — use `get-block-meta-content` per category
- **Date:** 2026-06-21
- **Context:** Counting the shadcn studio block catalog.
- **Mistake:** Reported **~146 variants / 61 types** for studio, derived from `get-blocks-metadata` (the `/iui` `iuiPath` list).
- **Root cause:** `get-blocks-metadata`'s `iuiPath` is a curated *inspiration* subset, not the full per-category variant list — it lists ~2–15 per category when the real count is far higher (e.g. application-shell shows 9 there but has 18).
- **Fix:** Enumerate each category with `get-block-meta-content` (the `/cui` endpoint). Live-verified exactly: application-shell **18**, hero-section **41**, datatable **7** → **735 blocks across 61 categories** total (≈ the advertised 750+). A parallel agent's 735 count was correct; my ~146 was the undercount.
- **Rule:** For full counts, enumerate per category via `get-block-meta-content`; treat `get-blocks-metadata` as a category index only. Always reconcile a surprising count against a second, deeper source before publishing.

### Phase-0 foundation config (Deliverable D) — 2026-06-21
- **Context:** Wiring the §43/§46 quality gates (test, lint, CI) into the Better-T-Stack scaffold.
- **Mistakes/surprises & fixes:**
  - The scaffolded husky pre-commit was bare `bun test`, which **errors on "0 test files"** and blocked every commit. Fix: pre-commit runs `bunx lint-staged` + `bun run check-types`; tests run via Vitest with `passWithNoTests: true` (+ a real `cn()` smoke test) so `bun run test` is green.
  - `apps/fumadocs/biome.json` was a second **root** Biome config → "nested root configuration" error broke `ultracite check` repo-wide. Fix: add `"root": false` (Biome 2.x nested-config requirement).
  - Ultracite/Biome is stricter than the frameworks: `useFilenamingConvention` rejects TanStack/Expo file-based routes (`$.tsx`, `__root.tsx`, `(drawer)`); `noBarrelFile` rejects package entry points; `noNamespaceImport` rejects Drizzle `import * as schema`. Fix: override those three rules off in root `biome.jsonc`; exclude vendored `.agents/skills` and the Fumadocs docs-site from the product lint. Fixed the genuine remainder (a11y label primitive, `any`, nested ternaries, missing await).
- **Rule:** A failing quality gate that blocks all commits is a P0 — fix the gate config, don't `--no-verify` past it. Validate the lint config with `biome check .` (Biome validates its own schema); confirm `check`/`check-types`/`test` are all green before claiming Phase-0 lock-in.

### Central shared infra reuse (KareTech VPS) — 2026-06-21
- **Context:** Saving VPS resources by reusing the existing central Postgres/Redis instead of per-app containers.
- **Findings/fixes:**
  - `postgres-central` (postgres:18-alpine) + `redis-shared` live on the shared external **`pangolin`** docker network; apps reach them by container name (`postgres-central:5432`, `redis-shared:6379`). Host 5432 is already taken — a per-app postgres on 5432 conflicts.
  - Provisioned `retailos` DB + a **least-privilege** role (`rolsuper=f, rolcreatedb=f`) via `docker exec postgres-central psql -U postgres` (local-socket trust — no central password needed).
  - Infisical CLI needs **`--domain=https://infisical.karetechsolutions.com`** (self-hosted) — without it, it hits `app.infisical.com` and fails with `403 invalid signature`. Also create the `/credentials/<app>` **folder** before `secrets set` (else 404). Stored creds at `/credentials/retailos` (prod).
  - **Hybrid model:** committed `docker-compose.yml` stays self-contained (own pg/redis/minio) for other deployments/contributor laptops; `docker-compose.prod.yml` (VPS) reuses central via `pangolin` + pulls secrets from Infisical; MinIO runs locally (no central object store). Redis namespaced to logical DB 3 + `retailos:` key prefix.
- **Rule:** Endpoints are env-driven (charter §9) — reuse shared infra per-environment, never hardcode; keep the portable compose self-contained and isolate VPS specifics in a prod override.

### CI red on master — fumadocs shiki-WASM build under rolldown — 2026-06-21
- **Context:** First CI run on `master` (commit `21e58fa`) went **red**. The §43 Build gate (`bun run build` → `turbo build`) failed on `fumadocs#build`.
- **Mistake/surprise:** Claimed Phase-0 lock-in without a green CI run; the build gate had never been exercised in CI. Root cause: `fumadocs-core@16.10.5`'s `highlight/shiki/full.js` statically defines a `wasmShikiFactory` with `createOnigurumaEngine(import("shiki/wasm"))`. Under Vite 8 / TanStack Start (rolldown 1.0.3), `builtin:vite-wasm-fallback` can't load `shiki/dist/onig.wasm` → `[UNLOADABLE_DEPENDENCY]`, build exits 1.
- **What didn't work:** Setting `rehypeCodeOptions.engine: "js"` in `source.config.ts` only changes the **runtime** factory; the bundler still statically walks the unused `import("shiki/wasm")` in the module graph, so the WASM chunk is still processed and still fails.
- **Fix:** `apps/fumadocs` is the Better-T-Stack **docs-site addon**, not RetailOS product code (already excluded from product Biome lint and the Vitest/Playwright scope). Excluded it from the build gate: root `build` → `turbo build --filter=!fumadocs` (+ a separate `build:docs` to build it on demand). Kept `engine: "js"` since it's still correct for `dev`/`start`. Also fixed the `web#build` turbo cache miss by adding `.output/**` + `.nitro/**` to the `build` task `outputs` (TanStack Start emits to `.output/`, not `dist/`).
- **Rule:** "Phase complete" is not true until **CI is actually green** on the pushed commit — a gate that has never run is not a passing gate (§46). Verify with `gh run list`/`gh run view --log-failed`, not assumption. When an upstream toolchain bug breaks a **non-product** artifact, scope it out of the gate **explicitly and documented** (filter + comment + this entry), never with `--no-verify` or a silent skip. Re-enable fumadocs in the build gate once shiki/rolldown WASM bundling is supported.

### Docker: distroless runtime must match the build runtime (Bun, not Node) — 2026-06-21
- **Context:** Optimizing the `apps/web` image (charter §28) from a 2.38 GB fat single-stage build to a multi-stage distroless image, adapting the same-stack heimdallone reference.
- **Surprise/mistake:** First optimized attempt used `gcr.io/distroless/nodejs24-debian12` as the runtime and ran `.output/server/index.mjs` with **node**. The image **built** (exit 0) but **crashed at boot**: `ReferenceError: Bun is not defined` at `.output/server/_libs/h3+rou3+srvx.mjs` (`Bun.serve`).
- **Root cause:** `apps/web` is TanStack Start SSR (Nitro `node-server` preset). Because the **builder** stage runs under `oven/bun`, Nitro/srvx bundles the **Bun** server adapter into `.output`. A Node runtime then has no `Bun` global.
- **Fix:** runtime stage = `oven/bun:1.3.12-distroless`, `USER nonroot:nonroot`, entrypoint is `bun`, `CMD [".output/server/index.mjs"]`. Rebuilt → **168 MB** (vs 2.38 GB baseline, ~93% smaller); verified it **boots and serves** (`Listening on http://localhost:3001/`; `/` 500s only because no DB was attached — a data concern, not a packaging defect).
- **Other findings:** heimdallone's `web` is a static SPA→nginx, but RetailOS `web` is **SSR**, so the nginx-static pattern does **not** transfer — web maps to the Bun/SSR runtime pattern. `turbo prune --docker` + BuildKit `--mount=type=cache` + distroless + non-root are the transferable wins. `--frozen-lockfile` is omitted in the Docker install because the pruned `bun.lock` subset can trip it (root `bun.lock` stays the source of truth).
- **Rule:** A Docker image that **builds** is not verified — **boot it** before claiming success. The runtime engine must match what the bundler targeted: build under Bun ⇒ run under Bun. Don't assume a same-stack reference's per-app pattern transfers; check whether the app is SSR vs static first.

### Postgres 18 relocated PGDATA — `…/postgresql/data` mount advice is pre-18 — 2026-06-21
- **Context:** Audit-only red-team pass (`phase-0-audit.md`) flagged the compose postgres volume mount `RetailOS_postgres_data:/var/lib/postgresql` as a MEDIUM data-loss risk, asserting the "correct" mount is `…/var/lib/postgresql/data`.
- **Mistake/surprise:** That `…/data` convention is for Postgres ≤17. Live probe of `postgres:18-alpine` shows `PGDATA=/var/lib/postgresql/18/docker` and `VOLUME /var/lib/postgresql` — the image moved the data dir to a **version-namespaced** path under the declared volume. Our mount of the **parent** `/var/lib/postgresql` is therefore **correct** for PG18 and persists data; "fixing" it to `…/data` would have created an empty/ignored mount.
- **Root cause:** An auditor (and the widely-repeated convention) assumed the pre-18 layout. A schema-/convention-plausible claim is not proof for the version in use.
- **Fix:** Verified with `docker image inspect postgres:18-alpine` (`.Config.Volumes` + `PGDATA` env) before changing anything; dismissed the finding; recorded here.
- **Rule:** Verify version-specific defaults (data dirs, env, volumes) against the **exact pinned image** via a live `docker image inspect`, not against general convention or an auditor's plausible claim (charter §40). A red-team finding is itself a claim to verify, not a fact to action.

### VS#1 Commit 1 — schema barrel resolution + text tenant_id — 2026-06-21
- **Context:** First feature commit (Vertical Slice #1, schema + seed scaffold). `packages/auth` needs the full Drizzle schema (Better Auth org/admin tables) for the drizzle adapter.
- **Surprise 1 (exports map):** `import * as schema from "@RetailOS/db/schema"` does NOT resolve — `packages/db` exposes `"./*": "./src/*.ts"`, and that subpath pattern maps `@RetailOS/db/schema` → `./src/schema.ts` (a file), not the `./src/schema/index.ts` directory barrel. Fix: `export * as schema from "./schema"` from the package root (`@RetailOS/db`) and import `{ schema }` from there. **Rule:** subpath-pattern exports don't do directory-index resolution; re-export a namespace from the package entry, or add an explicit `./schema` exports key.
- **Surprise 2 (tenant_id type):** the design sketch used `current_setting('app.tenant_id')::uuid`, but Better Auth ids are **text** (nanoid), so `organization.id` — and therefore every `tenant_id` — is `text`, not `uuid`. RLS will compare text and use `current_setting('app.tenant_id', true)` (missing_ok) so an unset GUC returns NULL ⇒ zero rows = **fail-closed** (charter requirement). Domain PKs stay `uuid` (`defaultRandom()`); only `tenant_id`/`created_by` (→ user.id) are text. **Rule:** match the auth provider's id type when designing tenant-scoping columns + RLS; verify against the real schema, not an illustrative sketch (§40).
- **Also:** added `check-types` (`tsc --noEmit`) to `packages/db` and `packages/auth` (previously unchecked) so the schema is actually type-gated; scoped their tsconfigs to `src/**` and excluded `vitest.config.ts` (composite `tsc` otherwise pulls the root config across rootDir and emits stray `vitest.config.js`).

### VS#1 Commit 2 — fail-closed RLS + 3-role bootstrap — 2026-06-22
- **Context:** Migration + RLS for VS#1 (ADR 0006). Roles owner/migrator/app, ENABLE+FORCE on 11 tenant tables, fail-closed policy, real-Postgres tests.
- **Findings/fixes:**
  - **Superuser bypasses RLS** — local docker runs as `postgres` (superuser), which ignores RLS regardless of FORCE. Tests MUST connect as a non-superuser, non-BYPASSRLS role (`retailos_app`) or they pass vacuously. (Why the whole role split exists.)
  - **`withTenant` guard must reject, not throw** — a synchronous `throw` in a `Promise`-returning fn isn't caught by `.catch`/`.rejects`. Return `Promise.reject(...)` (keeps it non-`async`, dodges biome `useAwait`).
  - **PG18 PGDATA + roles:** migrator gets `ALTER ROLE … SET role TO retailos_owner` so migration objects are owned by owner (needed to `CREATE POLICY`); owner needs `GRANT CREATE ON DATABASE` (dynamic, `current_database()`) to create the drizzle migrations schema.
  - **Codex adversarial review (2 HIGH, 0 CRIT):** (1) idempotent re-runs didn't reassert `NOCREATEDB/NOCREATEROLE` nor revoke an accidental `retailos_owner` membership from `retailos_app`; (2) `PUBLIC`'s `CREATE` on schema `public` wasn't revoked. Fixed both + added assertions (`rolcreatedb/rolcreaterole=false`, not-owner-member, no schema CREATE).
- **Rule:** RLS is only real when tested as the actual non-privileged runtime role; a role's *current* flags aren't enough — reassert the safe posture AND revoke inherited/PUBLIC privileges every bootstrap run, and prove it with `pg_roles`/`has_schema_privilege` assertions.

### VS#1 Commit 3 — core services + codex HIGH fixes — 2026-06-22
- **Context:** Money/StockLedger/Idempotency/Audit services on the tenant-scoped tx.
- **Codex adversarial review found 3 HIGH (0 CRIT), all fixed:**
  - **Idempotency race:** `SELECT … FOR UPDATE` locks nothing when the row doesn't exist, so concurrent first-callers both run `fn`. Fix: `pg_advisory_xact_lock` on `(tenant,key)` BEFORE the select (mirrors StockLedger's per-cell lock).
  - **Non-canonical hash:** `JSON.stringify` key order isn't stable → `{a,b}` vs `{b,a}` false-conflict. Fix: recursive sorted-key `canonicalize()` before hashing.
  - **Money int range:** only `Number.isInteger` (not `isSafeInteger`) + `integer` (int4, ~$21M) columns — wrong for an enterprise/wholesale ERP. Fix: `Number.isSafeInteger` guard (all ops funnel through `money()`); widen the 4 money columns to `bigint(mode:"number")` (expand-safe int4→int8 ALTER, migration 0004).
- **Test hermeticity:** integration tests that assert exact counts/balances must clear their tenant's rows in `beforeAll` (RLS-scoped deletes) — CI uses a fresh DB but local re-runs hit persisted state.
- **Rule:** for idempotency/ledger correctness, take the serialization lock BEFORE the existence check (not just FOR UPDATE); hash canonically; use `bigint(mode:number)` + `isSafeInteger` for money so JS and DB safe ranges align. Money rounding mode stays deferred (no division in VS#1) — logged as a Phase-5 decision.

### Never run `perl -0pi` (or sed -i) in-place on UTF-8 docs — 2026-06-22
- **Context:** Inserting a changelog line into PROGRESS.md with `perl -0pi -e 's/.../.../'` where the replacement contained non-ASCII (`→`, `§`).
- **Mistake:** perl processed the file as bytes without `binmode`/`use utf8`; the wide chars in the replacement triggered "Wide character in print" and the whole file's multibyte chars (em-dashes, §, emoji, ☑/☐) were rewritten as mojibake. Committed + pushed the corruption before noticing.
- **Fix:** Restored from `git show HEAD~1:<file>` and re-applied the edits with the Edit tool (UTF-8 safe).
- **Rule:** Edit Markdown/UTF-8 docs with the Edit/Write tools, never `perl -0pi`/`sed -i` — and if a shell rewrite is unavoidable, set `binmode`/`-CSD`/`LANG=…UTF-8` and verify (`grep -c "Ã"` = 0) before committing.

### VS#1 Commit 6 — FK checks bypass RLS; oversell is a business decision — 2026-06-22
- **Context:** oRPC routers for the §32 flow + minimal RBAC. Codex found 4 HIGH (0 CRIT).
- **Key finding (fixed):** **Postgres FK existence checks BYPASS RLS.** A tenant-scoped insert (tenant_id from ctx, WITH CHECK passes) with an input `companyId`/`locationId`/`productId` belonging to ANOTHER tenant would succeed — the FK validation sees the referenced row regardless of the RLS policy — creating a cross-tenant dangling reference. Fix: before insert, validate every referenced id with an **RLS-scoped `SELECT`** inside the same `withTenant` tx (returns nothing for another tenant's row ⇒ reject NOT_FOUND). Applied in location/inventory/pos routers.
- **Business-decision discipline (deferred, NOT guessed):** codex flagged `pos.createSale` can oversell. Oversell policy (allow-backorder / hard-reservation / optimistic) is a **per-tenant charter §14 decision** — `StockLedger.appendStockMovement` stays policy-neutral (records faithfully); the no-negative gate is applied upstream once the owner decides. Logged in PROGRESS deferred-decisions, not implemented.
- **Also fixed:** product `priceMinor >= 0` (no negative totals); `reports.salesBasic` groups by currency+scale (summing minor units across currencies is meaningless, §12).
- **Rule:** RLS does NOT protect FK references — explicitly validate cross-entity input ids with a tenant-scoped read (or add composite `(tenant_id, id)` FKs) before inserting. And never let a reviewer's "fix" push you into guessing a charter-flagged business rule — defer it.

### VS#1 Commit 7 — env-core blocks server vars under happy-dom; defer env-bound imports — 2026-06-22
- **Context:** §32 end-to-end integration test through the oRPC routers (imports auth+db → env).
- **Mistake/surprise:** the test crashed with "Attempted to access a server-side environment variable on the client". `@t3-oss/env-core` treats the presence of a `window` global as "client" and BLOCKS `server` vars — and the root Vitest config uses **happy-dom**, which provides `window`. So any test touching `@RetailOS/env/server` (transitively via `@RetailOS/db`/`@RetailOS/auth`) fails under the DOM env.
- **Fix:** add `// @vitest-environment node` at the top of the integration test (per-file override) so `window` is absent and env-core treats it as server. Also import the env-bound modules **lazily inside `beforeAll`** (guarded by `describe.skipIf(!RLS_TEST_DATABASE_URL)`), so the default no-DB `bun run test` neither runs NOR loads the suite — otherwise the top-level import would run `createAuth()`/env validation and crash the quality job.
- **Rule:** integration tests that touch server env need `// @vitest-environment node`; and defer env/DB-bound imports into a skip-guarded `beforeAll` so a DB-less gate run doesn't load (and crash on) them.

### Mojibake guard added — the perl-corruption lesson now has a mechanical gate — 2026-06-22
- **Context:** Owner directive: never use `perl`/`sed`/`awk` to edit Markdown/text docs (they round-trip UTF-8 through Latin-1 → mojibake; this already corrupted PROGRESS.md once — see the "Never run `perl -0pi`" entry above). Per §40, a lesson with a recurring failure mode should graduate into automated prevention.
- **Fix:** added `scripts/check-mojibake.mjs` (native Node/Bun fs, **no** perl/sed/awk) and wired it as the **first** step of `.husky/pre-commit` (+ `bun run check:mojibake` for a repo-wide scan). It rejects the double-encoding signatures (the section sign, em/en dashes and smart quotes, emoji, and arrows/checkboxes all mis-decode into recognisable Latin-1 prefix runs) plus the U+FFFD replacement char, on staged text files.
- **Two non-obvious build details:** (1) the checker's own regexes are built from `\u` escapes (not literal mojibake bytes) AND it self-excludes by path, so it never flags its own source; (2) patterns are scoped to the specific mojibake prefix runs so legitimate accented i18n text (Spanish/Portuguese/French/Dutch/German — charter §12) does **not** false-positive. **This very lesson tripped the guard on first commit** because it embedded literal mojibake examples — reworded to describe by name, which is itself the lesson: docs must not contain the raw corrupt sequences. Verified: catches corruption (exit 1), passes clean docs, ignores accents, repo-wide scan clean.
- **Rule:** edit UTF-8 docs only with the Edit/Write tools or native fs scripts — never byte-level stream editors. The pre-commit mojibake guard is the mechanical backstop; if it ever fires, restore from `git show HEAD:<file>` and re-apply with an editor, never bypass with `--no-verify`.
