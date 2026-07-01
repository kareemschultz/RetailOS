import { and, eq } from "drizzle-orm";
import {
  type OfflineMutationReplayStatus,
  offlineSyncBatch,
  offlineSyncMutation,
  offlineTerminal,
} from "../schema";
import type { TenantTransaction } from "../tenant";
import { hashPayload } from "./idempotency";
import type { ServiceContext } from "./types";

const MAX_SAFE_COUNTER = Number.MAX_SAFE_INTEGER;

export class OfflineSyncConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OfflineSyncConflictError";
  }
}

export interface RegisterOfflineTerminalInput {
  appVersion?: string | null;
  deviceId: string;
  locationId?: string | null;
  publicKeyFingerprint?: string | null;
  sqliteSchemaVersion?: string | null;
  terminalId: string;
}

export interface OfflineSyncMutationInput {
  clientCreatedAt?: Date | null;
  monotonicCounter: number;
  mutationId: string;
  mutationType: string;
  payload: Record<string, unknown>;
  payloadVersion: string;
}

export interface IngestOfflineSyncBatchInput
  extends RegisterOfflineTerminalInput {
  idempotencyKey: string;
  mutations: OfflineSyncMutationInput[];
}

export interface IngestOfflineSyncBatchResult {
  acceptedMutationCount: number;
  batchId: string;
  mutations: Array<{
    id: string;
    mutationId: string;
    monotonicCounter: number;
    replayStatus: OfflineMutationReplayStatus;
    upcastStatus: "pending" | "upcasted" | "failed";
  }>;
  replayedBatch: boolean;
  terminalRowId: string;
}

function requireNonEmpty(value: string, name: string): void {
  if (!value.trim()) {
    throw new Error(`${name} is required`);
  }
}

function assertSafePositiveCounter(counter: number): void {
  if (
    !Number.isSafeInteger(counter) ||
    counter <= 0 ||
    counter > MAX_SAFE_COUNTER
  ) {
    throw new Error(
      "offline mutation monotonicCounter must be a positive safe integer"
    );
  }
}

function batchPayloadForHash(input: IngestOfflineSyncBatchInput): unknown {
  return {
    deviceId: input.deviceId,
    mutations: input.mutations.map((mutation) => ({
      clientCreatedAt: mutation.clientCreatedAt?.toISOString() ?? null,
      monotonicCounter: mutation.monotonicCounter,
      mutationId: mutation.mutationId,
      mutationType: mutation.mutationType,
      payload: mutation.payload,
      payloadVersion: mutation.payloadVersion,
    })),
    terminalId: input.terminalId,
  };
}

function mutationPayloadForHash(input: OfflineSyncMutationInput): unknown {
  return {
    clientCreatedAt: input.clientCreatedAt?.toISOString() ?? null,
    monotonicCounter: input.monotonicCounter,
    mutationId: input.mutationId,
    mutationType: input.mutationType,
    payload: input.payload,
    payloadVersion: input.payloadVersion,
  };
}

export async function registerOfflineTerminal(
  tx: TenantTransaction,
  ctx: ServiceContext,
  input: RegisterOfflineTerminalInput
) {
  requireNonEmpty(input.terminalId, "terminalId");
  requireNonEmpty(input.deviceId, "deviceId");

  const existing = await tx
    .select()
    .from(offlineTerminal)
    .where(
      and(
        eq(offlineTerminal.terminalId, input.terminalId),
        eq(offlineTerminal.deviceId, input.deviceId)
      )
    )
    .limit(1);

  const prior = existing.at(0);
  if (prior) {
    const updated = await tx
      .update(offlineTerminal)
      .set({
        appVersion: input.appVersion ?? prior.appVersion,
        lastSeenAt: new Date(),
        locationId: input.locationId ?? prior.locationId,
        publicKeyFingerprint:
          input.publicKeyFingerprint ?? prior.publicKeyFingerprint,
        sqliteSchemaVersion:
          input.sqliteSchemaVersion ?? prior.sqliteSchemaVersion,
        updatedBy: ctx.actorUserId ?? null,
      })
      .where(eq(offlineTerminal.id, prior.id))
      .returning();
    return updated.at(0) ?? prior;
  }

  const inserted = await tx
    .insert(offlineTerminal)
    .values({
      appVersion: input.appVersion ?? null,
      createdBy: ctx.actorUserId ?? null,
      deviceId: input.deviceId,
      lastSeenAt: new Date(),
      locationId: input.locationId ?? null,
      publicKeyFingerprint: input.publicKeyFingerprint ?? null,
      sqliteSchemaVersion: input.sqliteSchemaVersion ?? null,
      tenantId: ctx.tenantId,
      terminalId: input.terminalId,
      updatedBy: ctx.actorUserId ?? null,
    })
    .returning();
  const terminal = inserted.at(0);
  if (!terminal) {
    throw new Error("failed to register offline terminal");
  }
  return terminal;
}

export async function ingestOfflineSyncBatch(
  tx: TenantTransaction,
  ctx: ServiceContext,
  input: IngestOfflineSyncBatchInput
): Promise<IngestOfflineSyncBatchResult> {
  requireNonEmpty(input.idempotencyKey, "idempotencyKey");
  for (const mutation of input.mutations) {
    requireNonEmpty(mutation.mutationId, "mutationId");
    requireNonEmpty(mutation.mutationType, "mutationType");
    requireNonEmpty(mutation.payloadVersion, "payloadVersion");
    assertSafePositiveCounter(mutation.monotonicCounter);
  }

  const terminal = await registerOfflineTerminal(tx, ctx, input);
  const payloadHash = hashPayload(batchPayloadForHash(input));

  const existingBatch = (
    await tx
      .select()
      .from(offlineSyncBatch)
      .where(eq(offlineSyncBatch.idempotencyKey, input.idempotencyKey))
      .limit(1)
      .for("update")
  ).at(0);
  if (existingBatch) {
    if (existingBatch.payloadHash !== payloadHash) {
      throw new OfflineSyncConflictError(
        "offline sync idempotency key was reused with a different payload"
      );
    }
    const mutations = await tx
      .select()
      .from(offlineSyncMutation)
      .where(eq(offlineSyncMutation.batchId, existingBatch.id));
    return {
      acceptedMutationCount: mutations.length,
      batchId: existingBatch.id,
      mutations: mutations.map((mutation) => ({
        id: mutation.id,
        monotonicCounter: mutation.monotonicCounter,
        mutationId: mutation.mutationId,
        replayStatus: "replay",
        upcastStatus: mutation.upcastStatus,
      })),
      replayedBatch: true,
      terminalRowId: existingBatch.terminalRowId,
    };
  }

  const batch = (
    await tx
      .insert(offlineSyncBatch)
      .values({
        acceptedAt: new Date(),
        createdBy: ctx.actorUserId ?? null,
        deviceId: input.deviceId,
        idempotencyKey: input.idempotencyKey,
        mutationCount: input.mutations.length,
        payloadHash,
        status: "accepted",
        tenantId: ctx.tenantId,
        terminalId: input.terminalId,
        terminalRowId: terminal.id,
        updatedBy: ctx.actorUserId ?? null,
      })
      .returning()
  ).at(0);
  if (!batch) {
    throw new Error("failed to create offline sync batch");
  }

  const accepted = [] as IngestOfflineSyncBatchResult["mutations"];
  for (const mutation of input.mutations) {
    const mutationHash = hashPayload(mutationPayloadForHash(mutation));
    const existingCounter = (
      await tx
        .select()
        .from(offlineSyncMutation)
        .where(
          and(
            eq(offlineSyncMutation.terminalId, input.terminalId),
            eq(offlineSyncMutation.deviceId, input.deviceId),
            eq(offlineSyncMutation.monotonicCounter, mutation.monotonicCounter)
          )
        )
        .limit(1)
        .for("update")
    ).at(0);

    if (existingCounter) {
      if (existingCounter.payloadHash !== mutationHash) {
        throw new OfflineSyncConflictError(
          "offline mutation counter was reused with a different payload"
        );
      }
      accepted.push({
        id: existingCounter.id,
        monotonicCounter: existingCounter.monotonicCounter,
        mutationId: existingCounter.mutationId,
        replayStatus: "replay",
        upcastStatus: existingCounter.upcastStatus,
      });
      continue;
    }

    const inserted = (
      await tx
        .insert(offlineSyncMutation)
        .values({
          batchId: batch.id,
          clientCreatedAt: mutation.clientCreatedAt ?? null,
          createdBy: ctx.actorUserId ?? null,
          deviceId: input.deviceId,
          monotonicCounter: mutation.monotonicCounter,
          mutationId: mutation.mutationId,
          mutationType: mutation.mutationType,
          payload: mutation.payload,
          payloadHash: mutationHash,
          payloadVersion: mutation.payloadVersion,
          replayStatus: "new",
          tenantId: ctx.tenantId,
          terminalId: input.terminalId,
          terminalRowId: terminal.id,
          updatedBy: ctx.actorUserId ?? null,
          upcastStatus: "pending",
        })
        .returning()
    ).at(0);
    if (!inserted) {
      throw new Error("failed to record offline sync mutation");
    }
    accepted.push({
      id: inserted.id,
      monotonicCounter: inserted.monotonicCounter,
      mutationId: inserted.mutationId,
      replayStatus: inserted.replayStatus,
      upcastStatus: inserted.upcastStatus,
    });
  }

  return {
    acceptedMutationCount: accepted.length,
    batchId: batch.id,
    mutations: accepted,
    replayedBatch: false,
    terminalRowId: terminal.id,
  };
}
