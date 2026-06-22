# RetailOS Phase Roadmap

Phase sequencing per charter §31. Status tracked here; update as phases progress. The §45 reassessment loop runs at the **end of every phase** — review architecture, `lessons-learned.md`, tech debt, competitor changes (§41), performance (§44), security (§29), usability — and record improvements as ADRs.

| Phase | Scope (charter §31) | Status |
|---|---|---|
| **0 — Architecture & Foundation** | Charter review, gap analysis, domain model, ERD, governance docs, env strategy, registry/MCP + UI sourcing, design tokens, CI/test infra, Vertical Slice #1 design | **✅ Complete (locked-in)** |
| 1 — Identity, Tenant, RBAC, Audit | Better Auth plugins, tenant context, RBAC/entitlements, audit, RLS foundation | **Next (starting)** |
| 2 — Products & Inventory Ledger | products/variants/SKU/barcode, stock ledger, multi-UoM, serial/batch/expiry | Not started |
| 3 — Locations, Warehouses, Bonds | companies/locations/warehouses/bonded, transfers, bond release, bins | Not started |
| 4 — POS & Offline Queue | sale mutation, payments, receipts, shifts, offline queue, idempotency, number blocks, Tauri POS | Not started |
| 5 — Accounting Foundation | COA, journals, AR/AP, tax, cash clearing, money rules, gift-card/store-credit liabilities | Not started |
| 6 — Procurement | suppliers, POs, GRNs, vendor bills, landed costs | Not started |
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
