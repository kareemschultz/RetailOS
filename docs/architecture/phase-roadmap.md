# RetailOS Phase Roadmap

Phase sequencing per charter §31. Status tracked here; update as phases progress. The §45 reassessment loop runs at the **end of every phase** — review architecture, `lessons-learned.md`, tech debt, competitor changes (§41), performance (§44), security (§29), usability — and record improvements as ADRs.

| Phase | Scope (charter §31) | Status |
|---|---|---|
| **0 — Architecture & Foundation** | Charter review, gap analysis, domain model, ERD, governance docs, env strategy, registry/MCP + UI sourcing, design tokens, CI/test infra, Vertical Slice #1 design | **✅ Complete (locked-in)** |
| 1 — Identity, Tenant, RBAC, Audit | Better Auth plugins, tenant context, RBAC/entitlements, audit, RLS foundation | **✅ Done** (VS#1 shipped the spine — PR #1 merged to master; fail-closed RLS, 3-role model, `withTenant`, audit/outbox/idempotency) |
| 2 — Products & Inventory Ledger | products/variants/SKU/barcode, stock ledger, multi-UoM, serial/batch/expiry | **✅ FULLY COMPLETE / 🔒 FROZEN** — schema (PR #4, `d39428d`) + behavior pass (PR #9, `72b2100`: item 1 single resolver, item 3 M1 event-contract normalization, reserved nullable fields) **merged to master; CI 4/4 green**. Narrative archived in `phase-2-complete.md`. "Frozen" = any further Phase-2 work is a **change request**. **PARKED → later phases:** item 2 `cost_reconciliation` emit + POS↔costing wiring (Phase 4, #8); #6 precision/`mulDivRound` (Phase 5); #7 set-once DB-trigger backstop (Phase 3); #5 composite-FK `(tenant_id,id)` (Phase 3); `valuation_updated` totalValue/qtyOnHand enrichment (Phase 5). |
| 3 — Locations, Warehouses, Bonds | companies/locations/warehouses/bonded, transfers, bond release, bins | **✅ MERGED to master (commits 0–7, `67e6120`); CI green, db 70/70 + api 21/21 zero skips.** Graduated via PRs #18 (turbo CI fix) → #17 (commit 3) → #19 (commits 4–7). #5 composite-FK + #7 set-once trigger paid; unified self-referential `location` tree + flags + capacity seam; two-step intra-company value-conserving transfers (INV-1/2); bonded receiving + INV-3 separation (AVCO-only); bond release = approved transfer + value-only duty add (INV-4/5, RBAC-immediate); RBAC per-role split + `seedPhase3` + `phase-3-api-contracts.md`; §45 reassessment + ADR 0009. Codex-reviewed per commit. **🔒 owner decisions LOCKED:** TD-P3-1 = reject+reconcile; TD-P3-2 = defer to Phase 5. Docs: `phase-3-implementation-plan.md`, `phase-3-gap-analysis.md`, `module-specs/locations-warehouses-bonds.md`, `event-map-phase3.md`, `phase-3-api-contracts.md`, `phase-3-reassessment.md`, ADR 0009. |
| 4 — POS & Offline Queue | sale mutation, payments, receipts, shifts, offline queue, idempotency, number blocks, Tauri POS | **📋 PLANNING COMPLETE / contracts ACCOUNTING-COMPLETE / implementation-ready (NOT built)** — research done, Codex-reviewed (3 CRIT + 4 HIGH folded), **all 7 🔒 decisions LOCKED**; `event-map-phase4.md` hardened through **4 adversarial gates** (payload→symmetry→multi-currency→commission) + governed by **POST-1/POST-2** invariants and **validated against the authoritative `posting-model.md`** (every GL journal-line amount carried/reserved). Build = a separate session (owner authorizes). Docs: plan, `event-map-phase4.md`, **`posting-model.md`**, `event-versioning.md`, `competitive/pos.md`, `cross-phase-dependencies.md`. |
| 5 — Accounting Foundation | COA, journals, AR/AP, tax, cash clearing, money rules, gift-card/store-credit liabilities | **📋 Plan HARDENED (skeleton; NOT built)** — Codex GL review folded (3 CRIT + 4 HIGH + 3 MED: consumer-side idempotency, event ordering/parking, structural balance/period-close); 4 open decisions surfaced. The highest-stakes design — deepen before code. Docs: `phase-5-implementation-plan.md`, `competitive/accounting.md`. |
| 6 — Procurement | suppliers, POs, GRNs, vendor bills, landed costs | **📋 Plan HARDENED (skeleton; NOT built)** — Codex review folded (6 HIGH + 6 MED: shared-primitive/separate-wrappers, FIFO landed-cost layer policy, AP event seam, RLS/H1). 5 open decisions. Docs: `phase-6-implementation-plan.md`, `competitive/procurement.md`. |
| 7 — CRM | customers, leads, opportunities, loyalty, credit limits | Not started |
| 8 — Ecommerce | storefront, cart, checkout, online orders, shared-inventory sync | Not started |
| 9 — Hardware Bridge | abstraction, print protocol, Tauri bridge, daemon, device registration | Not started |
| 10 — Edge Hub | Dockerized hub, LAN sync, local coordination, cloud sync, reconnection testing | Not started |
| 11 — SaaS, Licensing, White-Label | billing, feature flags, license model, custom domains/SMTP/branding, entitlements | Not started |
| 12 — Analytics, Reporting, Insights | dashboards, reports, correlated insights, exports, read models | Not started |
| 13 — Enterprise Hardening | observability, security, DR, perf, multi-region, compliance roadmap | Not started |

## Phase 0 — what's done vs remaining

**Done (committed):**
- UI component inventory (`ui-inventory/`, 10 files), live-verified across shadcn core/studio Pro/Magic UI free+Pro/ReUI; registry config corrected (root + `packages/ui`); `lessons-learned.md` (12+ entries); `.claude/CLAUDE.md`.
- This pass: charter committed; root `CLAUDE.md`; ADRs 0001–0005; module-spec template; glossary; this roadmap; competitive program; architecture-review doc set; Vertical Slice #1 design; CI/test/docker foundation config; Docker image optimization (2.38GB→168MB) + dependency alignment.

**Phase-0 lock-in (§46): COMPLETE** — `check-types`/`check`/`test` green, CI green on master, Docker image builds + boots. A 2026-06-21 audit-only red-team pass (`phase-0-audit.md`) found **zero CRITICAL / zero HIGH**; stale-metadata MEDIUMs resolved; engineering items queued. Phase 1 begins.

> The first **feature** work is Vertical Slice #1 (§32), implemented only after this architecture review is approved (ADR 0002).
