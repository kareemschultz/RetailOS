import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { idempotencyKey } from "../schema";
import type { TenantTransaction } from "../tenant";
import type { ServiceContext } from "./types";

export class IdempotencyConflictError extends Error {
  constructor(key: string) {
    super(`Idempotency key '${key}' was reused with a different payload`);
    this.name = "IdempotencyConflictError";
  }
}

// Canonical JSON (recursively sorted object keys) so logically-equal payloads
// hash identically regardless of key order — otherwise {a,b} vs {b,a} would
// falsely conflict.
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value !== null && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      sorted[key] = canonicalize(source[key]);
    }
    return sorted;
  }
  return value;
}

export function hashPayload(payload: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(payload) ?? null))
    .digest("hex");
}

// Runs `fn` at most once per (tenant, key) (charter §23). A replay with the SAME
// payload returns the stored response; reuse of the key with a DIFFERENT payload
// throws IdempotencyConflictError (payload-hash protection). The store is
// tenant-owned and RLS-scoped; the row is locked FOR UPDATE so a same-key replay
// inside an overlapping transaction waits rather than double-running `fn`.
export async function runIdempotent<T>(
  tx: TenantTransaction,
  ctx: ServiceContext,
  key: string,
  payload: unknown,
  fn: () => Promise<T>
): Promise<T> {
  if (!key) {
    throw new Error("runIdempotent: a non-empty key is required");
  }
  const requestHash = hashPayload(payload);

  // Serialize concurrent first-callers for this (tenant, key) BEFORE the lookup:
  // SELECT ... FOR UPDATE locks nothing when the row doesn't exist yet, so two
  // callers could otherwise both miss it and both run `fn`. The transaction
  // advisory lock makes the loser wait, then see the inserted row.
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${`idem:${ctx.tenantId}:${key}`}, 0))`
  );

  const existing = await tx
    .select()
    .from(idempotencyKey)
    .where(eq(idempotencyKey.key, key))
    .for("update");
  const prior = existing.at(0);
  if (prior) {
    if (prior.requestHash !== requestHash) {
      throw new IdempotencyConflictError(key);
    }
    return prior.response as T;
  }

  const result = await fn();
  await tx.insert(idempotencyKey).values({
    tenantId: ctx.tenantId,
    key,
    requestHash,
    status: "completed",
    response: result as Record<string, unknown>,
  });
  return result;
}
