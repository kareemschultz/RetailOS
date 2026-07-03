import {
  foreignKey,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { actor, tenantId, timestamps } from "./columns";

// Charter §25 PII vault: erasable PII (name, contact, delivery address) never
// lives in raw operational columns. Every subject gets a random Data
// Encryption Key (DEK), wrapped ("envelope encrypted") under the platform
// master key (`PII_VAULT_MASTER_KEY_BASE64`, services/pii-vault.ts). Each
// field is encrypted under the unwrapped DEK. Right-to-erasure = nulling
// `wrapped_dek` — every field ciphertext becomes permanently undecryptable
// (crypto-shredding) while the operational row that references the subject
// (e.g. `customer`) survives untouched.
//
// This must be wired before any caller (Shopix customer/order) persists raw
// PII columns — retrofitting PII out of operational columns later is a
// painful migration (design doc §10).

export const piiVaultSubject = pgTable(
  "pii_vault_subject",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId,
    // base64(iv(12) || authTag(16) || ciphertext) of the per-subject DEK,
    // AES-256-GCM under the master key. NULL = erased (crypto-shredded).
    wrappedDek: text("wrapped_dek"),
    erasedAt: timestamp("erased_at", { withTimezone: true }),
    ...timestamps,
    ...actor,
  },
  (table) => [
    index("pii_vault_subject_tenantId_idx").on(table.tenantId),
    // Composite-FK target (H1 discipline — every cross-entity ref proven
    // tenant-scoped at the DB layer, not just the router).
    unique("pii_vault_subject_tenant_id_uq").on(table.tenantId, table.id),
  ]
);

export const piiVaultField = pgTable(
  "pii_vault_field",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId,
    subjectId: uuid("subject_id").notNull(),
    // e.g. "name", "email", "phone", "delivery_address". Free text so new
    // fields never need a migration — the vault is a generic KV store per
    // subject, not a fixed schema.
    fieldKey: text("field_key").notNull(),
    // base64(iv(12) || authTag(16) || ciphertext), AES-256-GCM under the
    // subject's (unwrapped) DEK. Garbage once wrappedDek is nulled.
    ciphertext: text("ciphertext").notNull(),
    ...timestamps,
  },
  (table) => [
    unique("pii_vault_field_tenant_subject_key_uq").on(
      table.tenantId,
      table.subjectId,
      table.fieldKey
    ),
    index("pii_vault_field_tenantId_idx").on(table.tenantId),
    foreignKey({
      columns: [table.tenantId, table.subjectId],
      foreignColumns: [piiVaultSubject.tenantId, piiVaultSubject.id],
      name: "pii_vault_field_subject_composite_fk",
    }),
  ]
);
