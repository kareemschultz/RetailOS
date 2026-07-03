import { env } from "@RetailOS/env/server";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import * as schema from "../schema";
import type { TenantTransaction } from "../tenant";

// Charter §25 envelope encryption for erasable PII (design doc §10). Every
// subject gets a random 32-byte DEK, wrapped (AES-256-GCM) under the platform
// master key; every field is encrypted under the unwrapped DEK. Erasure nulls
// the wrapped DEK — every field ciphertext becomes permanently undecryptable
// (crypto-shredding), so `erasePiiSubject` never touches the field rows or
// any operational record that references the subject.

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getMasterKey(): Buffer {
  const base64 = env.PII_VAULT_MASTER_KEY_BASE64;
  if (!base64) {
    throw new Error(
      "PII_VAULT_MASTER_KEY_BASE64 is not configured — cannot perform PII vault operations"
    );
  }
  const key = Buffer.from(base64, "base64");
  if (key.length !== 32) {
    throw new Error(
      `PII_VAULT_MASTER_KEY_BASE64 must decode to 32 bytes (got ${key.length})`
    );
  }
  return key;
}

function encrypt(key: Buffer, plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

function decrypt(key: Buffer, encoded: string): string {
  const raw = Buffer.from(encoded, "base64");
  const iv = raw.subarray(0, IV_LENGTH);
  const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = raw.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}

export async function createPiiSubject(
  tx: TenantTransaction,
  tenantId: string,
  actorUserId?: string | null
): Promise<string> {
  const masterKey = getMasterKey();
  const dek = randomBytes(32);
  const wrappedDek = encrypt(masterKey, dek.toString("base64"));
  const row = (
    await tx
      .insert(schema.piiVaultSubject)
      .values({
        createdBy: actorUserId ?? null,
        tenantId,
        updatedBy: actorUserId ?? null,
        wrappedDek,
      })
      .returning({ id: schema.piiVaultSubject.id })
  ).at(0);
  if (!row) {
    throw new Error("Failed to create PII vault subject");
  }
  return row.id;
}

async function unwrapDek(
  tx: TenantTransaction,
  subjectId: string
): Promise<Buffer> {
  const subject = (
    await tx
      .select({ wrappedDek: schema.piiVaultSubject.wrappedDek })
      .from(schema.piiVaultSubject)
      .where(eq(schema.piiVaultSubject.id, subjectId))
      .limit(1)
  ).at(0);
  if (!subject) {
    throw new Error("PII vault subject not found");
  }
  if (!subject.wrappedDek) {
    throw new Error("PII vault subject has been erased");
  }
  const masterKey = getMasterKey();
  const dekBase64 = decrypt(masterKey, subject.wrappedDek);
  return Buffer.from(dekBase64, "base64");
}

export async function setPiiField(
  tx: TenantTransaction,
  tenantId: string,
  subjectId: string,
  fieldKey: string,
  plaintext: string
): Promise<void> {
  const dek = await unwrapDek(tx, subjectId);
  const ciphertext = encrypt(dek, plaintext);
  await tx
    .insert(schema.piiVaultField)
    .values({ ciphertext, fieldKey, subjectId, tenantId })
    .onConflictDoUpdate({
      set: { ciphertext, updatedAt: new Date() },
      target: [
        schema.piiVaultField.tenantId,
        schema.piiVaultField.subjectId,
        schema.piiVaultField.fieldKey,
      ],
    });
}

export async function getPiiFields(
  tx: TenantTransaction,
  subjectId: string,
  fieldKeys: string[]
): Promise<Record<string, string>> {
  const dek = await unwrapDek(tx, subjectId);
  const rows = await tx
    .select({
      ciphertext: schema.piiVaultField.ciphertext,
      fieldKey: schema.piiVaultField.fieldKey,
    })
    .from(schema.piiVaultField)
    .where(
      and(
        eq(schema.piiVaultField.subjectId, subjectId),
        inArray(schema.piiVaultField.fieldKey, fieldKeys)
      )
    );
  const result: Record<string, string> = {};
  for (const row of rows) {
    result[row.fieldKey] = decrypt(dek, row.ciphertext);
  }
  return result;
}

// Right-to-erasure (charter §25): destroys the subject's DEK so every field
// ciphertext is permanently undecryptable. The field rows and any operational
// record referencing this subject (e.g. `customer.piiSubjectId`) are left
// untouched — only the key is gone.
export async function erasePiiSubject(
  tx: TenantTransaction,
  subjectId: string,
  actorUserId?: string | null
): Promise<void> {
  await tx
    .update(schema.piiVaultSubject)
    .set({
      erasedAt: new Date(),
      updatedBy: actorUserId ?? null,
      wrappedDek: null,
    })
    .where(eq(schema.piiVaultSubject.id, subjectId));
}
