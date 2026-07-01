import { describe, expect, it } from "vitest";
import { offlineSyncBatchSchema } from "./offline-queue-contract";

describe("offline queue contract", () => {
  it("accepts the Tauri/SQLite durable queue batch shape", () => {
    const parsed = offlineSyncBatchSchema.parse({
      appVersion: "1.0.0",
      deviceId: "device-a",
      idempotencyKey: "batch-1",
      mutations: [
        {
          clientCreatedAt: "2026-07-01T12:00:00.000Z",
          monotonicCounter: 1,
          mutationId: "m-1",
          mutationType: "pos.createSale",
          payload: { totalMinor: 1299 },
          payloadVersion: "v1",
        },
      ],
      sqliteSchemaVersion: "2026.07.01",
      terminalId: "register-1",
    });

    expect(parsed.mutations[0]?.clientCreatedAt).toBeInstanceOf(Date);
    expect(parsed.mutations[0]?.monotonicCounter).toBe(1);
  });

  it("rejects non-monotonic or unsafe counters before ingestion", () => {
    expect(() =>
      offlineSyncBatchSchema.parse({
        deviceId: "device-a",
        idempotencyKey: "batch-2",
        mutations: [
          {
            monotonicCounter: 0,
            mutationId: "m-2",
            mutationType: "pos.createSale",
            payload: {},
            payloadVersion: "v1",
          },
        ],
        terminalId: "register-1",
      })
    ).toThrow();
  });
});
