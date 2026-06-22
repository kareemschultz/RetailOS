import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { tenantId } from "./columns";

// Idempotency store (charter §23). Keyed by (tenant_id, key); stores the request
// hash + the stored response so a replay returns the same result and a key reuse
// with a DIFFERENT payload is detected as a conflict (payload-hash protection).
// Tenant-owned → covered by fail-closed RLS (ADR 0006).
export const idempotencyKey = pgTable(
  "idempotency_key",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId,
    key: text("key").notNull(),
    requestHash: text("request_hash").notNull(),
    // in_progress | completed (VS#1 stores completed results)
    status: text("status").default("completed").notNull(),
    response: jsonb("response"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    unique("idempotency_key_tenantId_key_uq").on(table.tenantId, table.key),
    index("idempotency_key_tenantId_idx").on(table.tenantId),
  ]
);
