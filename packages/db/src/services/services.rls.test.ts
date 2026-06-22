import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "../schema";
import {
  auditLog,
  company,
  idempotencyKey,
  location,
  outboxEvent,
  product,
  stockLedger,
} from "../schema";
import { withTenant } from "../tenant";
import { recordAudit } from "./audit";
import { IdempotencyConflictError, runIdempotent } from "./idempotency";
import { DomainEventType, emitEvent } from "./outbox";
import { appendStockMovement, stockOnHand } from "./stock-ledger";

// Core-service integration tests — need a real Postgres reached as retailos_app
// (roles bootstrapped + migrations applied). Skipped unless RLS_TEST_DATABASE_URL
// is set, so the default `bun run test` gate stays green without a database.
const url = process.env.RLS_TEST_DATABASE_URL;
const TENANT = "svc_tenant";

function required<T>(row: T | undefined, what: string): T {
  if (!row) {
    throw new Error(`expected ${what}`);
  }
  return row;
}

describe.skipIf(!url)("core services (tenant-scoped, ADR 0006)", () => {
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let locationId: string;
  let productId: string;

  beforeAll(async () => {
    pool = new Pool({ connectionString: url });
    db = drizzle(pool, { schema });
    // Hermetic: clear this tenant's rows so re-runs against a persisted DB start
    // clean (RLS scopes the deletes to TENANT). FK-safe order.
    await withTenant(db, TENANT, async (tx) => {
      await tx.delete(idempotencyKey);
      await tx.delete(auditLog);
      await tx.delete(outboxEvent);
      await tx.delete(stockLedger);
      await tx.delete(product);
      await tx.delete(location);
      await tx.delete(company);
    });
    const ids = await withTenant(db, TENANT, async (tx) => {
      const co = required(
        (
          await tx
            .insert(company)
            .values({ tenantId: TENANT, name: "Svc Co" })
            .returning()
        ).at(0),
        "company"
      );
      const loc = required(
        (
          await tx
            .insert(location)
            .values({ tenantId: TENANT, companyId: co.id, name: "Main" })
            .returning()
        ).at(0),
        "location"
      );
      const prod = required(
        (
          await tx
            .insert(product)
            .values({
              tenantId: TENANT,
              sku: "SVC-1",
              name: "Svc Product",
              priceMinor: 1999,
              currency: "USD",
            })
            .returning()
        ).at(0),
        "product"
      );
      return { locationId: loc.id, productId: prod.id };
    });
    locationId = ids.locationId;
    productId = ids.productId;
  });

  afterAll(async () => {
    await pool?.end();
  });

  it("stock ledger records a correct running balance_after", async () => {
    await withTenant(db, TENANT, async (tx) => {
      const receipt = await appendStockMovement(
        tx,
        { tenantId: TENANT },
        { locationId, productId, movementType: "receipt", qtyDelta: 10 }
      );
      expect(receipt.balanceAfter).toBe(10);
      const sale = await appendStockMovement(
        tx,
        { tenantId: TENANT },
        { locationId, productId, movementType: "sale", qtyDelta: -3 }
      );
      expect(sale.balanceAfter).toBe(7);
      expect(await stockOnHand(tx, locationId, productId)).toBe(7);
    });
  });

  it("idempotency runs fn once on replay and conflicts on a different payload", async () => {
    let calls = 0;
    const run = (payload: unknown) =>
      withTenant(db, TENANT, (tx) =>
        runIdempotent(tx, { tenantId: TENANT }, "svc-key-1", payload, () => {
          calls += 1;
          return Promise.resolve({ ok: true, n: calls });
        })
      );
    const first = await run({ a: 1 });
    const second = await run({ a: 1 });
    expect(calls).toBe(1);
    expect(second).toEqual(first);
    await expect(run({ a: 2 })).rejects.toBeInstanceOf(
      IdempotencyConflictError
    );
  });

  it("audit records an immutable row for a mutation", async () => {
    const before = await withTenant(db, TENANT, (tx) =>
      tx.select().from(auditLog)
    );
    await withTenant(db, TENANT, (tx) =>
      recordAudit(
        tx,
        { tenantId: TENANT, actorUserId: null },
        { action: "test.recorded", entityType: "product", entityId: productId }
      )
    );
    const after = await withTenant(db, TENANT, (tx) =>
      tx.select().from(auditLog)
    );
    expect(after.length).toBe(before.length + 1);
  });

  it("outbox emits a pending versioned event in the same tx", async () => {
    const row = await withTenant(db, TENANT, (tx) =>
      emitEvent(
        tx,
        { tenantId: TENANT, correlationId: "corr-9", requestId: "req-9" },
        { type: DomainEventType.SaleCreated, payload: { saleId: "x" } }
      )
    );
    expect(row.type).toBe("sale.created");
    expect(row.version).toBe(1);
    expect(row.status).toBe("pending");
    expect(row.correlationId).toBe("corr-9");
    expect(row.requestId).toBe("req-9");
    expect(row.tenantId).toBe(TENANT);
  });

  it("a rolled-back transaction emits no event (same-tx atomicity)", async () => {
    const before = await withTenant(db, TENANT, (tx) =>
      tx.select().from(outboxEvent)
    );
    await expect(
      withTenant(db, TENANT, async (tx) => {
        await emitEvent(
          tx,
          { tenantId: TENANT },
          { type: DomainEventType.SaleCreated, payload: {} }
        );
        // Force rollback after the emit: the event row must roll back with it.
        throw new Error("boom");
      })
    ).rejects.toThrow("boom");
    const after = await withTenant(db, TENANT, (tx) =>
      tx.select().from(outboxEvent)
    );
    expect(after.length).toBe(before.length);
  });
});
