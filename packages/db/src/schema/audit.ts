import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { tenantId } from "./columns";

// Immutable, append-only audit trail (charter §25). Every mutation records one
// row with the actor, the impersonator (if any), the before/after snapshots,
// and the request/correlation/idempotency identifiers from the request context.
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId,
    actorUserId: text("actor_user_id"),
    impersonatorUserId: text("impersonator_user_id"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    before: jsonb("before"),
    after: jsonb("after"),
    requestId: text("request_id"),
    correlationId: text("correlation_id"),
    idempotencyKey: text("idempotency_key"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("audit_log_tenantId_idx").on(table.tenantId),
    index("audit_log_entity_idx").on(table.entityType, table.entityId),
  ]
);
