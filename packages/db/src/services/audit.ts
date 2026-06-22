import { auditLog } from "../schema";
import type { TenantTransaction } from "../tenant";
import type { ServiceContext } from "./types";

export interface AuditInput {
  action: string;
  after?: unknown;
  before?: unknown;
  entityId?: string | null;
  entityType: string;
}

// Appends one immutable audit row per mutation (charter §25). Called inside the
// SAME transaction as the mutation it records, through the tenant-scoped tx, so
// the audit row is committed atomically with — and tenant-scoped like — the
// change it describes. The actor/impersonator/request/correlation identifiers
// come from the request context.
export async function recordAudit(
  tx: TenantTransaction,
  ctx: ServiceContext,
  input: AuditInput
) {
  const inserted = await tx
    .insert(auditLog)
    .values({
      tenantId: ctx.tenantId,
      actorUserId: ctx.actorUserId ?? null,
      impersonatorUserId: ctx.impersonatorUserId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      before: input.before ?? null,
      after: input.after ?? null,
      requestId: ctx.requestId ?? null,
      correlationId: ctx.correlationId ?? null,
    })
    .returning();
  const row = inserted.at(0);
  if (!row) {
    throw new Error("recordAudit: failed to insert audit row");
  }
  return row;
}
