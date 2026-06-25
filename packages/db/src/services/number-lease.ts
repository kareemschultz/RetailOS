import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import {
  type NumberLeaseStatus,
  numberBlock,
  numberLease,
  numberLeaseUsage,
} from "../schema";
import type { TenantTransaction } from "../tenant";
import { recordAudit } from "./audit";
import { hashPayload } from "./idempotency";
import type { ServiceContext } from "./types";

const DEFAULT_LEASE_TTL_MINUTES = 24 * 60;
const DEFAULT_LEASE_RANGE_END = 2_147_483_647;

export class NumberLeaseConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NumberLeaseConflictError";
  }
}

export interface AllocateNumberLeaseInput {
  companyId: string;
  deviceId?: string | null;
  docType: string;
  expiresAt?: Date | null;
  fiscalYear?: number | null;
  idempotencyKey: string;
  leaseSize: number;
  locationId?: string | null;
  series?: string | null;
  terminalId: string;
  ttlMinutes?: number | null;
}

export interface ConsumeNumberInput {
  leaseId: string;
  number: number;
  sourceId?: string | null;
  sourceType?: string | null;
}

export interface CurrentNumberLeaseInput {
  companyId?: string | null;
  docType?: string | null;
  locationId?: string | null;
  series?: string | null;
  terminalId: string;
}

export interface ReclaimNumberLeaseInput {
  leaseId: string;
  reason: string;
  terminalId: string;
}

export interface ReportSkippedNumbersInput {
  fromNumber: number;
  leaseId: string;
  reason: string;
  sourceId?: string | null;
  sourceType?: string | null;
  toNumber: number;
}

type NumberLeaseRow = typeof numberLease.$inferSelect;
type NumberBlockRow = typeof numberBlock.$inferSelect;

function allocationPayload(input: AllocateNumberLeaseInput) {
  return {
    companyId: input.companyId,
    deviceId: input.deviceId ?? null,
    docType: input.docType,
    expiresAt: input.expiresAt?.toISOString() ?? null,
    fiscalYear: input.fiscalYear ?? null,
    leaseSize: input.leaseSize,
    locationId: input.locationId ?? null,
    series: input.series ?? "default",
    terminalId: input.terminalId,
    ttlMinutes: input.ttlMinutes ?? null,
  };
}

function assertPositiveInteger(value: number, field: string) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${field} must be a positive integer`);
  }
}

function assertNonBlank(value: string, field: string) {
  if (!value.trim()) {
    throw new Error(`${field} is required`);
  }
}

function resolveExpiresAt(input: AllocateNumberLeaseInput): Date {
  if (input.expiresAt) {
    return input.expiresAt;
  }
  const ttlMinutes = input.ttlMinutes ?? DEFAULT_LEASE_TTL_MINUTES;
  assertPositiveInteger(ttlMinutes, "ttlMinutes");
  return new Date(Date.now() + ttlMinutes * 60_000);
}

async function lockAllocationScope(
  tx: TenantTransaction,
  ctx: ServiceContext,
  input: AllocateNumberLeaseInput
) {
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${`number_block:${ctx.tenantId}:${input.companyId}:${input.docType}:${
      input.series ?? "default"
    }`}, 0))`
  );
}

async function lockIdempotencyKey(
  tx: TenantTransaction,
  ctx: ServiceContext,
  key: string
) {
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${`number_lease_idem:${ctx.tenantId}:${key}`}, 0))`
  );
}

async function getOrCreateNumberBlock(
  tx: TenantTransaction,
  ctx: ServiceContext,
  input: AllocateNumberLeaseInput
): Promise<NumberBlockRow> {
  const series = input.series ?? "default";
  const existing = await tx
    .select()
    .from(numberBlock)
    .where(
      and(
        eq(numberBlock.companyId, input.companyId),
        eq(numberBlock.docType, input.docType),
        eq(numberBlock.series, series)
      )
    )
    .for("update")
    .limit(1);
  const current = existing.at(0);
  if (current) {
    if (
      (current.locationId ?? null) !== (input.locationId ?? null) ||
      (current.fiscalYear ?? null) !== (input.fiscalYear ?? null)
    ) {
      throw new NumberLeaseConflictError(
        "number block scope mismatch for location/fiscal year"
      );
    }
    return current;
  }

  const inserted = await tx
    .insert(numberBlock)
    .values({
      companyId: input.companyId,
      docType: input.docType,
      fiscalYear: input.fiscalYear ?? null,
      locationId: input.locationId ?? null,
      next: 1,
      rangeEnd: DEFAULT_LEASE_RANGE_END,
      rangeStart: 1,
      series,
      tenantId: ctx.tenantId,
    })
    .returning();
  const block = inserted.at(0);
  if (!block) {
    throw new Error("number lease allocation failed to create number block");
  }
  return block;
}

function assertLeaseUsable(lease: NumberLeaseRow) {
  if (lease.status !== "active") {
    throw new NumberLeaseConflictError(
      `number lease ${lease.id} is ${lease.status}`
    );
  }
  if (lease.expiresAt <= new Date()) {
    throw new NumberLeaseConflictError(`number lease ${lease.id} is expired`);
  }
}

async function loadLeaseForUpdate(
  tx: TenantTransaction,
  leaseId: string
): Promise<NumberLeaseRow> {
  const rows = await tx
    .select()
    .from(numberLease)
    .where(eq(numberLease.id, leaseId))
    .for("update")
    .limit(1);
  const lease = rows.at(0);
  if (!lease) {
    throw new Error(`number lease ${leaseId} not found`);
  }
  return lease;
}

async function insertUsageRows(
  tx: TenantTransaction,
  ctx: ServiceContext,
  lease: NumberLeaseRow,
  input: {
    fromNumber: number;
    reason?: string | null;
    sourceId?: string | null;
    sourceType?: string | null;
    status: "consumed" | "skipped" | "voided";
    toNumber: number;
  }
) {
  if (input.fromNumber > input.toNumber) {
    return;
  }
  if (input.fromNumber < lease.rangeStart || input.toNumber > lease.rangeEnd) {
    throw new NumberLeaseConflictError("usage range is outside the lease");
  }

  const existing = await tx
    .select({ number: numberLeaseUsage.number })
    .from(numberLeaseUsage)
    .where(
      and(
        eq(numberLeaseUsage.leaseId, lease.id),
        gte(numberLeaseUsage.number, input.fromNumber),
        lte(numberLeaseUsage.number, input.toNumber)
      )
    )
    .limit(1);
  if (existing.length > 0) {
    throw new NumberLeaseConflictError("number lease usage already exists");
  }

  const rows: (typeof numberLeaseUsage.$inferInsert)[] = [];
  for (let number = input.fromNumber; number <= input.toNumber; number += 1) {
    rows.push({
      companyId: lease.companyId,
      createdBy: ctx.actorUserId ?? null,
      docType: lease.docType,
      fiscalYear: lease.fiscalYear ?? null,
      leaseId: lease.id,
      locationId: lease.locationId ?? null,
      number,
      numberBlockId: lease.numberBlockId,
      reason: input.reason ?? null,
      series: lease.series,
      sourceId: input.sourceId ?? null,
      sourceType: input.sourceType ?? null,
      status: input.status,
      tenantId: ctx.tenantId,
      updatedBy: ctx.actorUserId ?? null,
    });
  }
  await tx.insert(numberLeaseUsage).values(rows);
}

async function loadUsageRows(
  tx: TenantTransaction,
  lease: NumberLeaseRow,
  fromNumber: number,
  toNumber: number
) {
  return await tx
    .select()
    .from(numberLeaseUsage)
    .where(
      and(
        eq(numberLeaseUsage.leaseId, lease.id),
        gte(numberLeaseUsage.number, fromNumber),
        lte(numberLeaseUsage.number, toNumber)
      )
    )
    .orderBy(numberLeaseUsage.number);
}

async function reloadLease(
  tx: TenantTransaction,
  leaseId: string
): Promise<NumberLeaseRow> {
  const rows = await tx
    .select()
    .from(numberLease)
    .where(eq(numberLease.id, leaseId))
    .limit(1);
  const lease = rows.at(0);
  if (!lease) {
    throw new Error(`number lease ${leaseId} not found`);
  }
  return lease;
}

async function updateLeaseCursor(
  tx: TenantTransaction,
  lease: NumberLeaseRow,
  nextNumber: number,
  status?: NumberLeaseStatus
): Promise<NumberLeaseRow> {
  const values: Partial<typeof numberLease.$inferInsert> = {
    nextNumber,
    updatedAt: new Date(),
  };
  if (status) {
    values.status = status;
    if (status === "exhausted") {
      values.exhaustedAt = new Date();
    }
    if (status === "reclaimed") {
      values.reclaimedAt = new Date();
    }
  }
  const rows = await tx
    .update(numberLease)
    .set(values)
    .where(eq(numberLease.id, lease.id))
    .returning();
  const updated = rows.at(0);
  if (!updated) {
    throw new Error("number lease cursor update failed");
  }
  return updated;
}

export async function allocateNumberLease(
  tx: TenantTransaction,
  ctx: ServiceContext,
  input: AllocateNumberLeaseInput
): Promise<NumberLeaseRow> {
  assertNonBlank(input.idempotencyKey, "idempotencyKey");
  assertNonBlank(input.companyId, "companyId");
  assertNonBlank(input.docType, "docType");
  assertNonBlank(input.terminalId, "terminalId");
  assertPositiveInteger(input.leaseSize, "leaseSize");
  const requestHash = hashPayload(allocationPayload(input));

  await lockIdempotencyKey(tx, ctx, input.idempotencyKey);
  const replay = await tx
    .select()
    .from(numberLease)
    .where(eq(numberLease.idempotencyKey, input.idempotencyKey))
    .for("update")
    .limit(1);
  const existingLease = replay.at(0);
  if (existingLease) {
    if (existingLease.requestHash !== requestHash) {
      throw new NumberLeaseConflictError(
        "number lease idempotency key was reused with a different request"
      );
    }
    return existingLease;
  }

  await lockAllocationScope(tx, ctx, input);
  const block = await getOrCreateNumberBlock(tx, ctx, input);
  const rangeStart = block.next;
  const rangeEnd = rangeStart + input.leaseSize - 1;
  if (rangeEnd > block.rangeEnd) {
    throw new NumberLeaseConflictError("number block is exhausted");
  }

  const inserted = await tx
    .insert(numberLease)
    .values({
      companyId: input.companyId,
      createdBy: ctx.actorUserId ?? null,
      deviceId: input.deviceId ?? null,
      docType: input.docType,
      expiresAt: resolveExpiresAt(input),
      fiscalYear: input.fiscalYear ?? null,
      idempotencyKey: input.idempotencyKey,
      locationId: input.locationId ?? null,
      nextNumber: rangeStart,
      numberBlockId: block.id,
      rangeEnd,
      rangeStart,
      requestHash,
      series: input.series ?? "default",
      status: "active",
      terminalId: input.terminalId,
      tenantId: ctx.tenantId,
      updatedBy: ctx.actorUserId ?? null,
    })
    .returning();
  const lease = inserted.at(0);
  if (!lease) {
    throw new Error("number lease allocation failed");
  }

  await tx
    .update(numberBlock)
    .set({ next: rangeEnd + 1, updatedAt: new Date() })
    .where(eq(numberBlock.id, block.id));
  await recordAudit(tx, ctx, {
    action: "number_lease.allocate",
    after: {
      docType: lease.docType,
      idempotencyKey: lease.idempotencyKey,
      rangeEnd: lease.rangeEnd,
      rangeStart: lease.rangeStart,
      terminalId: lease.terminalId,
    },
    entityId: lease.id,
    entityType: "number_lease",
  });
  return lease;
}

export async function getCurrentNumberLease(
  tx: TenantTransaction,
  _ctx: ServiceContext,
  input: CurrentNumberLeaseInput
): Promise<NumberLeaseRow | null> {
  const filters = [
    eq(numberLease.terminalId, input.terminalId),
    eq(numberLease.status, "active"),
  ];
  if (input.companyId) {
    filters.push(eq(numberLease.companyId, input.companyId));
  }
  if (input.locationId) {
    filters.push(eq(numberLease.locationId, input.locationId));
  }
  if (input.docType) {
    filters.push(eq(numberLease.docType, input.docType));
  }
  if (input.series) {
    filters.push(eq(numberLease.series, input.series));
  }
  const rows = await tx
    .select()
    .from(numberLease)
    .where(and(...filters))
    .orderBy(desc(numberLease.createdAt))
    .limit(1);
  return rows.at(0) ?? null;
}

export async function consumeNumberFromLease(
  tx: TenantTransaction,
  ctx: ServiceContext,
  input: ConsumeNumberInput
): Promise<NumberLeaseRow> {
  assertPositiveInteger(input.number, "number");
  const lease = await loadLeaseForUpdate(tx, input.leaseId);
  const priorUsage = (
    await loadUsageRows(tx, lease, input.number, input.number)
  ).at(0);
  if (
    priorUsage?.status === "consumed" &&
    priorUsage.sourceId === (input.sourceId ?? null) &&
    priorUsage.sourceType === (input.sourceType ?? null)
  ) {
    return reloadLease(tx, lease.id);
  }
  assertLeaseUsable(lease);
  if (input.number !== lease.nextNumber) {
    throw new NumberLeaseConflictError(
      `expected number ${lease.nextNumber}, received ${input.number}`
    );
  }

  await insertUsageRows(tx, ctx, lease, {
    fromNumber: input.number,
    sourceId: input.sourceId ?? null,
    sourceType: input.sourceType ?? null,
    status: "consumed",
    toNumber: input.number,
  });
  const nextNumber = input.number + 1;
  const status = nextNumber > lease.rangeEnd ? "exhausted" : undefined;
  const updated = await updateLeaseCursor(tx, lease, nextNumber, status);
  await tx
    .update(numberLease)
    .set({ consumedThrough: input.number, updatedAt: new Date() })
    .where(eq(numberLease.id, lease.id));
  await recordAudit(tx, ctx, {
    action: "number_lease.consume",
    after: { number: input.number, sourceId: input.sourceId ?? null },
    entityId: lease.id,
    entityType: "number_lease",
  });
  return { ...updated, consumedThrough: input.number };
}

export async function reportSkippedNumbers(
  tx: TenantTransaction,
  ctx: ServiceContext,
  input: ReportSkippedNumbersInput
): Promise<NumberLeaseRow> {
  assertPositiveInteger(input.fromNumber, "fromNumber");
  assertPositiveInteger(input.toNumber, "toNumber");
  assertNonBlank(input.reason, "reason");
  if (input.fromNumber > input.toNumber) {
    throw new Error("fromNumber must be <= toNumber");
  }
  const lease = await loadLeaseForUpdate(tx, input.leaseId);
  const priorUsage = await loadUsageRows(
    tx,
    lease,
    input.fromNumber,
    input.toNumber
  );
  if (
    priorUsage.length === input.toNumber - input.fromNumber + 1 &&
    priorUsage.every(
      (row, index) =>
        row.number === input.fromNumber + index &&
        row.status === "skipped" &&
        row.reason === input.reason &&
        row.sourceId === (input.sourceId ?? null) &&
        row.sourceType === (input.sourceType ?? null)
    )
  ) {
    return reloadLease(tx, lease.id);
  }
  assertLeaseUsable(lease);
  if (input.fromNumber !== lease.nextNumber) {
    throw new NumberLeaseConflictError(
      `skips must start at next number ${lease.nextNumber}`
    );
  }

  await insertUsageRows(tx, ctx, lease, {
    fromNumber: input.fromNumber,
    reason: input.reason,
    sourceId: input.sourceId ?? null,
    sourceType: input.sourceType ?? null,
    status: "skipped",
    toNumber: input.toNumber,
  });
  const nextNumber = input.toNumber + 1;
  const status = nextNumber > lease.rangeEnd ? "exhausted" : undefined;
  const updated = await updateLeaseCursor(tx, lease, nextNumber, status);
  await recordAudit(tx, ctx, {
    action: "number_lease.skip",
    after: {
      fromNumber: input.fromNumber,
      reason: input.reason,
      toNumber: input.toNumber,
    },
    entityId: lease.id,
    entityType: "number_lease",
  });
  return updated;
}

export async function reclaimNumberLease(
  tx: TenantTransaction,
  ctx: ServiceContext,
  input: ReclaimNumberLeaseInput
): Promise<NumberLeaseRow> {
  assertNonBlank(input.reason, "reason");
  assertNonBlank(input.terminalId, "terminalId");
  const lease = await loadLeaseForUpdate(tx, input.leaseId);
  if (lease.terminalId !== input.terminalId) {
    throw new NumberLeaseConflictError(
      "number lease can only be reclaimed by its owning terminal"
    );
  }
  if (lease.status === "reclaimed" || lease.status === "exhausted") {
    return lease;
  }
  if (lease.status === "active" && lease.expiresAt > new Date()) {
    throw new NumberLeaseConflictError(
      "active number lease cannot be reclaimed before expiry"
    );
  }
  if (lease.status !== "active" && lease.status !== "expired") {
    throw new NumberLeaseConflictError(
      `number lease ${lease.id} cannot be reclaimed from ${lease.status}`
    );
  }
  if (lease.nextNumber <= lease.rangeEnd) {
    await insertUsageRows(tx, ctx, lease, {
      fromNumber: lease.nextNumber,
      reason: input.reason,
      status: "skipped",
      toNumber: lease.rangeEnd,
    });
  }
  const updated = await updateLeaseCursor(
    tx,
    lease,
    lease.rangeEnd + 1,
    "reclaimed"
  );
  await recordAudit(tx, ctx, {
    action: "number_lease.reclaim",
    after: {
      reason: input.reason,
      skippedFrom: lease.nextNumber <= lease.rangeEnd ? lease.nextNumber : null,
      skippedTo: lease.nextNumber <= lease.rangeEnd ? lease.rangeEnd : null,
    },
    entityId: lease.id,
    entityType: "number_lease",
  });
  return updated;
}

export async function markExpiredNumberLease(
  tx: TenantTransaction,
  ctx: ServiceContext,
  leaseId: string
): Promise<NumberLeaseRow> {
  const lease = await loadLeaseForUpdate(tx, leaseId);
  if (lease.status !== "active") {
    return lease;
  }
  const rows = await tx
    .update(numberLease)
    .set({ status: "expired", updatedAt: new Date() })
    .where(eq(numberLease.id, lease.id))
    .returning();
  const expired = rows.at(0);
  if (!expired) {
    throw new Error("number lease expiry update failed");
  }
  await recordAudit(tx, ctx, {
    action: "number_lease.expire",
    after: { expiresAt: lease.expiresAt.toISOString() },
    entityId: lease.id,
    entityType: "number_lease",
  });
  return expired;
}
