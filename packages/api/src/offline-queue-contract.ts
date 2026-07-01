import { z } from "zod";

// Contract shared with the Tauri/SQLite POS queue. SQLite stores the queue rows
// durably and flushes them to this payload shape; the server re-hashes the exact
// semantic fields before accepting a batch so clock skew and JSON key order do
// not create false conflicts.
export const offlineQueuedMutationSchema = z.object({
  mutationId: z.string().min(1),
  monotonicCounter: z.number().int().positive().safe(),
  mutationType: z.string().min(1),
  payloadVersion: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
  clientCreatedAt: z.coerce.date().optional(),
});

export const offlineSyncBatchSchema = z.object({
  terminalId: z.string().min(1),
  deviceId: z.string().min(1),
  locationId: z.string().uuid().nullable().optional(),
  publicKeyFingerprint: z.string().min(1).nullable().optional(),
  appVersion: z.string().min(1).nullable().optional(),
  sqliteSchemaVersion: z.string().min(1).nullable().optional(),
  idempotencyKey: z.string().min(1),
  mutations: z.array(offlineQueuedMutationSchema),
});

export type OfflineQueuedMutationContract = z.infer<
  typeof offlineQueuedMutationSchema
>;
export type OfflineSyncBatchContract = z.infer<typeof offlineSyncBatchSchema>;
