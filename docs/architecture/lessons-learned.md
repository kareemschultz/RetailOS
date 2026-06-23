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

### Mojibake guard — Codex PR #2 findings: scan the index, not the worktree; catch checkboxes; pure-ASCII source — 2026-06-22
- **Context:** Codex review of the v1 guard found three real defects.
- **Finding 1 — wrong source in pre-commit:** the guard listed *staged* paths (`git diff --cached`) but then read the **working-tree** file. A corrupted blob already in the index could pass if the worktree copy was clean. **Fix:** in staged mode read the **staged blob** via `git show :<path>`; `--all` and explicit-path modes still read the worktree. Regression test stages corrupt bytes, then writes a clean worktree copy, and asserts staged mode still fails (worktree mode passes) — proving the index is the scanned source.
- **Finding 2 — checkboxes missed:** checklist glyphs U+2610/U+2611/U+2612 corrupt to an `E2 98 xx` run whose 2nd byte (`98`) is a C1 control (Latin-1) or `U+02DC` (cp1252) — neither was in the v1 pattern set. **Fix:** added a **C1-control-block detector (U+0080..U+009F)** — the Latin-1 form of *any* multibyte mojibake, and the single most general signal — plus `U+02DC` to the cp1252 `â`-class. Regression tests cover both corrupt forms and confirm clean U+2610/11/12 glyphs pass.
- **Finding 3 (related):** building patterns from regex *literals* kept reintroducing literal mojibake/C1 bytes into the source (which then self-flagged or tripped biome's control-char-in-regex). **Fix:** build every pattern at load time from numeric codepoints via `String.fromCharCode`, so the source is **pure ASCII** — no literal mojibake, no control bytes, immune to self-flagging and to that lint. Also tightened the `Â` 2-byte pattern to `U+00A0..U+00BF` (was `U+0020..`), removing a latent false-positive on French capital-A-circumflex words.
- **Also:** test fixtures/comments must themselves avoid literal mojibake (build fixtures from codepoints) or the guard flags the test file — `--all` missed it only because the new file was still untracked (`git ls-files` lists tracked only); staged mode would have caught it.
- **Rule:** a guard must scan exactly what gets committed (the index blob), not a possibly-divergent worktree; the C1-control-block check is the highest-value mojibake signal; and detection logic + its test fixtures must be built from codepoints so the tooling never embeds the very bytes it hunts.

### Deleting a stacked PR's base branch CLOSES it (doesn't retarget) — 2026-06-22
- **Context:** Merging PR #1 (`vs1-phase1`→master) with `--delete-branch`, expecting the stacked PR #2 (`phase-2-inventory`→`vs1-phase1`) to auto-retarget to master.
- **Mistake/surprise:** GitHub **closed** PR #2 instead of retargeting it (`state: CLOSED`, base still the deleted branch); `gh pr reopen` then failed (`Could not open the pull request` — base branch gone).
- **Fix:** the branch + commits were intact (only the base branch was deleted). Verified `phase-2-inventory` merges cleanly into master with `git merge-tree --write-tree` (exit 0, **zero conflict markers**) BEFORE acting, then opened a fresh PR #3 from the same branch → master and merged it. No blind conflict resolution.
- **Rule:** for stacked PRs, **merge bottom-up and DON'T `--delete-branch` the base while a child PR still targets it** — retarget the child to master first (`gh pr edit <n> --base master`), then merge, then delete. If a base is already deleted, don't fight `reopen`; `merge-tree --write-tree` to prove a clean merge, then a fresh PR.

### Mechanical RLS-coverage gate + extensible-enum schema rule (Phase 2 Commit 0) — 2026-06-22
- **Context:** Phase 2 needs a gate so a future tenant-owned table can't land without RLS (the classic multi-tenant footgun six months in).
- **Fix:** `packages/db/src/tenant-isolation-coverage.test.ts` — enumerates every `pgTable` via Drizzle `getTableConfig` (filtered by `is(v, PgTable)`), classifies tenant-owned by a `tenant_id` column, parses migration SQL (both `ALTER TABLE … ENABLE` and the DO-block `ARRAY[…]` forms) for RLS coverage, and **fails** if the two sets differ (or a tenant-owned table isn't in a documented `RLS_EXCLUSIONS`). Pure/static → runs in the default `bun run test` gate on every commit (runtime denial still proven by the DB-gated `tenant.rls.test.ts`). Demonstrated red→green by injecting a fake uncovered tenant table.
- **Two build gotchas (caught by gates):** biome `useTopLevelRegex` → hoist the inline `/ENABLE ROW LEVEL SECURITY/i` to a module const; strict TS `noUncheckedIndexedAccess` → match-group `m[1]` is `string | undefined`, guard before `.add()`.
- **Schema rule (Phase 2 onward):** intentionally-extensible value sets (`tracking_mode`, `costing_method`, oversell/expiry policy, barcode parser type, reason codes, UoM roles, movement types) use Drizzle **`text({ enum: [...] })` + CHECK/Zod**, **NEVER native `pgEnum`** (`ALTER TYPE … ADD VALUE` is non-transactional and can't remove/reorder).
- **Rule:** turn "I checked the N tables" into an automated gate that enumerates from the live schema and blocks the commit; prefer extensible `text` enums over `pgEnum` for evolving domains.

### Nullable scoped uniqueness needs `NULLS NOT DISTINCT` — 2026-06-22
- **Context:** Phase 2 catalog schema added `uom_conversion` rows scoped at tenant/category/product/SKU level, where nullable columns represent less-specific scopes.
- **Mistake caught during self-review:** a plain PostgreSQL `UNIQUE(tenant_id, category_id, product_id, sku_id, from_uom_id, to_uom_id, role)` would treat `NULL` scope columns as distinct, allowing duplicate tenant-level/category-level conversion rows.
- **Fix:** schema uses Drizzle `.nullsNotDistinct()` and migration uses `UNIQUE NULLS NOT DISTINCT`, with `CHECK (num_nonnulls(category_id, product_id, sku_id) <= 1)` for most-specific-wins scope discipline.
- **Rule:** when `NULL` is part of a logical uniqueness key, explicitly choose `NULLS NOT DISTINCT` (or an equivalent partial unique index strategy). Plain `UNIQUE` is not enough for scoped config tables.

### Inventory quantities need int8 before UoM minor units — 2026-06-22
- **Context:** VS#1 used `integer` stock quantities because it only moved simple each-count products. Phase 2 introduces base-unit quantities for cartons/eaches and weighed goods (for example grams).
- **Mistake avoided:** leaving `stock_ledger.qty_delta` / `balance_after` as int4 would cap high-volume base-unit ledgers too low once quantities are represented in minor units.
- **Fix:** Commit 2 widens stock ledger quantities to `bigint(mode:"number")` and updates `StockLedger` sum queries to cast to `bigint` and coerce through `Number(...)`.
- **Rule:** apply the same range discipline to quantity minor units that we apply to money minor units; int4 is not an ERP-safe ledger type.

### Carry load-bearing accounting invariants into DDL — 2026-06-22
- **Context:** Phase 2 AVCO storage uses `avg_cost.total_value_minor` as source of truth and derives average cost only for display/posting.
- **Mistake avoided:** documenting `qty_on_hand = 0 ⇒ total_value_minor = 0` only in service code would leave imports, manual SQL, or future services able to create orphaned value at zero stock.
- **Fix:** Commit 3 adds `avg_cost_zero_qty_zero_value_chk` (`qty_on_hand <> 0 OR total_value_minor = 0`) in the migration, alongside the service-level plan.
- **Rule:** when an invariant protects the ledger from silent corruption, enforce it in the database as well as in services/tests.

### Phase-2 valuation needs SKU-level ledger identity — 2026-06-22
- **Context:** VS#1 `stock_ledger` was product-based because the first slice had only simple products. Phase 2 valuation storage (`avg_cost`, `valuation_layer`) is SKU×location.
- **Audit finding:** implementing costing on top of product-only ledger rows would make variants/SKUs under the same product share a running stock/cost cell, corrupting balances and valuation in mixed catalogs.
- **Fix:** Commit 6 adds nullable `stock_ledger.sku_id` + index/FK and updates `appendStockMovement` to lock and compute `balance_after` by SKU when `skuId` is present, while keeping legacy product-level callers working.
- **Rule:** whenever a lower-level identity is introduced (product → SKU, location → bin, tenant → company), audit every ledger/key/lock path for the true inventory cell identity before adding services.

### Raw pg bigint results are strings even when Drizzle columns use mode:number — 2026-06-22
- **Context:** Drizzle `bigint(..., { mode: "number" })` maps selected table columns, but raw `tx.execute(sql\`...\`)` returns PostgreSQL `int8` values as strings through `pg`.
- **Bug caught by real DB test:** AVCO's zeroing issue returned `cogsMinor: "101"` from a raw `avg_cost.total_value_minor` row, while other math paths implicitly coerced strings through arithmetic.
- **Fix:** Commit 6 normalizes raw bigint fields at the service boundary (`asNumber`) before valuation arithmetic/returns; the DB-gated costing test now proves AVCO remainder carry and zero-value invariant with real Postgres.
- **Rule:** do not trust raw SQL result types for money/quantity fields; explicitly normalize `int8` from `tx.execute` and cover at least one real-Postgres test for ledger arithmetic.

### PR #4 hotfix — cross-tenant FK guards are a CLASS, not call-sites; D5 has two limbs — 2026-06-22
- **Context:** Review of the Phase-2 backend (PR #4) found two HIGH issues + a recurring pattern.
- **H1 — cross-tenant FK-bypass recurred on new mutations.** `countStart` (locationId), `countLineUpsert` (skuId+lotId, also missing audit), `adjust` (locationId **and** lotId — the first review pass only spotted lotId), and `reorderEvaluate` (skuId+locationId, emits a payload) inserted/used FK ids with no tenant-scoped existence check. Postgres FK validation runs as table owner and **bypasses RLS**, so router-level `assert*Visible` reads are mandatory on EVERY FK-bearing input. Fix: added the existing guards to all four (+ restored `recordAudit` on countLineUpsert) and replaced three one-off tests with **one parameterized harness** (`vs1.integration.test.ts` "rejects cross-tenant FK references on every guarded FK input") that takes a `cases[]` row per FK input — trivially extendable when a new FK lands.
- **H2 — a locked decision can be "documented" but unwired.** D5 (allow-oversell-with-flagging) defines TWO limbs: *flag* and *value*. The `inventory.stock_discrepancy` event constant existed but `pos.createSale` never emitted it — oversell produced no manager signal. Fix: emit it (event only) when `appendStockMovement` returns `balanceAfter < 0`; ledger stays policy-neutral (no hard-block). The *value* limb diverges (oversell COGS = 0/unvalued, not last-known-cost) — recorded as a **decided divergence** in `module-specs/inventory.md` D5, not silently.
- **Tickets opened (durable, out of hotfix scope):** #5 composite-FK `(tenant_id, id)` to kill the H1 class at the DB layer (Phase 3); #6 valuation math in JS `number` loses precision >2^53 — needs a BigInt `mulDivRound` with a chosen rounding mode (Phase-5 blocker, before a large tenant onboards).
- **Rule:** when a cross-tenant FK-bypass is found, sweep the whole CLASS (every FK-bearing input) + add a parameterized regression harness, and plan the DB-layer composite-FK fix — three call-site patches don't close the class. And "decision documented" ≠ "decision wired" — grep that each locked decision's event/behavior is actually emitted/enforced.

### Schema-and-seams pass — generous seams, stingy behavior; stamp financial strategy on the movement — 2026-06-22
- **Context:** Phase-2 expand-only pass (migration 0010) adding lot/serial-aware valuation, value-only adjustments, returns/UoM/quantity seams, a settings resolver, and a cost-reconciliation event contract.
- **Key seam (historical integrity):** a live product→category→…→tenant resolver would silently re-value historical movements the moment a tenant flips a financial setting — violating "no historical reinterpretation." Fix: **stamp the resolved financial strategy on the movement row at write time** (`stock_ledger.costing_method_applied`), so the resolver only ever drives NEW writes; history is immutable. (Alternative — effective-dated settings history — is heavier; the stamp is sufficient.)
- **Asymmetric FK by design:** `valuation_layer.lot_id` is a real FK (lot entity exists + is H1-guarded); `serial_id` is a **bare uuid with no FK** because serial capture is deferred — documented "FK added when serial tracking lands." Don't add an FK to a deferred entity, and don't silently drop the note.
- **Reject, don't mis-apply:** a value-only `valuation_adjustment` on a FIFO product **throws** ("FIFO value-only adjustment not yet supported — see OPEN decision") in the resolver, not just the doc — an OPEN allocation policy must fail loud, not silently zero.
- **Expand-only discipline:** every column nullable (NULL ⇒ documented default, e.g. `qty_scale` NULL ⇒ integer units), zero DROP / NOT-NULL-retrofit / type-change; FKs added only on the new nullable columns. Verified the generated SQL by reading it.
- **Rule:** for evolving config, stamp the applied strategy on the immutable record (don't re-resolve history); make deferred allocation policies reject loudly; keep quantity/value representation seams (scale columns) even when behavior is integer-only now — they're painful to retrofit.

### Phase-2 close-out — a seam isn't done until it has a WRITER; reconcile invariants toward the real hazard — 2026-06-22
- **Context:** close-out pass on the schema-and-seams work (PR #4). Three findings.
- **Gap A (invariant):** the value-only AVCO adjustment added `total_value_minor + delta` without checking `qty_on_hand` — on zero stock it would orphan value (breaks `qty==0 ⟺ value==0`). Fix: reject value-only when `qty_on_hand <= 0` ("requires qty_on_hand > 0 — cannot value zero stock"). This is an **invariant** gap, NOT M3 (the SQL is already bigint-safe — don't conflate).
- **Gap B (empty guarantee):** `stock_ledger.costing_method_applied` (the seam-#2 historical-integrity stamp) had a column + a passthrough in `appendStockMovement` but **NO caller ever set it → NULL on every row.** The doc asserted an immutability guarantee the code didn't deliver. Fix: `applyValuation` now `UPDATE`s the movement row with the resolved method (after resolve, before branching) — one resolve, every valued movement stamped; DB-tested non-null. **Lesson: a seam with a column but no writer is an empty guarantee — grep for an ASSIGNMENT, not just the column, before claiming integrity.**
- **D1 vs ADR-0008 (reconciled toward D1):** the earlier "financial settings cap at category" would have deleted the working product-level-FIFO path for no real gain — the actual hazard is **changing** an item's method after it has ledger history, not item-level costing itself. Resolution: keep item-level `costing_method`; guarantee = **set-once-immutable-after-first-movement** (`assertCostingMethodSetOnce`, rejects with `CONFLICT`), detectable via the Gap-B stamp. Resolver `allowedLevelsFor` no longer auto-caps costing; `FINANCIAL_LEVELS` is an opt-in cap. ADR-0008 amended, D1 updated.
- **Rule:** reconcile an invariant toward the *actual* hazard (mutation-of-history), not a blunt cap that costs a real feature; and verify a "guarantee" column is actually written before any doc claims it.

### Confirm a router-layer invariant is single-door before trusting it — 2026-06-22
- **Context:** before merging the D1 set-once fix, audited every write path to `product/sku.costing_method` (UPDATE, `.set()`, insert-then-mutate, seeds, services, all routers).
- **Finding:** only `product.update`/`skuUpdate` can UPDATE it (both guarded); CREATE paths set-at-creation (no movements yet → can't violate); seeds set-at-creation via trusted direct insert (never mutate-after-movement). **Single-door confirmed — no bypass today.**
- **Caveat + durable fix:** the guard is application-layer; a *future* raw service UPDATE would bypass it. Opened #7 for a DB-level trigger (reject `costing_method` UPDATE when `stock_ledger` rows exist) — the class-level backstop (same shape as H1→#5 composite-FK). Also noted: the zero-stock invariant is held by TWO mechanisms (AVCO `qty>0` guard + FIFO outright-reject), so a future FIFO value-only path must re-add its own guard.
- **Rule:** a router-only invariant isn't "enforced" until you've grepped every write path AND have a DB-level backstop tracked; "guarded in the two routers I wrote" is the call-site trap (H1 lesson), not the class.

### Recognized class: "correct component, but a write path routes around it" (3rd instance) — 2026-06-22
- **Pattern (now seen three times):** a component is built correctly and tested in isolation, but a primary write path **doesn't call it**, so the guarantee silently doesn't hold in production flows.
  1. **Gap B** — `costing_method_applied` column + passthrough existed, but NO caller set it → NULL on every row (the historical-integrity stamp was empty). Fixed by stamping in `applyValuation`.
  2. **H1** — FK-bypass guard was on three call-sites, but the *class* (every FK-bearing input) wasn't covered → `countStart`/`countLineUpsert`/`adjust`/`reorderEvaluate` bypassed it. Fixed by sweeping the class + a parameterized harness.
  3. **POS↔costing (#8)** — `applyValuation` (AVCO/FIFO engine) is correct + tested, but `pos.createSale` appends sale movements **without calling it** → POS sales don't consume FIFO layers, don't reduce AVCO value, record no COGS, leave `costing_method_applied` NULL, and `avg_cost.qty_on_hand` diverges from the ledger. Found by two independent foundation audits.
- **Why it recurs:** tests call the service directly (so the service passes), and the router/write path is reviewed separately — the *integration* (does the real path invoke the service?) falls between them. A green service suite is NOT evidence the production path uses the service.
- **Rule (check this explicitly every phase):** for every invariant/guarantee, grep that the **primary write path actually invokes** the enforcing component — don't trust "the service is tested." Specifically: (a) does every mutation that should be audited/valued/guarded call the audit/valuation/guard function? (b) is there a column with no writer, a guard with no caller, an engine the main path skips? Treat "asserted in docs/ADRs but not invoked by the write path" as a defect class, not a one-off. Ticket the gap (Gap B→fixed, H1→#5, set-once→#7, POS↔costing→#8).

### Behavior item 1 — collapsing a duplicate resolver: delete the precedence, keep the fetch — 2026-06-22
- **Context:** behavior-pass item 1 — remove `costing.ts`'s inline `product→category→tenant ?? "avco"` precedence and route through the one `settings-resolver.ts`.
- **Distinction that mattered:** the SQL that LEFT JOINs product/category/organization to fetch each level's `costing_method` is *value-fetching* (legitimately the service's job — "services fetch the level values and pass them in"); the `?? ?? ?? "avco"` chain was the *resolution* (the duplicate). Only the precedence was deleted; the fetch stayed. Platform default `'avco'` moved INTO the resolver call (platform level) so resolution — including the default — lives entirely in one place.
- **Refactor-safety signal honored:** costing + resolver DB-gated suites had to pass UNCHANGED. They did (db 44/44, zero test edits) — that's the proof it was behavior-preserving. Had a test needed editing, that would have meant the "refactor" changed behavior → stop.
- **Scope honesty:** of the named operational settings, only costingMethod had a real inline-resolution consumer; removal/oversell/expiry/return have no service consumer yet (seam columns) and `convertUom` resolves by row-scope (sku/product/category), not the scalar resolver — so "adopt the resolver for all of them" was answered by routing the one that applied and explicitly deferring the rest with reasons, not force-fitting.
- **Rule:** when collapsing duplicate logic, separate FETCH from DECIDE — delete only the duplicated decision; a green suite passing *unchanged* is the refactor's correctness proof; don't force unrelated shapes (row-scope lookup) through a scalar resolver just to claim "one path."

### Behavior item 3 — event-contract normalization: align toward the consumer, not toward silence; inject cross-cutting fields centrally — 2026-06-22
- **Context:** M1 — make emitted inventory events match `event-map-phase2.md` so "payload shapes locked" becomes TRUE before any Phase-5 consumer. No schema changes.
- **occurredAt is a cross-cutting envelope concern, not a producer concern.** Injected it ONCE in `emitEvent` (server time, `new Date().toISOString()`), applied LAST in the payload spread so a producer literally cannot override server time (charter §14, device clocks untrusted). Doing it per-producer would have been ~10 edit sites and one missed site = a silent gap. **Rule:** a field that must appear on every event and must be server-authoritative belongs in the single emit chokepoint, not sprinkled at call sites — and "applied last" is the mechanical guarantee it wins.
- **"Make both match" means DECIDE which shape is right, then converge — not rename to silence the diff.** For `inventory.adjusted`, the map wanted `unitCostMinor?`; the code emitted `cogsMinor`. The right field for the eventual P5 consumer is `cogsMinor` (a negative adjustment's value can ONLY be expressed as the valuation-computed COGS, which is exactly what posts to shrinkage) — so the **map** was wrong, not the code; I updated the map and kept the code. The opposite call for `count_posted` (map's base/Minor names were right → aligned the code). **Rule:** when emitted ≠ mapped, ask "which does the consumer actually need?" and move the other one — don't reflexively change code to match a doc or vice-versa.
- **Honesty over completeness for divergences you can't close in-scope.** `valuation_updated` "should" carry `totalValueMinor`/`qtyOnHandBase` (the qty=0⟺value=0 integrity fields), but `ValuationResult` doesn't expose post-movement on-hand value — surfacing them needs a service-return extension (out of an event-field-alignment pass). Documented it as **DEFERRED to Phase-5** in the map rather than faking the fields. Same for `stock_discrepancy` staying product-level until #8 (Phase 4). **Rule:** a contract doc that claims a field the code can't produce is worse than one that says "deferred, here's why" — never lock a shape you don't actually emit.
- **Mapped-but-unemitted ≠ broken.** `lot_expiring`/`lot_expired` have no Phase-2 producer (need a scheduled evaluator); `uom_converted` is folded into receive/sale qty by design. Kept all three as locked contracts with explicit DEFERRED/FOLDED status and kept them OUT of `DomainEventType` (nothing emits them) — the map's value is locking the shape now, not pretending it's wired.
- **Test outcome distinction honored:** zero existing tests broke; the ONLY test edit was an **additive** occurredAt contract guard (present + server-overrides-producer) — which is the "test changed because the contract intentionally changed" case, not "test broke unexpectedly." Service-return field names (`StockCountPostingAdjustment`) were deliberately preserved (normalize only at the emit site) so the costing/inventory DB-gated suites pass unchanged. db 44→45 (+1 new test), api 11/11.

### Reserve deferred event fields as nullable — don't ship them absent — 2026-06-22
- **Context:** the prior pass documented `inventory.adjusted.approvedBy` and `inventory.valuation_updated.totalValueMinor`/`qtyOnHandBase` as "deferred" but **omitted them from the emitted payload** (the field simply wasn't there).
- **Why that's a latent break:** a payload shape becomes a CONTRACT the moment a consumer binds it (Phase 5). If a field is *absent* now and *appears* later, a strict consumer (schema-validated, or one that distinguishes "key missing" from "key null") sees a **shape change** — i.e. populating the deferred field later is a breaking change, defeating the whole point of locking shapes early. A field that is **present-but-null** now and **present-with-value** later is purely additive.
- **Fix:** reserve deferred fields as **nullable, emitted `null` today** — `approvedBy: null` (audit-critical: who approved a manual write-off/up is exactly what a Phase-5 audit consumer needs), `totalValueMinor: null`/`qtyOnHandBase: null` (the qty=0⟺value=0 integrity fields, bound when `ValuationResult` is extended). Same pattern already used for `serialIds: null` on `received`. Map contracts updated to list them as RESERVED nullable. Locked mechanically: the integration test asserts the keys are **PRESENT** (`toHaveProperty`), not just nullable — so a future refactor that drops the key fails the gate.
- **Rule:** when you defer a field on an event whose shape will be consumed later, **reserve it nullable and emit `null` now** — never ship it absent. "Present-but-null → present-with-value" is additive; "absent → present" is breaking. Assert *presence* in a test so the reservation can't silently regress.

### Phase-3 commit 0 — drizzle-kit emits a composite FK BEFORE its target UNIQUE; reorder by hand — 2026-06-22
- **Context:** Phase-3 commit 0 (parked debt #5 + #7). Added `UNIQUE(tenant_id, id)` on company/location/product/sku/lot + `UNIQUE(tenant_id, company_id, id)` on location + an additive composite FK `location(tenant_id, company_id) → company(tenant_id, id)`, via `drizzle-kit generate`.
- **Bug caught by reading the generated SQL (not by a tool):** drizzle-kit emitted the **composite FK as statement 1**, then the `company_tenant_id_uq` UNIQUE it references as statement 2. A composite FK requires its referenced columns to already carry a UNIQUE/PK constraint, so applying it in that order **fails** (`there is no unique constraint matching given keys`). Drizzle does not topologically order FK-after-its-target-unique within a single generated migration.
- **Fix:** hand-reordered `0012_*.sql` so all UNIQUE targets are created **before** the composite FK; verified the full chain (0000→0012) applies in a disposable PG18. Triggers/functions (the #7 set-once backstop) are appended to the generated `.sql` and are NOT in drizzle's snapshot model — that's fine (snapshot diffs tables/columns/constraints, not triggers), so they don't cause drift on the next `generate`.
- **#7 set-once trigger correctness (Codex F4):** `stock_ledger.sku_id` is nullable — a SKU's `costing_method` must be locked once **product-level** movements (`sku_id IS NULL`) exist for its product, not only SKU-direct movements. Trigger: product-update blocks on any `product_id` row; sku-update blocks on `sku_id = NEW.id` OR a product-level row for `NEW.product_id`. The trigger reads `stock_ledger` under the caller's tenant GUC (RLS-scoped) — consistent because the UPDATE target row is matched under the same GUC.
- **Rule:** always **read the generated migration SQL** before trusting it — `drizzle-kit generate` does not guarantee intra-migration statement ordering for FK-vs-its-target-unique; create the UNIQUE/PK targets first. A composite `(tenant_id, x_id)` FK is the durable DB-layer kill for the H1 cross-tenant class — prove it with a **raw cross-tenant insert** test (bypassing the router guard), not just a router-level test.

### Phase-3 commit 1 — tightening a `text` column to `text({enum})` narrows EVERY insert call-site; enforce parent-of-tree integrity with a composite FK (a CHECK can't read the parent) — 2026-06-22
- **Context:** commit 1 — unified self-referential `location` tree (`type`→enum/CHECK, `parent_location_id`, flags, capacity seam).
- **Type-error caught by `check-types` (not at the edit site):** changing `location.type` from `text("type")` to `text("type", { enum: LOCATION_TYPES })` narrowed the Drizzle insert type from `string` to the union. A trusted **seed** call-site (`ensureLocation(type: string)` and the `locationType: string` input) then failed to typecheck (`No overload matches this call`). **Fix = narrow the param chain to `(typeof LOCATION_TYPES)[number]`, NOT a cast** — a cast would hide a real mismatch. Biome then auto-rewrote the now-type-only import to `import { type LOCATION_TYPES }`.
- **Rule:** when you tighten an extensible `text` column to `text({enum})` (+ DB CHECK), grep every INSERT/UPDATE call-site that passes that column — each one that passed a wider `string` now breaks; narrow the source types through the chain rather than casting at the boundary. `check-types` is the gate that catches this; run it after any column-narrowing.
- **Tree integrity is a composite-FK job, not a CHECK:** a node-must-share-company-with-its-parent invariant **cannot** be a CHECK (a CHECK can't read the referenced parent row — same shape as Codex-F3). Enforce it with a self-referential composite FK `(tenant_id, company_id, parent_location_id) → location(tenant_id, company_id, id)` (reusing the commit-0 `(tenant_id,company_id,id)` UNIQUE target): a child can only nest under a parent in the SAME tenant AND company, NULL parent (top-level) unconstrained. Proven by a raw cross-company + cross-tenant child-insert rejection test.
