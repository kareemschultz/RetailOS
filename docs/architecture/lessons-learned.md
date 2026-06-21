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
