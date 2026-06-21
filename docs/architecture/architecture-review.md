# RetailOS — Architecture Review (Phase 0)

> The §49.1–4 deliverable: executive summary, confirmed assumptions, **risks & gaps**, and recommended
> improvements. Companion to the rest of the `docs/architecture/` set. Design-only; no code (ADR 0002).

## 1. Executive architecture summary

RetailOS is one ERP domain model (§3) served through three clients (TanStack Start web, Tauri desktop POS, Expo mobile — §4) over a Hono + oRPC + Better Auth + Drizzle/PostgreSQL backend, with Redis for coordination and S3/MinIO for files. It is **cloud-authoritative but offline-first**: terminals and optional Edge Hubs keep selling during WAN loss and reconcile on reconnect, with the **stock ledger and double-entry accounting as the twin sources of truth**. It is **multi-tenant and deployment-agnostic** (SaaS shared-schema+RLS, dedicated/managed DB-per-tenant, self-hosted), **white-label** (token-driven theming, hostname→tenant), and **compliance-ready** (pluggable fiscalization, crypto-shred PII, auditor exports). Every mutation is audited; every inventory move is a ledger entry; every POS sale is idempotent; money is integer minor units.

The repo today is a thin scaffold (auth schema only; no tenant/RBAC/audit/RLS, no migrations, no Redis/object-storage/workers, no CI/tests). Phase 0 (this work) commits the charter + governance + architecture review + Vertical Slice #1 design + CI/test/Docker foundation. **No feature code ships until Phase-0 lock-in is green** (§46/§47, ADR 0002); Phase 1 then builds identity/tenant/RBAC/audit/RLS, and Vertical Slice #1 (§32) is the first feature.

## 2. Confirmed assumptions

- **Stack is fixed** (§4): Hono+oRPC+Better Auth+Drizzle+Postgres backend; TanStack Start web; Expo (`native-uniwind`) mobile; Tauri desktop. **Base UI** primitive confirmed (`base-lyra` = `@base-ui/react`, ADR 0001). Drizzle, not Prisma (§33).
- **Scaffold uses `--payments none`**; billing is domain logic in a later phase (§4/§10).
- **Three distinct offline engines** are intended (Dexie/IndexedDB web, SQLite Tauri, Expo SQLite mobile, Postgres/SQLite Edge Hub) — not IndexedDB everywhere (§4).
- **Cloud is authoritative**; Edge Hub is optional; small businesses run without it (§15).
- **Server time governs accounting/fiscal posting**; device clocks are untrusted (§14).
- **The web UI inventory is web-only**; the Expo app uses HeroUI Native/NativeWind and is tracked separately (§5, `ui-inventory/`).
- **Credentials live in gitignored `.env`** (from Infisical); registry tokens are secrets (§5/§25/§36).

## 3. Risks & gaps (the critical read)

**R1 — Triple offline surface.** Three storage engines (Dexie / Tauri-SQLite / Expo-SQLite) + Edge Hub means the sync/conflict logic risks being written three times and drifting. **Highest architectural risk.** → see I1.

**R2 — Offline → accounting posting.** Offline POS sales must post into double-entry accounting deterministically on sync, with **server-time** period assignment (§14/§20) even though they occurred earlier. Period-close, FX rates at sale-time vs post-time, and idempotent posting on replay are non-trivial and not yet designed. → I4.

**R3 — Distributed gapless numbering.** Tamper-evident, gapless document numbers per company/location/fiscal-year/series (§17), issued as offline **number blocks** to terminals and Edge Hubs that must never collide — this is a distributed sequence-allocation problem that must be designed *before* POS. → I3.

**R4 — RLS ↔ Better Auth gap.** Better Auth manages orgs/sessions but does **not** natively set a PostgreSQL RLS tenant GUC. Without a deliberate per-request connection wrapper that sets `app.tenant_id` (and an RLS-bypass test), RLS is theoretical. → I5.

**R5 — Foundation services absent from infra.** Redis, object storage, and **background workers** are required (§14/§28/§47) but only Postgres+web are in `docker-compose`. Reconnection-avalanche handling, jobs, imports, and webhooks all depend on Redis+workers. (Redis+MinIO added in Deliverable D; worker service still to design.)

**R6 — Money/multi-currency depth.** Integer minor units is mandated, but multi-currency drawers, split-currency payments, FX realized/unrealized gain-loss, and per-currency scale (§12/§19/§20) need a single shared **Money** value type used everywhere from day one, or float/scale bugs will leak into the ledger.

**R7 — Tauri SSR/SPA target.** TanStack Start is SSR-first; Tauri packages static assets and must not assume the SSR server is reachable (§4). The static/SPA build target is asserted but unverified — a build-time risk for the primary POS client.

**R8 — Compliance unknowns.** Guyana GRA fiscal requirements are unconfirmed (§17); SCIM/SOC2/ISO controls (§6/§28) are seams, not implementations. Fiscalization must stay behind the provider interface so no country's rules leak into core.

**R9 — Scope/throughput.** The charter spans ~13 phases and dozens of modules. The main delivery risk is **scope discipline** — building breadth before the foundation (§47) is solid. Mitigated by ADR 0002 + phased roadmap + per-module specs/competitive gates.

**R10 — Native design-system divergence.** The Expo app's UI kit differs from the web component stack; without a **shared token contract** (not shared components), web and native will drift visually and behaviorally.

**Smaller gaps:** WebSocket infra not scaffolded (§4); analytics read-models/search infra not present (§27); state-management boundary between Zustand and TanStack Query undefined (§4); per-PR ephemeral preview env + container scanning not wired (§28); biometric-template handling for offline cashier switching needs a concrete non-reversible scheme (§19/§25).

## 4. Recommended improvements

- **I1 — One sync protocol, three adapters.** Define a single mutation envelope + conflict/idempotency protocol once; implement thin storage adapters per engine. The Edge Hub and cloud ingest share the same envelope. Prevents R1 drift.
- **I2 — Foundation primitives package set in Phase 1, before any feature** (§47): `Money` value type, `TenantContext`, `AuditLog`, `IdempotencyKey`, `Outbox`, and `NumberBlock` services — the spine Vertical Slice #1 composes.
- **I3 — Number-block allocator** as a first-class service: cloud issues blocks; Edge Hub sub-allocates to terminals; gaps/voids/expiry tracked. Design before POS (R3).
- **I4 — Event-sourced accounting posting:** POS/inventory emit outbox events; an accounting posting engine consumes them and posts with server-time period assignment, idempotently on replay (R2). FX rate captured at sale-time, gain/loss realized at post-time.
- **I5 — RLS via connection wrapper + test harness:** a per-request DB wrapper sets the tenant GUC; ship an automated RLS-bypass test in Phase 1 (R4, §26/§35).
- **I6 — Add Redis + object storage now, design the worker tier** (Deliverable D adds Redis/MinIO; add a worker service + queue abstraction in Phase 1) (R5).
- **I7 — Verify the Tauri static/SPA build** as an early Phase-0/1 spike before POS work (R7).
- **I8 — Shared token contract for web ↔ native** (export the design tokens; let each platform render them) (R10).
- **I9 — Confirm GRA fiscal early** through the provider seam; keep a country-config data model, never hardcode (R8).
- **I10 — Define the Zustand/Query boundary** (server cache = Query; ephemeral client/UI state = Zustand; offline durable state = the engine) in `ui-ux-plan.md`/conventions.

## Known limitations / intentionally deferred

- This is a planning review, not an implementation; all module internals are designed in their module specs (§42) just-in-time.
- Competitive matrices (§41) are deferred per-module (template only).
- Detailed ERD/schema lives in `domain-model.md`; this doc only flags the cross-cutting risks.
- Quantified SLO/RPO/RTO targets are set in `quality-security-ops.md`; numbers will tighten with real-device data (§44).
- Charter §5 verdicts in `ui-inventory/` are re-validated in `ui-ux-plan.md`, not here.
