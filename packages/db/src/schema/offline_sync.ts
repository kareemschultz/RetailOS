import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  foreignKey,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { actor, tenantId, timestamps } from "./columns";
import { location } from "./company";

export const OFFLINE_TERMINAL_STATUSES = [
  "active",
  "suspended",
  "retired",
] as const;
export type OfflineTerminalStatus = (typeof OFFLINE_TERMINAL_STATUSES)[number];

export const OFFLINE_SYNC_BATCH_STATUSES = [
  "received",
  "accepted",
  "partially_rejected",
  "rejected",
] as const;
export type OfflineSyncBatchStatus =
  (typeof OFFLINE_SYNC_BATCH_STATUSES)[number];

export const OFFLINE_MUTATION_REPLAY_STATUSES = [
  "new",
  "replay",
  "conflict",
] as const;
export type OfflineMutationReplayStatus =
  (typeof OFFLINE_MUTATION_REPLAY_STATUSES)[number];

export const OFFLINE_MUTATION_UPCAST_STATUSES = [
  "pending",
  "upcasted",
  "failed",
] as const;
export type OfflineMutationUpcastStatus =
  (typeof OFFLINE_MUTATION_UPCAST_STATUSES)[number];

// POS/offline terminal/device identity. A terminal is a tenant-scoped, registered
// write source for offline sync batches and number leases. The server time on the
// row is authoritative; client clocks are metadata only on mutations.
export const offlineTerminal = pgTable(
  "offline_terminal",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId,
    terminalId: text("terminal_id").notNull(),
    deviceId: text("device_id").notNull(),
    locationId: uuid("location_id"),
    publicKeyFingerprint: text("public_key_fingerprint"),
    appVersion: text("app_version"),
    sqliteSchemaVersion: text("sqlite_schema_version"),
    status: text("status", { enum: OFFLINE_TERMINAL_STATUSES })
      .default("active")
      .notNull(),
    registeredAt: timestamp("registered_at").defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at"),
    ...timestamps,
    ...actor,
  },
  (table) => [
    index("offline_terminal_tenantId_idx").on(table.tenantId),
    index("offline_terminal_locationId_idx").on(table.locationId),
    unique("offline_terminal_tenant_id_uq").on(table.tenantId, table.id),
    unique("offline_terminal_identity_uq").on(
      table.tenantId,
      table.terminalId,
      table.deviceId
    ),
    foreignKey({
      columns: [table.tenantId, table.locationId],
      foreignColumns: [location.tenantId, location.id],
      name: "offline_terminal_location_composite_fk",
    }),
    check(
      "offline_terminal_status_chk",
      sql`${table.status} IN ('active','suspended','retired')`
    ),
  ]
);

export const offlineSyncBatch = pgTable(
  "offline_sync_batch",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId,
    terminalRowId: uuid("terminal_row_id").notNull(),
    terminalId: text("terminal_id").notNull(),
    deviceId: text("device_id").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    payloadHash: text("payload_hash").notNull(),
    mutationCount: bigint("mutation_count", { mode: "number" }).notNull(),
    status: text("status", { enum: OFFLINE_SYNC_BATCH_STATUSES })
      .default("received")
      .notNull(),
    receivedAt: timestamp("received_at").defaultNow().notNull(),
    acceptedAt: timestamp("accepted_at"),
    ...timestamps,
    ...actor,
  },
  (table) => [
    index("offline_sync_batch_tenantId_idx").on(table.tenantId),
    index("offline_sync_batch_terminal_idx").on(
      table.tenantId,
      table.terminalId
    ),
    unique("offline_sync_batch_tenant_id_uq").on(table.tenantId, table.id),
    unique("offline_sync_batch_idempotency_uq").on(
      table.tenantId,
      table.idempotencyKey
    ),
    foreignKey({
      columns: [table.tenantId, table.terminalRowId],
      foreignColumns: [offlineTerminal.tenantId, offlineTerminal.id],
      name: "offline_sync_batch_terminal_composite_fk",
    }),
    check(
      "offline_sync_batch_status_chk",
      sql`${table.status} IN ('received','accepted','partially_rejected','rejected')`
    ),
    check("offline_sync_batch_count_chk", sql`${table.mutationCount} >= 0`),
  ]
);

export const offlineSyncMutation = pgTable(
  "offline_sync_mutation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId,
    batchId: uuid("batch_id").notNull(),
    terminalRowId: uuid("terminal_row_id").notNull(),
    terminalId: text("terminal_id").notNull(),
    deviceId: text("device_id").notNull(),
    monotonicCounter: bigint("monotonic_counter", { mode: "number" }).notNull(),
    mutationId: text("mutation_id").notNull(),
    mutationType: text("mutation_type").notNull(),
    payloadVersion: text("payload_version").notNull(),
    payloadHash: text("payload_hash").notNull(),
    payload: jsonb("payload").notNull(),
    clientCreatedAt: timestamp("client_created_at"),
    replayStatus: text("replay_status", {
      enum: OFFLINE_MUTATION_REPLAY_STATUSES,
    })
      .default("new")
      .notNull(),
    upcastStatus: text("upcast_status", {
      enum: OFFLINE_MUTATION_UPCAST_STATUSES,
    })
      .default("pending")
      .notNull(),
    upcastError: text("upcast_error"),
    appliedAt: timestamp("applied_at"),
    ...timestamps,
    ...actor,
  },
  (table) => [
    index("offline_sync_mutation_tenantId_idx").on(table.tenantId),
    index("offline_sync_mutation_batchId_idx").on(table.batchId),
    index("offline_sync_mutation_terminal_idx").on(
      table.tenantId,
      table.terminalId
    ),
    unique("offline_sync_mutation_tenant_id_uq").on(table.tenantId, table.id),
    unique("offline_sync_mutation_counter_uq").on(
      table.tenantId,
      table.terminalId,
      table.deviceId,
      table.monotonicCounter
    ),
    unique("offline_sync_mutation_mutation_id_uq").on(
      table.tenantId,
      table.terminalId,
      table.deviceId,
      table.mutationId
    ),
    foreignKey({
      columns: [table.tenantId, table.batchId],
      foreignColumns: [offlineSyncBatch.tenantId, offlineSyncBatch.id],
      name: "offline_sync_mutation_batch_composite_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.terminalRowId],
      foreignColumns: [offlineTerminal.tenantId, offlineTerminal.id],
      name: "offline_sync_mutation_terminal_composite_fk",
    }),
    check(
      "offline_sync_mutation_counter_chk",
      sql`${table.monotonicCounter} > 0`
    ),
    check(
      "offline_sync_mutation_replay_status_chk",
      sql`${table.replayStatus} IN ('new','replay','conflict')`
    ),
    check(
      "offline_sync_mutation_upcast_status_chk",
      sql`${table.upcastStatus} IN ('pending','upcasted','failed')`
    ),
  ]
);
