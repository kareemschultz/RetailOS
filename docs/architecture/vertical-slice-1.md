# Vertical Slice #1 — Design (no code)

> The §32 first feature, **designed only** — implemented in a later run after this review is approved (ADR 0002).
> Flow: **Organization → Active Tenant Context → Company → Location → Product → Initial Inventory Receipt →
> Stock Ledger Entry → POS Sale Mutation → Automatic Stock Deduction → Invoice Record → Audit Log Entry →
> Basic Sales Report.** Proves the spine (tenancy, RLS, audit, idempotency, ledger, posting placeholder) end-to-end
> on the thinnest possible feature. No CRM/ecommerce/accounting-UI/hardware/Edge-Hub/fiscalization yet — interfaces only.

## Reuse (existing scaffold — do not rebuild)

- `packages/api` — oRPC `publicProcedure` / `protectedProcedure`, context with Better Auth session.
- `packages/auth` — Better Auth instance (add the **organization** + **admin** plugins for this slice).
- `packages/db` — Drizzle + Postgres; existing `auth.ts` schema (user/session/account/verification) + drizzle config (migrations → `src/migrations`).
- `packages/env` — env validation; `packages/ui` — `cn`, base components for the minimal POS/report screens.
- `apps/server` (Hono) — add the tenant-guard middleware; `apps/web` — minimal slice screens.

## Schema additions (Drizzle sketch — illustrative, not final)

All tenant-owned tables carry `tenant_id`, `created_at`, `updated_at`, `deleted_at?`, `created_by?`, `updated_by?` (§8). Money as integer minor units + currency + scale (§19).

- `tenant` (maps to Better Auth organization id), `company` (tenant_id), `location` (company_id, type).
- `membership` / role assignment (resolve `tenant_admin` | `manager` | `cashier` for the slice).
- `product` (tenant_id, sku, name, price_minor, currency, scale).
- `stock_ledger` *(append-only)* — (tenant_id, location_id, product_id, movement_type, qty_delta, balance_after, ref_type, ref_id, server_ts, idempotency_key). Movement types here: `receipt`, `sale`.
- `sale` (tenant_id, location_id, number, total_minor, currency, status, idempotency_key) + `sale_line` (sale_id, product_id, qty, unit_price_minor).
- `invoice` (tenant_id, sale_id, number, total_minor) — minimal record.
- `audit_log` *(append-only, immutable)* — the §25 field set (tenant_id, actor_user_id, action, entity_type/id, old/new JSONB, request_id, correlation_id, idempotency_key, created_at).
- `outbox_event` (tenant_id, type, payload JSONB, version, correlation_id, created_at) — emit `inventory.received`, `sale.created` (consumed later; placeholder now).
- `number_block` (tenant_id, company_id, location_id, doc_type, series, range_start, range_end, next) — single-node allocator for the slice (distributed allocator deferred, see `architecture-review.md` I3).

**Migrations:** generated via `db:generate`, applied via `db:migrate`; expand/contract discipline (§8). Seed: platform-admin + one sample tenant/company/location/product (§32 local dev seeding).

## oRPC routers (signatures only)

Namespaced, all `protectedProcedure` + tenant-scoped + permission-checked (§7):

- `tenant.setActive({ organizationId })` → sets active org/tenant context.
- `company.create`, `location.create`.
- `product.create({ sku, name, priceMinor, currency })` — perm `products.create`.
- `inventory.receive({ locationId, productId, qty })` — perm `inventory.receive`; writes a `receipt` ledger row + emits `inventory.received`.
- `pos.createSale({ locationId, lines[], idempotencyKey })` — perm `pos.create_sale`; **idempotent**; writes `sale`+`sale_line`, a `sale` ledger row per line (stock deduction), an `invoice`, an `audit_log` entry, an `outbox_event`; a basic accounting-posting **placeholder** interface call (no real GL yet).
- `reports.salesBasic({ from, to, locationId? })` — perm `reports.view`; reads from a simple query (read-model deferred).

## Middleware & RLS

- **Hono tenant-guard middleware**: resolves session (Better Auth) → active organization → `tenant_id`; rejects if absent; attaches `{ tenantId, userId, requestId, correlationId }` to context; opens the DB connection through a wrapper that **sets the RLS GUC** `SET app.tenant_id = $tenantId` per request (architecture-review I5).
- **RLS design**: every tenant-owned table gets a policy `USING (tenant_id = current_setting('app.tenant_id')::uuid)`; app-level tenant scoping is defense-in-depth on top. Ship an **RLS-bypass test** (§26/§35).

## Service/util interfaces (design)

- `AuditLog.record(ctx, { action, entityType, entityId, before, after })` — append-only; never throws away.
- `Idempotency.run(ctx, key, fn)` — returns cached result on key replay; stores key+request-hash+result+status (§23).
- `StockLedger.append(ctx, { locationId, productId, movementType, qtyDelta, refType, refId })` — computes `balance_after`; the ONLY way stock changes (§18/§33).
- `Money` — value type (minor units + currency + scale); all amounts pass through it (§19).
- `Outbox.emit(ctx, type, payload)` — within the same transaction as the mutation (§24).
- `AccountingPosting.post(...)` — **placeholder interface** only for this slice (real double-entry deferred to Phase 5).

## Tests to write (Vitest + Playwright)

- Tenant scoping + **RLS-bypass** rejection (cross-tenant read denied).
- Permission enforcement (cashier cannot create products; only `pos.create_sale` can sell).
- **POS sale idempotency** (same `idempotencyKey` ⇒ one sale, one ledger effect).
- Stock-ledger invariant (sum of deltas == balance_after; never negative beyond policy).
- Audit-log written for every mutation; outbox event emitted.
- Basic sales report totals match committed sales.

## Definition of Done (§35)

Types pass · tests pass · tenant scoping + RLS-bypass verified · audit works · errors friendly+structured · logs structured · permissions enforced · money in minor units · module spec + this design updated · rollback (expand/contract) noted.

## Known limitations / intentionally deferred

- Single-node number allocator (distributed allocator deferred, I3); accounting posting is a placeholder (Phase 5); read-model/reporting is a direct query (Phase 12); no offline queue in this slice (POS offline is Phase 4); no fiscalization. These are interfaces now to avoid later redesign (§32).
