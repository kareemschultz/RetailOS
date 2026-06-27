import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "../schema";
import {
  auditLog,
  company,
  location,
  numberBlock,
  numberLease,
  numberLeaseUsage,
} from "../schema";
import { withTenant } from "../tenant";
import {
  allocateNumberLease,
  consumeNumberFromLease,
  NumberLeaseConflictError,
  reclaimNumberLease,
  reportSkippedNumbers,
} from "./number-lease";

const url = process.env.RLS_TEST_DATABASE_URL;
const TENANT = "number_lease_tenant";
const OTHER_TENANT = "number_lease_other";
const RACE_WIDTH = 8;
const OVERLAP_REJECTION = /number lease range overlaps existing lease/;
const INT_OVERFLOW = /out of range/;

function required<T>(row: T | undefined, what: string): T {
  if (!row) {
    throw new Error(`expected ${what}`);
  }
  return row;
}

function rangesOverlap(
  a: { rangeEnd: number; rangeStart: number },
  b: { rangeEnd: number; rangeStart: number }
) {
  return a.rangeStart <= b.rangeEnd && b.rangeStart <= a.rangeEnd;
}

describe.skipIf(!url)("number lease allocator (RLS + disjointness)", () => {
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let companyId: string;
  let locationId: string;
  let otherBlockId: string;

  beforeAll(async () => {
    pool = new Pool({ connectionString: url });
    db = drizzle(pool, { schema });
    for (const tenant of [TENANT, OTHER_TENANT]) {
      await withTenant(db, tenant, async (tx) => {
        await tx.delete(numberLeaseUsage);
        await tx.delete(numberLease);
        await tx.delete(numberBlock);
        await tx.delete(auditLog);
        await tx.delete(location);
        await tx.delete(company);
      });
    }
    const ids = await withTenant(db, TENANT, async (tx) => {
      const co = required(
        (
          await tx
            .insert(company)
            .values({ name: "Number Lease Co", tenantId: TENANT })
            .returning()
        ).at(0),
        "company"
      );
      const loc = required(
        (
          await tx
            .insert(location)
            .values({
              companyId: co.id,
              name: "Register Store",
              tenantId: TENANT,
            })
            .returning()
        ).at(0),
        "location"
      );
      return { companyId: co.id, locationId: loc.id };
    });
    companyId = ids.companyId;
    locationId = ids.locationId;

    otherBlockId = await withTenant(db, OTHER_TENANT, async (tx) => {
      const co = required(
        (
          await tx
            .insert(company)
            .values({ name: "Other Co", tenantId: OTHER_TENANT })
            .returning()
        ).at(0),
        "other company"
      );
      const block = required(
        (
          await tx
            .insert(numberBlock)
            .values({
              companyId: co.id,
              docType: "receipt",
              next: 1,
              rangeEnd: 100,
              rangeStart: 1,
              tenantId: OTHER_TENANT,
            })
            .returning()
        ).at(0),
        "other block"
      );
      return block.id;
    });
  });

  afterAll(async () => {
    await pool?.end();
  });

  it("concurrent terminal lease requests produce strictly disjoint ranges", async () => {
    const leases = await Promise.all(
      Array.from({ length: RACE_WIDTH }, (_, index) =>
        withTenant(db, TENANT, (tx) =>
          allocateNumberLease(
            tx,
            { tenantId: TENANT },
            {
              companyId,
              docType: "receipt",
              idempotencyKey: `concurrent-${index}`,
              leaseSize: 10,
              locationId,
              terminalId: `term-${index}`,
            }
          )
        )
      )
    );

    for (let i = 0; i < leases.length; i += 1) {
      for (let j = i + 1; j < leases.length; j += 1) {
        expect(
          rangesOverlap(
            required(leases[i], "lease i"),
            required(leases[j], "lease j")
          )
        ).toBe(false);
      }
    }
    const ordered = [...leases].sort((a, b) => a.rangeStart - b.rangeStart);
    expect(ordered.map((lease) => lease.rangeStart)).toEqual([
      1, 11, 21, 31, 41, 51, 61, 71,
    ]);
  });

  it("replay with the same idempotency key returns the original lease and conflicts on changed payload", async () => {
    const input = {
      companyId,
      docType: "invoice",
      idempotencyKey: "replay-same-key",
      leaseSize: 5,
      locationId,
      terminalId: "term-replay",
    };
    const first = await withTenant(db, TENANT, (tx) =>
      allocateNumberLease(tx, { tenantId: TENANT }, input)
    );
    const second = await withTenant(db, TENANT, (tx) =>
      allocateNumberLease(tx, { tenantId: TENANT }, input)
    );
    expect(second.id).toBe(first.id);
    expect(second.rangeStart).toBe(first.rangeStart);
    expect(second.rangeEnd).toBe(first.rangeEnd);
    await expect(
      withTenant(db, TENANT, (tx) =>
        allocateNumberLease(
          tx,
          { tenantId: TENANT },
          {
            ...input,
            leaseSize: 99,
          }
        )
      )
    ).rejects.toBeInstanceOf(NumberLeaseConflictError);
  });

  it("partially consumed leases never reissue consumed or reclaimed-tail numbers", async () => {
    const lease = await withTenant(db, TENANT, (tx) =>
      allocateNumberLease(
        tx,
        { tenantId: TENANT },
        {
          companyId,
          docType: "credit_note",
          idempotencyKey: "partial-reclaim",
          leaseSize: 5,
          locationId,
          terminalId: "term-partial",
        }
      )
    );
    await withTenant(db, TENANT, (tx) =>
      consumeNumberFromLease(
        tx,
        { tenantId: TENANT },
        {
          leaseId: lease.id,
          number: lease.rangeStart,
          sourceType: "receipt",
        }
      )
    );
    await withTenant(db, TENANT, (tx) =>
      consumeNumberFromLease(
        tx,
        { tenantId: TENANT },
        {
          leaseId: lease.id,
          number: lease.rangeStart + 1,
          sourceType: "receipt",
        }
      )
    );
    await withTenant(db, TENANT, (tx) =>
      tx
        .update(numberLease)
        .set({ expiresAt: new Date("2020-01-01T00:00:00.000Z") })
        .where(eq(numberLease.id, lease.id))
    );
    await withTenant(db, TENANT, (tx) =>
      reclaimNumberLease(
        tx,
        { tenantId: TENANT },
        {
          leaseId: lease.id,
          reason: "terminal_crash",
          terminalId: "term-partial",
        }
      )
    );

    const usage = await withTenant(db, TENANT, (tx) =>
      tx
        .select({
          number: numberLeaseUsage.number,
          status: numberLeaseUsage.status,
        })
        .from(numberLeaseUsage)
        .where(eq(numberLeaseUsage.leaseId, lease.id))
        .orderBy(numberLeaseUsage.number)
    );
    expect(usage).toEqual([
      { number: lease.rangeStart, status: "consumed" },
      { number: lease.rangeStart + 1, status: "consumed" },
      { number: lease.rangeStart + 2, status: "skipped" },
      { number: lease.rangeStart + 3, status: "skipped" },
      { number: lease.rangeStart + 4, status: "skipped" },
    ]);

    const nextLease = await withTenant(db, TENANT, (tx) =>
      allocateNumberLease(
        tx,
        { tenantId: TENANT },
        {
          companyId,
          docType: "credit_note",
          idempotencyKey: "after-partial-reclaim",
          leaseSize: 3,
          locationId,
          terminalId: "term-after-reclaim",
        }
      )
    );
    expect(nextLease.rangeStart).toBeGreaterThan(lease.rangeEnd);
  });

  it("expired and reclaimed leases cannot collide with a future lease", async () => {
    const expired = await withTenant(db, TENANT, (tx) =>
      allocateNumberLease(
        tx,
        { tenantId: TENANT },
        {
          companyId,
          docType: "debit_note",
          expiresAt: new Date("2020-01-01T00:00:00.000Z"),
          idempotencyKey: "expired-lease",
          leaseSize: 4,
          locationId,
          terminalId: "term-expired",
        }
      )
    );
    await expect(
      withTenant(db, TENANT, (tx) =>
        consumeNumberFromLease(
          tx,
          { tenantId: TENANT },
          {
            leaseId: expired.id,
            number: expired.rangeStart,
          }
        )
      )
    ).rejects.toBeInstanceOf(NumberLeaseConflictError);
    await withTenant(db, TENANT, (tx) =>
      reclaimNumberLease(
        tx,
        { tenantId: TENANT },
        {
          leaseId: expired.id,
          reason: "expired_terminal_lease",
          terminalId: "term-expired",
        }
      )
    );
    const next = await withTenant(db, TENANT, (tx) =>
      allocateNumberLease(
        tx,
        { tenantId: TENANT },
        {
          companyId,
          docType: "debit_note",
          idempotencyKey: "after-expired-reclaim",
          leaseSize: 4,
          locationId,
          terminalId: "term-after-expiry",
        }
      )
    );
    expect(rangesOverlap(expired, next)).toBe(false);
  });

  it("consumed and skipped number retries are idempotent", async () => {
    const lease = await withTenant(db, TENANT, (tx) =>
      allocateNumberLease(
        tx,
        { tenantId: TENANT },
        {
          companyId,
          docType: "receipt-retry",
          idempotencyKey: "usage-retry-lease",
          leaseSize: 3,
          locationId,
          terminalId: "term-retry",
        }
      )
    );
    const consumed = await withTenant(db, TENANT, (tx) =>
      consumeNumberFromLease(
        tx,
        { tenantId: TENANT },
        {
          leaseId: lease.id,
          number: lease.rangeStart,
          sourceId: "11111111-1111-4111-8111-111111111111",
          sourceType: "receipt",
        }
      )
    );
    const consumedReplay = await withTenant(db, TENANT, (tx) =>
      consumeNumberFromLease(
        tx,
        { tenantId: TENANT },
        {
          leaseId: lease.id,
          number: lease.rangeStart,
          sourceId: "11111111-1111-4111-8111-111111111111",
          sourceType: "receipt",
        }
      )
    );
    expect(consumedReplay.id).toBe(consumed.id);
    expect(consumedReplay.nextNumber).toBe(consumed.nextNumber);

    const skipped = await withTenant(db, TENANT, (tx) =>
      reportSkippedNumbers(
        tx,
        { tenantId: TENANT },
        {
          fromNumber: lease.rangeStart + 1,
          leaseId: lease.id,
          reason: "printer_failure_retry",
          sourceType: "terminal",
          toNumber: lease.rangeStart + 2,
        }
      )
    );
    const skippedReplay = await withTenant(db, TENANT, (tx) =>
      reportSkippedNumbers(
        tx,
        { tenantId: TENANT },
        {
          fromNumber: lease.rangeStart + 1,
          leaseId: lease.id,
          reason: "printer_failure_retry",
          sourceType: "terminal",
          toNumber: lease.rangeStart + 2,
        }
      )
    );
    expect(skippedReplay.id).toBe(skipped.id);
    expect(skippedReplay.nextNumber).toBe(skipped.nextNumber);
  });

  it("rejects mixed fiscal/location scopes on the still-coarse number block", async () => {
    await withTenant(db, TENANT, (tx) =>
      allocateNumberLease(
        tx,
        { tenantId: TENANT },
        {
          companyId,
          docType: "receipt-scope",
          fiscalYear: 2026,
          idempotencyKey: "scope-first",
          leaseSize: 2,
          locationId,
          terminalId: "term-scope-a",
        }
      )
    );
    await expect(
      withTenant(db, TENANT, (tx) =>
        allocateNumberLease(
          tx,
          { tenantId: TENANT },
          {
            companyId,
            docType: "receipt-scope",
            fiscalYear: 2027,
            idempotencyKey: "scope-second",
            leaseSize: 2,
            locationId,
            terminalId: "term-scope-b",
          }
        )
      )
    ).rejects.toBeInstanceOf(NumberLeaseConflictError);
  });

  it("rejects reclaim from the wrong terminal and before expiry", async () => {
    const lease = await withTenant(db, TENANT, (tx) =>
      allocateNumberLease(
        tx,
        { tenantId: TENANT },
        {
          companyId,
          docType: "receipt-reclaim-guard",
          idempotencyKey: "reclaim-guard",
          leaseSize: 2,
          locationId,
          terminalId: "term-owner",
        }
      )
    );
    await expect(
      withTenant(db, TENANT, (tx) =>
        reclaimNumberLease(
          tx,
          { tenantId: TENANT },
          {
            leaseId: lease.id,
            reason: "wrong_terminal",
            terminalId: "term-other",
          }
        )
      )
    ).rejects.toBeInstanceOf(NumberLeaseConflictError);
    await expect(
      withTenant(db, TENANT, (tx) =>
        reclaimNumberLease(
          tx,
          { tenantId: TENANT },
          {
            leaseId: lease.id,
            reason: "too_early",
            terminalId: "term-owner",
          }
        )
      )
    ).rejects.toBeInstanceOf(NumberLeaseConflictError);
  });

  it("skipped-number policy records auditable gaps and advances the cursor", async () => {
    const lease = await withTenant(db, TENANT, (tx) =>
      allocateNumberLease(
        tx,
        { tenantId: TENANT },
        {
          companyId,
          docType: "receipt-skip",
          idempotencyKey: "skip-gap-policy",
          leaseSize: 4,
          locationId,
          terminalId: "term-skip",
        }
      )
    );
    const updated = await withTenant(db, TENANT, (tx) =>
      reportSkippedNumbers(
        tx,
        { tenantId: TENANT },
        {
          fromNumber: lease.rangeStart,
          leaseId: lease.id,
          reason: "printer_failure",
          toNumber: lease.rangeStart + 1,
        }
      )
    );
    expect(updated.nextNumber).toBe(lease.rangeStart + 2);
    const skipped = await withTenant(db, TENANT, (tx) =>
      tx
        .select()
        .from(numberLeaseUsage)
        .where(
          and(
            eq(numberLeaseUsage.leaseId, lease.id),
            eq(numberLeaseUsage.status, "skipped")
          )
        )
        .orderBy(numberLeaseUsage.number)
    );
    expect(skipped.map((row) => row.reason)).toEqual([
      "printer_failure",
      "printer_failure",
    ]);
    await expect(
      withTenant(db, TENANT, (tx) =>
        consumeNumberFromLease(
          tx,
          { tenantId: TENANT },
          {
            leaseId: lease.id,
            number: lease.rangeStart,
          }
        )
      )
    ).rejects.toBeInstanceOf(NumberLeaseConflictError);
  });

  it("overlap backstop and next-cursor CHECK do not overflow at the int4 ceiling", async () => {
    const INT4_MAX = 2_147_483_647;
    // A block carrying the int4-max ceiling (as the legacy count-based allocator
    // could create). The hardened trigger/CHECK must evaluate without raising
    // "integer out of range".
    const block = await withTenant(db, TENANT, async (tx) =>
      required(
        (
          await tx
            .insert(numberBlock)
            .values({
              companyId,
              docType: "ceiling-receipt",
              next: INT4_MAX - 10,
              rangeEnd: INT4_MAX,
              rangeStart: 1,
              tenantId: TENANT,
            })
            .returning()
        ).at(0),
        "ceiling block"
      )
    );

    // A lease whose range_end is exactly int4 max. Pre-fix, the trigger's
    // int4range(range_start, range_end + 1) and the CHECK next_number <= range_end + 1
    // would both overflow int4 here. Post-fix this inserts cleanly.
    const lease = await withTenant(db, TENANT, async (tx) =>
      required(
        (
          await tx
            .insert(numberLease)
            .values({
              companyId,
              docType: "ceiling-receipt",
              expiresAt: new Date(Date.now() + 60_000),
              idempotencyKey: "ceiling-lease",
              nextNumber: INT4_MAX - 5,
              numberBlockId: block.id,
              rangeEnd: INT4_MAX,
              rangeStart: INT4_MAX - 5,
              requestHash: "ceiling-lease-hash",
              terminalId: "term-ceiling",
              tenantId: TENANT,
            })
            .returning()
        ).at(0),
        "ceiling lease"
      )
    );
    expect(lease.rangeEnd).toBe(INT4_MAX);

    // An overlapping lease must still be rejected by the backstop trigger — a
    // clean rejection, NOT an integer-overflow crash. Drizzle wraps the pg error,
    // so inspect the whole error chain: it must carry the trigger's overlap
    // message and must NOT be "integer out of range".
    let caught: unknown;
    try {
      await withTenant(db, TENANT, (tx) =>
        tx.insert(numberLease).values({
          companyId,
          docType: "ceiling-receipt",
          expiresAt: new Date(Date.now() + 60_000),
          idempotencyKey: "ceiling-lease-overlap",
          nextNumber: INT4_MAX - 3,
          numberBlockId: block.id,
          rangeEnd: INT4_MAX - 1,
          rangeStart: INT4_MAX - 3,
          requestHash: "ceiling-lease-overlap-hash",
          terminalId: "term-ceiling-2",
          tenantId: TENANT,
        })
      );
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeDefined();
    const chain = `${(caught as Error)?.message ?? ""} ${
      ((caught as { cause?: Error })?.cause as Error)?.message ?? ""
    }`;
    expect(chain).toMatch(OVERLAP_REJECTION);
    expect(chain).not.toMatch(INT_OVERFLOW);
  });

  it("tenant isolation and composite FK guards hold", async () => {
    await expect(
      withTenant(db, TENANT, (tx) =>
        tx.insert(numberLease).values({
          companyId,
          docType: "receipt",
          expiresAt: new Date(Date.now() + 60_000),
          idempotencyKey: "bad-cross-tenant-block",
          nextNumber: 1,
          numberBlockId: otherBlockId,
          rangeEnd: 1,
          rangeStart: 1,
          requestHash: "bad-cross-tenant-block-hash",
          terminalId: "term-bad-fk",
          tenantId: TENANT,
        })
      )
    ).rejects.toThrow();

    const visibleFromOtherTenant = await withTenant(db, OTHER_TENANT, (tx) =>
      tx.select().from(numberLease)
    );
    expect(visibleFromOtherTenant).toHaveLength(0);

    const coverage = await pool.query<{ relname: string }>(`
      SELECT c.relname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname IN ('number_lease', 'number_lease_usage')
        AND c.relrowsecurity
        AND c.relforcerowsecurity
    `);
    expect(coverage.rows.map((row) => row.relname).sort()).toEqual([
      "number_lease",
      "number_lease_usage",
    ]);
  });
});
