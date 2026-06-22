import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { tenantId } from "./columns";

// Transactional outbox (charter §24). The event row is written in the SAME
// transaction as the mutation that produced it, so an event can never be lost
// or emitted for an uncommitted change. Dispatcher / consumers / Svix / DLQ /
// retry-UI / webhook delivery are deferred — this slice only writes the row.
export const outboxEvent = pgTable(
  "outbox_event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId,
    type: text("type").notNull(),
    version: integer("version").default(1).notNull(),
    payload: jsonb("payload").notNull(),
    correlationId: text("correlation_id"),
    requestId: text("request_id"),
    // pending | dispatched (dispatch wired in a later phase)
    status: text("status").default("pending").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("outbox_event_tenantId_idx").on(table.tenantId),
    index("outbox_event_status_idx").on(table.status),
  ]
);
