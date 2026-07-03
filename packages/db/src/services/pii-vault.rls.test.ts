// @vitest-environment node
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "../schema";
import { organization, piiVaultField, piiVaultSubject } from "../schema";
import { withTenant } from "../tenant";
import {
  createPiiSubject,
  erasePiiSubject,
  getPiiFields,
  setPiiField,
} from "./pii-vault";

const url = process.env.RLS_TEST_DATABASE_URL;
const TENANT = "pii_vault_slice_tenant";
const OTHER_TENANT = "pii_vault_slice_other_tenant";
const ERASED_RE = /erased/i;

describe.skipIf(!url)("PII vault envelope encryption", () => {
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;

  beforeAll(async () => {
    pool = new Pool({ connectionString: url });
    db = drizzle(pool, { schema });
    await db
      .insert(organization)
      .values([
        { id: TENANT, name: "PII Vault Slice Tenant" },
        { id: OTHER_TENANT, name: "PII Vault Slice Other Tenant" },
      ])
      .onConflictDoNothing();
    for (const tenant of [TENANT, OTHER_TENANT]) {
      await withTenant(db, tenant, async (tx) => {
        await tx.delete(piiVaultField);
        await tx.delete(piiVaultSubject);
      });
    }
  });

  afterAll(async () => {
    await pool.end();
  });

  it("round-trips an encrypted field and never stores the plaintext", async () => {
    await withTenant(db, TENANT, async (tx) => {
      const subjectId = await createPiiSubject(tx, TENANT);
      await setPiiField(tx, TENANT, subjectId, "email", "guest@example.test");

      const raw = (
        await tx
          .select({ ciphertext: piiVaultField.ciphertext })
          .from(piiVaultField)
          .limit(1)
      ).at(0);
      expect(raw?.ciphertext).toBeTruthy();
      expect(raw?.ciphertext).not.toContain("guest@example.test");

      const fields = await getPiiFields(tx, subjectId, ["email"]);
      expect(fields.email).toBe("guest@example.test");
    });
  });

  it("overwrites a field on a second write (upsert, not duplicate)", async () => {
    await withTenant(db, TENANT, async (tx) => {
      const subjectId = await createPiiSubject(tx, TENANT);
      await setPiiField(tx, TENANT, subjectId, "phone", "111-0000");
      await setPiiField(tx, TENANT, subjectId, "phone", "222-1111");

      const rows = await tx
        .select({ id: piiVaultField.id })
        .from(piiVaultField)
        .where(eq(piiVaultField.subjectId, subjectId));
      const fields = await getPiiFields(tx, subjectId, ["phone"]);
      expect(fields.phone).toBe("222-1111");
      expect(rows.length).toBe(1);
    });
  });

  it("crypto-shreds on erasure — the field becomes permanently undecryptable", async () => {
    await withTenant(db, TENANT, async (tx) => {
      const subjectId = await createPiiSubject(tx, TENANT);
      await setPiiField(tx, TENANT, subjectId, "name", "Jane Guest");
      await erasePiiSubject(tx, subjectId);

      await expect(getPiiFields(tx, subjectId, ["name"])).rejects.toThrow(
        ERASED_RE
      );

      const subject = (
        await tx
          .select({
            erasedAt: piiVaultSubject.erasedAt,
            wrappedDek: piiVaultSubject.wrappedDek,
          })
          .from(piiVaultSubject)
          .where(eq(piiVaultSubject.id, subjectId))
          .limit(1)
      ).at(0);
      expect(subject?.wrappedDek).toBeNull();
      expect(subject?.erasedAt).toBeTruthy();
    });
  });

  it("isolates subjects by tenant under RLS", async () => {
    const subjectId = await withTenant(db, OTHER_TENANT, (tx) =>
      createPiiSubject(tx, OTHER_TENANT)
    );
    await withTenant(db, TENANT, async (tx) => {
      await expect(
        setPiiField(tx, TENANT, subjectId, "email", "leak@example.test")
      ).rejects.toThrow();
    });
  });
});
