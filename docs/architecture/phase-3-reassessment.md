# Phase 3 — Architecture Reassessment (charter §45)

- **Status:** end-of-phase reassessment for Phase 3 (Locations / Warehouses / Bonds / Transfers), branch `phase-3-overnight`. NOT merged — for owner review.
- **Cadence (§45):** at the end of every phase, review architecture, `lessons-learned.md`, tech debt, competitor changes (§41), performance (§44), security (§29), and usability; record improvements as ADRs (§34). This complements the per-task learning loop (§40).
- **Scope reviewed:** commits 0–6 on `phase-3-overnight` (parked-debt #5/#7 → location tree → transfers → bonded receive → bond release → RBAC/seed/contracts). Phase 3 introduced NO UI, POS, GL, ecommerce, or offline-queue (per the standing build order).

## 1. What Phase 3 delivered (against the locked plan)

| Deliverable | State | Proof |
|---|---|---|
| Parked debt #5 (composite `(tenant_id,id)` FKs) | ✅ | raw cross-tenant insert rejected at DB layer (commit 0) |
| Parked debt #7 (set-once costing trigger) | ✅ | raw UPDATE-after-movement rejected (commit 0); re-confirmed it blocks the commit-5 product flip |
| Unified self-referential `location` tree + flags + capacity seam | ✅ | commit 1; 3-col composite parent FK (child shares tenant+company) |
| Two-step intra-company transfers, qty conserved | ✅ | commit 2; raw cross-company/cross-tenant insert rejected |
| Transfer VALUE conservation (INV-2) | ✅ | commit 3; `costing.ts` +202/−0 additive; frozen suite byte-identical |
| Bonded receiving + INV-3 separation | ✅ | commit 4; bonded value isolated; AVCO-only enforced |
| Bond release + duty (INV-4/5) | ✅ | commit 5; transfer + value-only duty add; F1/F2/F3 fixed |
| RBAC per-role split + demo seed + API contracts | ✅ | commit 6; warehouse/bond_officer roles; `seedPhase3`; `phase-3-api-contracts.md` |

All gates green throughout: fresh PG18 migration chain 0000→0016, `db 70/70 + api 21/21` (zero skips), check-types/biome/mojibake clean, HARD GATE held (no commit modified frozen `costing.ts` except the planned additive commit-3 touch).

## 2. Lessons-learned harvest (this phase)

The dominant recurring theme is **"a guarantee is only real where the production write path exercises it"** — now seen ≥5 times (Gap B, H1, #8 POS↔costing, commit-5 F1 stamp-as-gate, commit-5 #8 router-write-path). The durable mechanical defenses that emerged:

- **Composite `(tenant_id, …)` FKs** are the durable kill for the H1 cross-tenant class — proven by raw-insert tests that bypass the router guard, not just router tests.
- **Lock the cell at the SAME key the mutator uses, before the read** — the TOCTOU pattern (commit-3 HIGH-1, commit-5 F2). A lock-free read-guard followed by a consuming write is always a race.
- **Make a gate call the SAME resolver the consumer uses** (commit-5 F1) — a guard that checks a value the engine re-derives independently can diverge.
- **Read the generated migration SQL** — drizzle-kit does not order FK-after-its-target-unique, nor emit RLS; both must be hand-corrected (commits 0, 2, 5).
- **Confirm the gate actually executed** — turbo strict-env was silently skipping DB suites (commit 3); declare skip-deciding env on the `test` task via `env` (hash-affecting), not `passThroughEnv`.

## 3. Technical debt — carried & newly identified

**Paid this phase:** #5 (composite FK), #7 (set-once trigger).

**Still parked (owner-ratified, later phases):**
- **#6** — valuation math in JS `number` loses precision >2^53; needs a BigInt `mulDivRound` with a chosen rounding mode. **Phase-5 blocker before a large tenant onboards.** Phase-3 transfer/duty value is exact-integer (no division on the hot path), so not a Phase-3 blocker.
- **#8** — POS↔costing wiring + `cost_reconciliation` emit (Phase 4).
- **`valuation_updated` enrichment** (totalValue/qtyOnHand) — Phase 5.

**Newly identified (this phase):**
- **TD-P3-1 (the commit-5 F1 decision):** bonded release rejects on a tenant/category costing flip rather than forcing AVCO from the stamp through the engine. Forcing-from-stamp needs a costing-method override threaded through the frozen transfer/`costing.ts` engine — a deliberate change-request, not done autonomously. **Owner decision pending** (see OVERNIGHT-LOG 🔒).
- **TD-P3-2:** `organization`/`category` `costing_method` have NO set-once guard (only product/sku do, via #7). A tenant CAN flip costing while holding valued stock. Consider extending the trigger or an effective-dated settings-history table.
- **TD-P3-3:** the location tree exposes `parent_location_id`/flags/capacity only via seed/import — no `location.create` tree-builder route or WMS putaway/pick routing yet (deferred to a WMS phase, by design).
- **TD-P3-4:** bond release is by bonded on-hand, not per-receipt-line cumulative qty; multiple receipts of the same SKU pool at the bonded cell. Acceptable (on-hand is the real physical constraint), but per-line traceability of *which receipt* a release drew from is approximate. Revisit if customs audit requires receipt-level lineage.

## 4. Performance (§44)

No hot-path UI in Phase 3. Service-level notes:
- Every stock mutation takes a per-cell advisory lock; transfers add a transfer-row `FOR UPDATE`. Contention is per (location, sku) cell — fine at expected volumes; revisit if a single cell sees high concurrent write fan-in.
- `resolveCostingMethod` runs an extra LEFT-JOIN query per release line (the F1 consistency check). Negligible at clearance volumes; could be batched if bulk releases appear.
- Transfer/release value math is exact-integer, division-free on the hot path → no rounding cost.

## 5. Security (§29)

- Fail-closed RLS (ENABLE+FORCE) on every new tenant-owned table (`stock_transfer*`, `bond_receipt*`, `bond_release*`); coverage gate enforces it mechanically.
- H1 cross-tenant FK-bypass closed at the DB layer (composite FKs) for ALL callers, not just guarded routers — proven by raw-insert tests.
- F4 cross-company hole closed by 3-col `(tenant,company,location)` composite FKs.
- RBAC separation of duties added (warehouse vs bond_officer); release is RBAC-immediate requiring both bond perms.
- All mutations audited; events server-stamped (`occurredAt`).

## 6. Usability / competitive (§41)

Bonded-warehouse + intra-company transfers + duty-on-release are the Caribbean/import-heavy differentiators (charter §12) that most SMB POS competitors lack. The bonded-vs-released separation (INV-3) and duty-into-cost-basis (INV-5) match Cin7/Fishbowl-class capability. No competitive regressions. UI for these surfaces is a later phase.

## 7. Recommended ADRs / follow-ups

- **ADR 0009** (this commit) — Phase-3 module architecture: unified location tree, two-step intra-company transfers, bond release = transfer + value-only duty, AVCO-only bonded, the H1 composite-FK kill, the #7 set-once trigger, and the commit-5 F1 stamp/live-consistency rule.
- **Owner decisions to resolve** (OVERNIGHT-LOG 🔒): TD-P3-1 (reject-vs-force-AVCO on costing drift) and TD-P3-2 (tenant/category costing set-once guard).
- **Phase-4 entry:** wire #8 (POS↔costing) before/with POS sale valuation; keep #6 (BigInt mulDivRound) as the Phase-5 precision blocker.
