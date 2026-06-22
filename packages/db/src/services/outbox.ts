import { outboxEvent } from "../schema";
import type { TenantTransaction } from "../tenant";
import type { ServiceContext } from "./types";

// VS#1 domain event types (charter §24). Consumed in later phases.
export const DomainEventType = {
  InventoryReceived: "inventory.received",
  SaleCreated: "sale.created",
} as const;

export type DomainEventType =
  (typeof DomainEventType)[keyof typeof DomainEventType];

export interface DomainEventInput {
  payload: unknown;
  type: string;
  // Event-schema version for upcasting later consumers (charter §24). Default 1.
  version?: number;
}

// Transactional outbox emit (charter §24): writes ONE event row in the SAME
// transaction as the mutation that produced it, so the event commits atomically
// with the change and can never be emitted for an uncommitted state. The row IS
// the versioned envelope (type + version + tenant + correlation/request id +
// created_at; payload holds the data). Dispatch / consumers / Svix / DLQ /
// retry-UI / webhook delivery are deferred — nothing reads the outbox yet.
export async function emitEvent(
  tx: TenantTransaction,
  ctx: ServiceContext,
  event: DomainEventInput
) {
  const inserted = await tx
    .insert(outboxEvent)
    .values({
      tenantId: ctx.tenantId,
      type: event.type,
      version: event.version ?? 1,
      payload: event.payload as Record<string, unknown>,
      correlationId: ctx.correlationId ?? null,
      requestId: ctx.requestId ?? null,
      status: "pending",
    })
    .returning();
  const row = inserted.at(0);
  if (!row) {
    throw new Error("emitEvent: failed to insert outbox event");
  }
  return row;
}
