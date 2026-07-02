# RetailOS — Sonnet Execution Playbook (standing guardrails)

> **Audience:** every Claude **Sonnet** (or other non-Fable) session executing RetailOS work.
> **Purpose:** distill the charter, lessons-learned, and owner directives into mechanical rules a
> session can follow without re-deriving them. This file does NOT replace the charter or
> `lessons-learned.md` — it tells you the order to read them and the traps they encode.
> **Owner:** Kareem. Fable sessions maintain this file; Sonnet sessions follow it and may append
> to `lessons-learned.md` but should not rewrite this playbook.

---

## 0. Session-start ritual (every session, in this order)

1. Read `CLAUDE.md` (repo root) — it @-imports the charter and lessons-learned.
2. Read `docs/architecture/PROGRESS.md` top block — the live task board. **Claim a lane before writing.**
3. Read this playbook end to end.
4. Read the specific implementation plan you were pointed at (e.g.
   `docs/plans/2026-07-02-sonnet-tranche-1-ports-and-cleanup.md`). Execute it with
   `superpowers:executing-plans` (inline) or `superpowers:subagent-driven-development`.
5. `git status` + `git log --oneline -5` — confirm you are on the branch the plan names,
   with a clean tree. If not, STOP and report; do not "fix" the branch state.

After any context compaction: re-read items 2–4 before resuming. Do not trust your summary's
recollection of gate commands or file paths — re-read them here.

## 1. Hard prohibitions (no exceptions, no creativity)

- **NEVER deploy to or touch production.** No `docker compose` against prod, no pushes that
  trigger deploys, no prod DB connections. Master carries a revert state; a blind deploy
  regresses prod. Deploy happens only when Kareem explicitly asks, in his session.
- **NEVER stop/restart/remove containers by image filter or list position.** Protected
  containers: `postgres-central`, `redis-shared`, Pangolin/Traefik/Gerbil. The ONLY sanctioned
  test-DB lifecycle is `scripts/gate-db.sh {up|env|psql|down|status}` — it records its own
  container id and refuses to touch anything else.
- **NEVER edit UTF-8 docs with `sed`/`perl`/`awk`.** Use the Edit/Write tools or a
  `python3`/native-fs script. The pre-commit mojibake guard will reject corruption — if it
  fires, restore from `git show HEAD:<file>` and re-apply with Edit. Never `--no-verify`.
- **NEVER commit secrets, tokens, or plaintext credentials.** All secrets live in Infisical
  (`--domain=https://infisical.karetechsolutions.com`); config references `${ENV}` placeholders only.
- **NEVER use native `pgEnum`** for extensible value sets — `text({ enum: [...] })` + CHECK/Zod.
- **NEVER use floats for money or quantities.** Integer minor units; amount + currency + scale
  travel together; `bigint(mode: "number")` columns; `Number.isSafeInteger` guards; division
  goes through `mulDivRound` (BigInt).
- **NEVER hand-write a Drizzle migration SQL file without journal metadata.** See §5.
- **NEVER touch the frozen files:** `packages/db/src/services/costing.ts` and
  `packages/db/src/services/costing.rls.test.ts` are 🔒 FROZEN. If a task seems to require
  changing them, STOP and surface it — that is a change request for the owner, not a task.
- **NEVER guess an open business decision.** If a plan or doc marks a decision OPEN /
  "Kareem's to lock" (oversell policy, FIFO value-only allocation, accrual-vs-cash, …),
  implement the reject-loudly path or defer — never pick a side silently.
- **NEVER merge to master, push, or open PRs unless the plan or Kareem says to.**
  Work stays on the named feature branch.

## 2. The gate suite (run before EVERY commit claim of "done")

```bash
bun run check-types                 # expect: 7/7 packages, zero errors
bun x ultracite check               # expect: no diagnostics
bun run check:mojibake              # expect: clean
scripts/gate-db.sh up               # disposable PG18; roles.sql; migrate 0000→latest
eval "$(scripts/gate-db.sh env)"
bun run test                        # see the reading rule below
scripts/gate-db.sh down             # removes ONLY the gate container; prints postgres-central status
bun -F web build                    # expect: green (only when web files changed)
```

**Reading rule for tests:** the result must say **"N passed" with ZERO "skipped"** in the
`packages/db` and `packages/api` suites. A `skipIf(!RLS_TEST_DATABASE_URL)` suite that skipped
is a **silent non-gate** — it proves nothing (this bit us in CI once). If suites skip, your env
exports didn't reach the child process; fix that before proceeding.

Current green baseline (2026-07-02): **db 99 passed · api 70 passed · config 5 · ui 3**, plus
`bunx vitest run apps/web/src/lib/product-import.test.ts` → 17 passed. Your change should only
ever move these numbers **up**.

## 3. Recurring defect classes — check EVERY task against this list

These are the classes that adversarial reviews keep finding in this repo. Before claiming a
task done, walk this list explicitly:

1. **#8 class — "correct component, write path routes around it."** For every
   invariant/guard/audit/valuation: grep that the PRIMARY write path actually **invokes** the
   enforcing function. A tested service the router never calls is a defect. A column with no
   writer is an empty guarantee.
2. **H1 class — cross-tenant FK bypass.** Postgres FK checks BYPASS RLS. Every mutation input
   id (locationId, skuId, lotId, …) needs a tenant-scoped existence read (`assert*Visible`)
   inside the same `withTenant` tx — AND validate **tuple relationships** (SKU belongs to
   product, line belongs to header), not each id in isolation. New FK-bearing inputs get a row
   in the parameterized harness in `vs1.integration.test.ts` ("rejects cross-tenant FK
   references on every guarded FK input").
3. **TOCTOU / lock-the-right-row.** A status-guarded state machine needs `SELECT … FOR UPDATE`
   on the STATE row. Two sibling mutations that contend must lock the SAME row (not a related
   one). A check-then-consume needs the same advisory lock the mutator takes, BEFORE the read.
4. **Sibling-path parity.** A guard or DTO scrub applied on a read applies to its WRITE sibling
   too: `deleted_at IS NULL` in every mutation predicate targeting soft-deletable rows;
   mutation `.returning()` responses scrubbed of every field the read DTO scrubs (objectKey,
   cogs, margin — assert with `not.toHaveProperty`).
5. **Stamp the irreproducible fact.** Anything resolved from mutable config at transaction time
   (costing method, FX rate, tax rate, server time) gets stamped on the immutable row/event —
   history is never re-resolved. Emit cross-cutting envelope fields (occurredAt) in the single
   emit chokepoint, applied last.
6. **Consumer-side idempotency.** Any event consumer with side effects needs its own dedup key
   `(tenant, outbox_event_id, consumer_kind)` written in the SAME tx. Producer idempotency does
   not transfer.
7. **RLS on every new tenant table, same commit.** `drizzle-kit generate` does NOT emit RLS —
   hand-append the fail-closed `ENABLE + FORCE + tenant_isolation` block to the generated SQL.
   The `tenant-isolation-coverage` test blocks you mechanically if you forget.
8. **Hermetic tests.** Any test that inserts rows updates the FK-safe tenant cleanup in the
   same PR — including "read-only" endpoint tests that allocate through setup. Prove a rerun
   passes on a dirty DB, not just the first run.
9. **Frontend cache discipline.** `router.invalidate()` does NOT refetch `useQuery` — call the
   query's own `refetch()`/queryClient invalidation in `onSuccess`. Router invalidate is only
   for route `loader` data.
10. **Route nesting.** Any `X.tsx` with an `X.$id.tsx` sibling is a LAYOUT and must render
    `<Outlet/>` — or become `X.index.tsx`. `routeTree.gen.ts` is committed runtime source;
    commit the pre-commit hook's regenerated version (do not fight it with a standalone `tsr generate`).
11. **UI is not verified until rendered.** Types + build + tests do not prove a page renders.
    If you cannot run a browser, say so explicitly in your report — never claim a UI surface
    "works", only that it builds and type-checks.
12. **DB error assertions.** Drizzle/pg puts the Postgres message on `error.cause.message`.
    Assert on `` `${err.message} ${err.cause?.message}` `` and assert the SPECIFIC failure
    (right error text, not merely "it threw").

## 4. Money, events, and API conventions (quick card)

- Backend owns ALL business math. The client renders DTOs; `formatMoney` is display-only. The
  single sanctioned input-boundary conversion is `displayToMinor(value, scale)`
  (`Math.round(Number(value) * 10 ** scale)`, null on invalid/negative).
- New routers follow the `membershipRouter` shape: `tenantProcedure` → `ctx = context.requestContext`
  → `withTenant(db, ctx.tenantId, async (tx) => { await assertPermission(tx, ctx, "…"); … })`.
  Actor id is `ctx.actorUserId`. Every mutation calls `recordAudit`. Every read returns a
  scrubbed DTO (no cogs/margin/objectKey/internal keys).
- Reads that power UI actions return `availableActions` booleans that MIRROR the action
  endpoint's exact guards, and a test proves the action endpoint independently rejects an
  ungranted caller.
- Deferred event fields ship **present-but-null** (reserved nullable), never absent; a test
  asserts key PRESENCE (`toHaveProperty`).
- Raw `tx.execute(sql…)` returns `int8` as strings — normalize (`asNumber`) at the service
  boundary before arithmetic.

## 5. Migration procedure (the only way to add one)

1. Edit/add the Drizzle schema files under `packages/db/src/schema/` (register new files in
   `schema/index.ts`).
2. `bun --cwd packages/db db:generate` — this writes the next-numbered SQL + snapshot + journal
   entry coherently. **Never** hand-copy SQL/journal/snapshot from another branch (numbering
   collides; snapshots drift).
3. **Read the generated SQL.** drizzle-kit does not order a composite FK after its target
   UNIQUE — reorder by hand if needed. Check `column + 1` overflow traps in CHECKs/ranges.
4. Hand-append the fail-closed RLS block for every new tenant-owned table (copy the DO-block
   shape from `0024_salty_carlie_cooper.sql`), plus any triggers. Triggers/policies are not in
   the snapshot model — appending them does not cause generate-drift.
5. Prove the FULL chain applies on a fresh DB: `scripts/gate-db.sh down && scripts/gate-db.sh up`.
6. Run the gate suite (§2). `tenant-isolation-coverage` must be green.

New tenant table checklist: `tenant_id` text + composite `UNIQUE(tenant_id, id)` target +
RLS block + coverage-gate green + H1 tuple guards on every router input that references it.

## 6. Stop-and-ask triggers (end the task and surface to Kareem instead)

- A plan step contradicts the charter, a locked decision, or this playbook.
- The task requires touching frozen files, master, prod, or shared infra.
- An OPEN owner decision blocks correctness (don't guess — list the options + your recommendation).
- A gate stays red after 2 genuine fix attempts and the failure implicates pre-existing code.
- You'd need to delete or overwrite something you didn't create and the plan doesn't name it.
- Anything requiring paid/external account actions, or credentials you don't have.

## 7. Phase entry criteria (do NOT start a phase whose gate isn't met)

| Phase | Status | Entry gate before ANY code |
|---|---|---|
| 4 remainder (offline queue, Tauri POS) | ports in tranche-1 plan | tranche-1 plan tasks only; full offline queue needs its own plan pass |
| 5 Accounting | plan HARDENED, **NOT approved** | Kareem locks the open decisions in `phase-5-implementation-plan.md` §5 (accrual-vs-cash, functional-currency model, sync-vs-async posting, COA template) — then a Fable/owner session writes the task-level plan |
| 6 Procurement (beyond ported foundations) | plan HARDENED, **NOT approved** | Kareem locks `phase-6-implementation-plan.md` §5 decisions (esp. FIFO landed-cost layer policy — `applyValuation` deliberately THROWS on FIFO value-only until then) |
| 7–13 | not started | module spec + competitive analysis (charter §41/§42) + owner approval first |

“Hardening a plan is NOT authorization to build.” If a plan file says NOT APPROVED, it isn't.

## 8. Working style for a limited-context session

- **One task per commit.** Small, reviewable, gates green, `PROGRESS.md` updated in the SAME
  commit (task board + one changelog line). Commit messages: `feat(scope): …` etc., ending with
  the Co-Authored-By/session trailer your harness supplies.
- **Don't re-derive settled facts** — PROGRESS.md "verified facts" and lessons-learned are
  authoritative. Don't re-litigate locked decisions.
- **Don't fan out subagents that spawn subagents** (rate-limit storms). Prefer sequential work;
  use at most simple, non-spawning helpers for search.
- **When blocked on verification** (no browser, no external docs), write what you CAN verify
  from the repo, mark the rest explicitly PENDING — never fabricate.
- **Append to `lessons-learned.md`** after any task with a correction/surprise/contradiction —
  the fields are `Date | Context | Mistake | Root cause | Fix | Rule`.
