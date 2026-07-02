import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "../schema";
import {
  company,
  location,
  offlineSyncBatch,
  offlineSyncMutation,
  offlineTerminal,
} from "../schema";
import { withTenant } from "../tenant";
import {
  ingestOfflineSyncBatch,
  OfflineSyncConflictError,
} from "./offline-sync";

const url = process.env.RLS_TEST_DATABASE_URL;
const TENANT = "offline_sync_tenant";
const OTHER_TENANT = "offline_sync_other";
const SHA256_HEX = /^[a-f0-9]{64}$/;

function required<T>(row: T | undefined, what: string): T {
  if (!row) {
    throw new Error(`expected ${what}`);
  }
  return row;
}

describe.skipIf(!url)("offline sync ingestion (RLS + idempotent queue)", () => {
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let locationId: string;

  beforeAll(async () => {
    pool = new Pool({ connectionString: url });
    db = drizzle(pool, { schema });
    for (const tenant of [TENANT, OTHER_TENANT]) {
      await withTenant(db, tenant, async (tx) => {
        await tx.delete(offlineSyncMutation);
        await tx.delete(offlineSyncBatch);
        await tx.delete(offlineTerminal);
        await tx.delete(location);
        await tx.delete(company);
      });
    }
    locationId = await withTenant(db, TENANT, async (tx) => {
      const co = required(
        (
          await tx
            .insert(company)
            .values({ name: "Offline Co", tenantId: TENANT })
            .returning()
        ).at(0),
        "company"
      );
      const loc = required(
        (
          await tx
            .insert(location)
            .values({ companyId: co.id, name: "POS", tenantId: TENANT })
            .returning()
        ).at(0),
        "location"
      );
      return loc.id;
    });
  });

  afterAll(async () => {
    await pool?.end();
  });

  it("registers terminal identity and ingests queued mutations with monotonic uniqueness", async () => {
    const result = await withTenant(db, TENANT, (tx) =>
      ingestOfflineSyncBatch(
        tx,
        { actorUserId: "user-1", tenantId: TENANT },
        {
          appVersion: "1.0.0",
          deviceId: "device-a",
          idempotencyKey: "batch-a",
          locationId,
          mutations: [
            {
              monotonicCounter: 1,
              mutationId: "mut-a-1",
              mutationType: "pos.createSale",
              payload: { saleNumber: "R-1", totalMinor: 1999 },
              payloadVersion: "v1",
            },
          ],
          sqliteSchemaVersion: "2026.07.01",
          terminalId: "register-a",
        }
      )
    );

    expect(result.replayedBatch).toBe(false);
    expect(result.acceptedMutationCount).toBe(1);
    expect(result.mutations[0]?.replayStatus).toBe("new");

    const rows = await withTenant(db, TENANT, (tx) =>
      tx
        .select()
        .from(offlineSyncMutation)
        .where(
          and(
            eq(offlineSyncMutation.terminalId, "register-a"),
            eq(offlineSyncMutation.monotonicCounter, 1)
          )
        )
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.payloadHash).toMatch(SHA256_HEX);
  });

  it("replays identical batches and rejects same counter with changed payload", async () => {
    const baseMutation = {
      monotonicCounter: 1,
      mutationId: "mut-b-1",
      mutationType: "pos.createSale",
      payload: { totalMinor: 500 },
      payloadVersion: "v1",
    };
    const input = {
      deviceId: "device-b",
      idempotencyKey: "batch-b",
      mutations: [baseMutation],
      terminalId: "register-b",
    };
    const first = await withTenant(db, TENANT, (tx) =>
      ingestOfflineSyncBatch(tx, { tenantId: TENANT }, input)
    );
    const replay = await withTenant(db, TENANT, (tx) =>
      ingestOfflineSyncBatch(tx, { tenantId: TENANT }, input)
    );
    expect(replay.replayedBatch).toBe(true);
    expect(replay.batchId).toBe(first.batchId);
    expect(replay.mutations[0]?.replayStatus).toBe("replay");

    await expect(
      withTenant(db, TENANT, (tx) =>
        ingestOfflineSyncBatch(
          tx,
          { tenantId: TENANT },
          {
            deviceId: input.deviceId,
            idempotencyKey: "batch-b-conflict",
            mutations: [
              {
                monotonicCounter: baseMutation.monotonicCounter,
                mutationId: baseMutation.mutationId,
                mutationType: baseMutation.mutationType,
                payload: { totalMinor: 501 },
                payloadVersion: baseMutation.payloadVersion,
              },
            ],
            terminalId: input.terminalId,
          }
        )
      )
    ).rejects.toBeInstanceOf(OfflineSyncConflictError);
  });
});
