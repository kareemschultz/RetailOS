// @vitest-environment node
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "../schema";
import {
  auditLog,
  journal,
  journalLine,
  ledgerAccount,
  organization,
  postingPeriod,
} from "../schema";
import { withTenant } from "../tenant";
import {
  closePostingPeriod,
  createDraftJournal,
  createLedgerAccount,
  createPostingPeriod,
  postJournal,
} from "./accounting";

const url = process.env.RLS_TEST_DATABASE_URL;
const TENANT = "accounting_slice_tenant";
const OTHER_TENANT = "accounting_slice_other_tenant";

function required<T>(value: T | undefined, label: string): T {
  if (value === undefined || value === null) {
    throw new Error(`accounting test expected ${label}`);
  }
  return value;
}

describe.skipIf(!url)("Phase E accounting foundation", () => {
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;

  beforeAll(async () => {
    pool = new Pool({ connectionString: url });
    db = drizzle(pool, { schema });
    await db
      .insert(organization)
      .values([
        { id: TENANT, name: "Accounting Slice Tenant" },
        { id: OTHER_TENANT, name: "Accounting Slice Other Tenant" },
      ])
      .onConflictDoNothing();
    for (const tenant of [TENANT, OTHER_TENANT]) {
      await withTenant(db, tenant, async (tx) => {
        await tx.delete(journalLine);
        await tx.delete(journal);
        await tx.delete(ledgerAccount);
        await tx.delete(postingPeriod);
        await tx.delete(auditLog);
      });
    }
  });

  afterAll(async () => {
    await pool.end();
  });

  it("posts only balanced journals and audits accounting mutations", async () => {
    await withTenant(db, TENANT, async (tx) => {
      const cash = await createLedgerAccount(
        tx,
        { tenantId: TENANT },
        {
          code: "1000",
          name: "Cash",
          type: "asset",
          normalBalance: "debit",
        }
      );
      const revenue = await createLedgerAccount(
        tx,
        { tenantId: TENANT },
        {
          code: "4000",
          name: "Sales Revenue",
          type: "revenue",
          normalBalance: "credit",
        }
      );
      const period = await createPostingPeriod(
        tx,
        { tenantId: TENANT },
        {
          name: "2026-07",
          startsOn: new Date("2026-07-01T00:00:00.000Z"),
          endsOn: new Date("2026-07-31T00:00:00.000Z"),
        }
      );
      const unbalanced = await createDraftJournal(
        tx,
        { tenantId: TENANT },
        {
          postingPeriodId: period.id,
          memo: "bad journal",
          lines: [
            { accountId: cash.id, debitMinor: 1000, currency: "GYD", scale: 2 },
            {
              accountId: revenue.id,
              creditMinor: 999,
              currency: "GYD",
              scale: 2,
            },
          ],
        }
      );
      await expect(
        postJournal(tx, { tenantId: TENANT }, unbalanced.id)
      ).rejects.toMatchObject({
        code: "UNBALANCED_JOURNAL",
      });
      const balanced = await createDraftJournal(
        tx,
        { tenantId: TENANT },
        {
          postingPeriodId: period.id,
          memo: "good journal",
          lines: [
            { accountId: cash.id, debitMinor: 1000, currency: "GYD", scale: 2 },
            {
              accountId: revenue.id,
              creditMinor: 1000,
              currency: "GYD",
              scale: 2,
            },
          ],
        }
      );
      const posted = await postJournal(tx, { tenantId: TENANT }, balanced.id);
      expect(posted.status).toBe("posted");
      expect(posted.postedAt).toBeInstanceOf(Date);
      const audits = await tx
        .select()
        .from(auditLog)
        .where(eq(auditLog.entityType, "journal"));
      expect(audits.map((row) => row.action)).toContain(
        "accounting.journal.post"
      );
    });
  });

  it("rejects posting into a closed period", async () => {
    await withTenant(db, TENANT, async (tx) => {
      const cash = required(
        (
          await tx
            .select()
            .from(ledgerAccount)
            .where(eq(ledgerAccount.code, "1000"))
            .limit(1)
        ).at(0),
        "cash account"
      );
      const revenue = required(
        (
          await tx
            .select()
            .from(ledgerAccount)
            .where(eq(ledgerAccount.code, "4000"))
            .limit(1)
        ).at(0),
        "revenue account"
      );
      const period = await createPostingPeriod(
        tx,
        { tenantId: TENANT },
        {
          name: "2026-08",
          startsOn: new Date("2026-08-01T00:00:00.000Z"),
          endsOn: new Date("2026-08-31T00:00:00.000Z"),
        }
      );
      await closePostingPeriod(tx, { tenantId: TENANT }, period.id);
      const draft = await createDraftJournal(
        tx,
        { tenantId: TENANT },
        {
          postingPeriodId: period.id,
          lines: [
            { accountId: cash.id, debitMinor: 500, currency: "GYD", scale: 2 },
            {
              accountId: revenue.id,
              creditMinor: 500,
              currency: "GYD",
              scale: 2,
            },
          ],
        }
      );
      await expect(
        postJournal(tx, { tenantId: TENANT }, draft.id)
      ).rejects.toMatchObject({
        code: "CLOSED_PERIOD",
      });
    });
  });

  it("keeps ledger accounts tenant-isolated under RLS", async () => {
    await withTenant(db, OTHER_TENANT, async (tx) => {
      const rows = await tx.select().from(ledgerAccount);
      expect(rows).toHaveLength(0);
    });
  });
});
