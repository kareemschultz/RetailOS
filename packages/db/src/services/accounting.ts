import { and, eq, sql } from "drizzle-orm";
import { journal, journalLine, ledgerAccount, postingPeriod } from "../schema";
import type { TenantTransaction } from "../tenant";
import { recordAudit } from "./audit";
import type { ServiceContext } from "./types";

export class AccountingError extends Error {
  readonly code: "CLOSED_PERIOD" | "UNBALANCED_JOURNAL" | "NOT_FOUND";

  constructor(
    message: string,
    code: "CLOSED_PERIOD" | "UNBALANCED_JOURNAL" | "NOT_FOUND"
  ) {
    super(message);
    this.code = code;
    this.name = "AccountingError";
  }
}

export interface CreateLedgerAccountInput {
  code: string;
  name: string;
  normalBalance: "credit" | "debit";
  type: "asset" | "equity" | "expense" | "liability" | "revenue";
}

export async function createLedgerAccount(
  tx: TenantTransaction,
  ctx: ServiceContext,
  input: CreateLedgerAccountInput
) {
  const row = (
    await tx
      .insert(ledgerAccount)
      .values({
        tenantId: ctx.tenantId,
        code: input.code,
        name: input.name,
        type: input.type,
        normalBalance: input.normalBalance,
        createdBy: ctx.actorUserId ?? null,
      })
      .returning()
  ).at(0);
  if (!row) {
    throw new Error("createLedgerAccount: insert failed");
  }
  await recordAudit(tx, ctx, {
    action: "accounting.ledger_account.create",
    entityType: "ledger_account",
    entityId: row.id,
    after: row,
  });
  return row;
}

export interface CreatePostingPeriodInput {
  endsOn: Date;
  name: string;
  startsOn: Date;
}

export async function createPostingPeriod(
  tx: TenantTransaction,
  ctx: ServiceContext,
  input: CreatePostingPeriodInput
) {
  const row = (
    await tx
      .insert(postingPeriod)
      .values({
        tenantId: ctx.tenantId,
        name: input.name,
        startsOn: input.startsOn,
        endsOn: input.endsOn,
        createdBy: ctx.actorUserId ?? null,
      })
      .returning()
  ).at(0);
  if (!row) {
    throw new Error("createPostingPeriod: insert failed");
  }
  await recordAudit(tx, ctx, {
    action: "accounting.posting_period.create",
    entityType: "posting_period",
    entityId: row.id,
    after: row,
  });
  return row;
}

export interface JournalDraftLineInput {
  accountId: string;
  creditMinor?: number;
  currency: string;
  debitMinor?: number;
  memo?: string | null;
  scale?: number;
}

export interface CreateDraftJournalInput {
  lines: JournalDraftLineInput[];
  memo?: string | null;
  postingPeriodId: string;
  source?: "manual" | "opening_balance" | "procurement";
  sourceDocumentId?: string | null;
}

export async function createDraftJournal(
  tx: TenantTransaction,
  ctx: ServiceContext,
  input: CreateDraftJournalInput
) {
  const header = (
    await tx
      .insert(journal)
      .values({
        tenantId: ctx.tenantId,
        postingPeriodId: input.postingPeriodId,
        source: input.source ?? "manual",
        sourceDocumentId: input.sourceDocumentId ?? null,
        memo: input.memo ?? null,
        createdBy: ctx.actorUserId ?? null,
      })
      .returning()
  ).at(0);
  if (!header) {
    throw new Error("createDraftJournal: header insert failed");
  }
  const lineRows = await tx
    .insert(journalLine)
    .values(
      input.lines.map((line) => ({
        tenantId: ctx.tenantId,
        journalId: header.id,
        accountId: line.accountId,
        debitMinor: line.debitMinor ?? 0,
        creditMinor: line.creditMinor ?? 0,
        currency: line.currency,
        scale: line.scale ?? 2,
        memo: line.memo ?? null,
        createdBy: ctx.actorUserId ?? null,
      }))
    )
    .returning();
  await recordAudit(tx, ctx, {
    action: "accounting.journal.create_draft",
    entityType: "journal",
    entityId: header.id,
    after: { ...header, lines: lineRows },
  });
  return { ...header, lines: lineRows };
}

export async function closePostingPeriod(
  tx: TenantTransaction,
  ctx: ServiceContext,
  postingPeriodId: string
) {
  const row = (
    await tx
      .update(postingPeriod)
      .set({ status: "closed", updatedBy: ctx.actorUserId ?? null })
      .where(
        and(
          eq(postingPeriod.tenantId, ctx.tenantId),
          eq(postingPeriod.id, postingPeriodId)
        )
      )
      .returning()
  ).at(0);
  if (!row) {
    throw new AccountingError("Posting period not found", "NOT_FOUND");
  }
  await recordAudit(tx, ctx, {
    action: "accounting.posting_period.close",
    entityType: "posting_period",
    entityId: row.id,
    after: row,
  });
  return row;
}

interface BalanceRow {
  credit: string | number | null;
  currency: string;
  debit: string | number | null;
  scale: string | number;
}

function asNumber(value: string | number | null | undefined): number {
  return value == null ? 0 : Number(value);
}

export async function postJournal(
  tx: TenantTransaction,
  ctx: ServiceContext,
  journalId: string
) {
  const header = (
    await tx
      .select({ id: journal.id, periodStatus: postingPeriod.status })
      .from(journal)
      .innerJoin(
        postingPeriod,
        and(
          eq(postingPeriod.tenantId, journal.tenantId),
          eq(postingPeriod.id, journal.postingPeriodId)
        )
      )
      .where(and(eq(journal.tenantId, ctx.tenantId), eq(journal.id, journalId)))
      .limit(1)
  ).at(0);
  if (!header) {
    throw new AccountingError("Journal not found", "NOT_FOUND");
  }
  if (header.periodStatus === "closed") {
    throw new AccountingError(
      "Cannot post into a closed posting period",
      "CLOSED_PERIOD"
    );
  }
  const balances = (await tx.execute(sql`
    select currency, scale, sum(debit_minor)::bigint as debit, sum(credit_minor)::bigint as credit
    from journal_line
    where tenant_id = ${ctx.tenantId} and journal_id = ${journalId}
    group by currency, scale
  `)) as unknown as { rows: BalanceRow[] };
  if (
    balances.rows.length === 0 ||
    balances.rows.some((row) => asNumber(row.debit) !== asNumber(row.credit))
  ) {
    throw new AccountingError(
      "Journal is not balanced by currency/scale",
      "UNBALANCED_JOURNAL"
    );
  }
  const row = (
    await tx
      .update(journal)
      .set({
        status: "posted",
        postedAt: new Date(),
        updatedBy: ctx.actorUserId ?? null,
      })
      .where(and(eq(journal.tenantId, ctx.tenantId), eq(journal.id, journalId)))
      .returning()
  ).at(0);
  if (!row) {
    throw new Error("postJournal: update failed");
  }
  await recordAudit(tx, ctx, {
    action: "accounting.journal.post",
    entityType: "journal",
    entityId: row.id,
    after: row,
  });
  return row;
}
