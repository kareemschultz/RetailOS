# HANDOFF TO CODEX — RetailOS (Claude Code session limit reached, 2026-06-28)

You are taking over build/orchestration for **RetailOS**, a deployed multi-tenant retail ERP / POS / SaaS.
**Read these docs FIRST, in order — they are the contract:**
- `docs/architecture/engineering-principles.md` — the constitution (principles #1–#20; esp. #8 write-path-through-owning-service, #19 one-writer-per-tree, #20 action-availability, and the 🔒 FROZEN 12-step Development Loop).
- `docs/architecture/lessons-learned.md` — the recurring defect class + the just-recorded shadcn-Lyra-radius lesson + read-vendor-docs-first.
- `docs/architecture/PROGRESS.md` — live cross-agent state.
- `docs/architecture/commerce-ui-plan.md` — **the plan you are executing** (CommerceO back-office + Shopix storefront), §6 decisions + §7 Step-1 task.
- `docs/architecture/frontend-strategy.md` §1 + `ui-admin-shell-findings.md` — the CommerceO/AdminCN governance.
- `CLAUDE.md` + `docs/architecture/retailos-master-charter.md` — entry point + charter.

## Non-negotiable working rules (why this project has near-zero defects — do not relax)
1. **Never merge without owner approval.** Every task ends at "PR open, awaiting owner review." Do NOT auto-merge.
2. **One writer per tree** (#19).
3. **Backend owns ALL business math** — no money/tax/COGS arithmetic on the frontend; the client renders DTOs. (A dashboard client-side-aggregation HIGH was caught + fixed this session — `reports.dashboardSummary` now aggregates server-side. Don't reintroduce it.)
4. **Action-availability** (#20): backend returns `availableActions`, frontend renders, backend independently enforces. UI visibility is never security.
5. **Idempotency on every write from line one** (stable key per attempt + in-flight guard). The recurring defect class is "a guarantee that holds in isolation but the write/render/enumeration path routes around it" — make the bad thing structurally inexpressible, not just tested-against.
6. **Adversarial review before every PR.** Run a real adversarial pass; fold CRITICAL/HIGH. Read CI from logs, not the green checkmark (local-green has lied — the route-tree + turbo-env lessons).
7. **shadcn Studio specifics (in lessons-learned):** project `style` is **`base-lyra`**, which is square-by-design and **LOCKS the radius token** — Studio components install with `rounded-none` baked in. Do **NOT** run `shadcn apply <theme>.json` (it re-installs components square). For theme changes, merge only the `:root`/`.dark` CSS variables by hand. New Studio block installs come square — strip `rounded-*` and map to the radius tokens. **READ THE STUDIO DOCS** before diagnosing any theming issue (`/docs/getting-started/{theme-generator,blocks,how-to-use-shadcn-cli}`).
8. **Studio block assembly:** CommerceO (Next.js admin) + Shopix (Figma storefront). Port the real source, re-theme to RetailOS tokens, wire to the real oRPC contracts + Better Auth. Report sourced-vs-adapted per component in the PR body. Confirm block slugs with a live MCP probe (slugs differ from display names).

## Owner decisions just settled (inherit as LOCKED)
- **First build: CommerceO-skin the existing Dashboard + Products** — zero new backend (they already wire to `reports.dashboardSummary` / `product.catalog`). See `commerce-ui-plan.md` §7.
- **Back-office nav: keep the AdminCN sidebar NOW.** nav-style (sidebar vs top-nav) becomes a *future* `tenant_ui_config.nav_layout` white-label option — **do NOT build the toggle now** (module-aware-components trap before the white-label design exists).

## Immediate state / first actions
- **PR #45** is OPEN, not merged (login redesign + Corporate theme + token-driven radius fix + `reports.dashboardSummary` server-aggregation + `product.catalog` DTO + error states + `commerce-ui-plan.md`). **Confirm it is merged before building on it** — branch off clean `master`, do NOT stack on the unmerged branch.
- Then: **CommerceO-skin Dashboard + Products** (Step 1, zero backend, on the existing sidebar). Gates → deploy → verify live (Playwright, desktop + mobile, light + dark) → Codex-gate → PR → STOP.
- Next backend gap: **`product` has no image column** — both a rich product table and the storefront need media. First small commerce backend add (own branch, RLS, DTO-safe, tested, own PR). Then Phase 8/7/6 backends (orders/cart/checkout, customers, vendors) — each owner-gated + adversarially reviewed before built.
- **Storefront (Shopix) is a planned phase**, not a next step: hard shared-inventory requirement (§21 — never separate ecommerce inventory) + a NEW public-surface threat model (catalog reachable without a session → stricter DTO discipline, tenant resolution without a session). Do NOT build without the owner-gated plan + adversarial review.

## Verification + deploy
- **Tests:** disposable PG18 container per run (`roles.sql` → migrate → test as `retailos_app`, a non-superuser with `bypassrls=false`; NOT the shared container). Confirm suites RAN ("N passed", not "N skipped") — turbo strict-env strips DB env unless declared on the task `env`.
- **Deploy (live):** web + server containers on the `pangolin` docker network behind Pangolin/Traefik (`retailos.karetechsolutions.com` / `retailos-api.karetechsolutions.com`). Secrets via Infisical (`/credentials/retailos`); deploy with `infisical run … -- docker compose -f docker-compose.prod.yml up -d --build {app|server}`. Web build can exceed 2 min — use a longer timeout. Verify visually with Playwright (demo login `admin@retailos.demo`).

Update `PROGRESS.md` + `lessons-learned.md` in the same commit as each change. When in doubt, STOP and ask the owner — every irreversible step is the owner's call.
