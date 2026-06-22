import { outboxEvent } from "../schema";
import type { TenantTransaction } from "../tenant";
import type { ServiceContext } from "./types";

// VS#1 domain event types (charter §24). Consumed in later phases.
export const DomainEventType = {
  InventoryAdjusted: "inventory.adjusted",
  // §3 — emitted when negative on-hand is reconciled by a later receipt that
  // establishes actual cost (Phase 5 Accounting consumes it). Contract defined
  // in event-map-phase2.md; emit wiring is deferred behavior (reconciliation).
  InventoryCostReconciliation: "inventory.cost_reconciliation",
  InventoryCountPosted: "inventory.count_posted",
  InventoryCountStarted: "inventory.count_started",
  InventoryReceived: "inventory.received",
  InventoryReorderTriggered: "inventory.reorder_triggered",
  InventoryRevalued: "inventory.revalued",
  InventoryStockDiscrepancyReviewed: "inventory.stock_discrepancy_reviewed",
  InventoryStockDiscrepancy: "inventory.stock_discrepancy",
  InventoryValuationUpdated: "inventory.valuation_updated",
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
//
// occurredAt (event-map-phase2.md, §14): every payload carries a SERVER-set
// `occurredAt`. Server time is authoritative; device clocks are never trusted
// for event ordering. It is injected here — not by producers — so it is
// uniform across every event and a producer cannot override it (it is applied
// LAST in the spread, so any caller-supplied `occurredAt` is discarded).
export async function emitEvent(
  tx: TenantTransaction,
  ctx: ServiceContext,
  event: DomainEventInput
) {
  const occurredAt = new Date().toISOString();
  const basePayload =
    event.payload != null &&
    typeof event.payload === "object" &&
    !Array.isArray(event.payload)
      ? (event.payload as Record<string, unknown>)
      : { value: event.payload };
  const payload: Record<string, unknown> = { ...basePayload, occurredAt };
  const inserted = await tx
    .insert(outboxEvent)
    .values({
      tenantId: ctx.tenantId,
      type: event.type,
      version: event.version ?? 1,
      payload,
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
