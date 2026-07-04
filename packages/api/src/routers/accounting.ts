import { db, schema, services, withTenant } from "@RetailOS/db";
import { ORPCError } from "@orpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { tenantProcedure } from "../index";
import { assertPermission } from "./vs1";

// Phase 5 (Accounting Foundation) lives in its own module — extracted from
// vs1.ts (same file-size-hygiene reasoning as procurement.ts) and extended
// with the read endpoints the mutation-only router never had: the mutations
// (ledgerAccountCreate/postingPeriodCreate/journalCreateDraft/journalPost)
// shipped with the Phase-5 foundation port, but nothing could ever read them
// back — the exact "correct component, no consumer" gap class (lessons-
// learned #entry on Phase-2 costing_method_applied). `postingPeriodClose`
// existed as a service function with no router mutation at all.

function mapAccountingError(error: unknown): never {
  if (error instanceof services.AccountingError) {
    const code = error.code === "NOT_FOUND" ? "NOT_FOUND" : "BAD_REQUEST";
    throw new ORPCError(code, { message: error.message });
  }
  throw error;
}

export const accountingRouter = {
  ledgerAccountCreate: tenantProcedure
    .input(
      z.object({
        code: z.string().min(1).max(64),
        name: z.string().min(1).max(255),
        type: z.enum(schema.ACCOUNT_TYPES),
        normalBalance: z.enum(schema.NORMAL_BALANCES),
      })
    )
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "accounting.manage");
        return services.createLedgerAccount(tx, ctx, input);
      });
    }),
  ledgerAccountList: tenantProcedure
    .input(z.object({ includeArchived: z.boolean().default(false) }))
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "accounting.manage");
        const conditions = input.includeArchived
          ? undefined
          : eq(schema.ledgerAccount.status, "active");
        return tx
          .select({
            id: schema.ledgerAccount.id,
            code: schema.ledgerAccount.code,
            name: schema.ledgerAccount.name,
            type: schema.ledgerAccount.type,
            normalBalance: schema.ledgerAccount.normalBalance,
            status: schema.ledgerAccount.status,
          })
          .from(schema.ledgerAccount)
          .where(conditions)
          .orderBy(schema.ledgerAccount.code);
      });
    }),
  postingPeriodCreate: tenantProcedure
    .input(
      z.object({
        name: z.string().min(1).max(128),
        startsOn: z.coerce.date(),
        endsOn: z.coerce.date(),
      })
    )
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "accounting.manage");
        return services.createPostingPeriod(tx, ctx, input);
      });
    }),
  postingPeriodList: tenantProcedure.handler(({ context }) => {
    const ctx = context.requestContext;
    return withTenant(db, ctx.tenantId, async (tx) => {
      await assertPermission(tx, ctx, "accounting.manage");
      return tx
        .select({
          id: schema.postingPeriod.id,
          name: schema.postingPeriod.name,
          startsOn: schema.postingPeriod.startsOn,
          endsOn: schema.postingPeriod.endsOn,
          status: schema.postingPeriod.status,
        })
        .from(schema.postingPeriod)
        .orderBy(desc(schema.postingPeriod.startsOn));
    });
  }),
  postingPeriodClose: tenantProcedure
    .input(z.object({ postingPeriodId: z.string().uuid() }))
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "accounting.manage");
        try {
          return await services.closePostingPeriod(
            tx,
            ctx,
            input.postingPeriodId
          );
        } catch (error) {
          return mapAccountingError(error);
        }
      });
    }),
  journalCreateDraft: tenantProcedure
    .input(
      z.object({
        postingPeriodId: z.string().uuid(),
        memo: z.string().max(1000).optional(),
        source: z.enum(["manual", "opening_balance", "procurement"]).optional(),
        sourceDocumentId: z.string().uuid().optional(),
        lines: z
          .array(
            z.object({
              accountId: z.string().uuid(),
              debitMinor: z.number().int().nonnegative().optional(),
              creditMinor: z.number().int().nonnegative().optional(),
              currency: z.string().min(3).max(3),
              scale: z.number().int().min(0).max(6).default(2),
              memo: z.string().max(500).optional(),
            })
          )
          .min(2),
      })
    )
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "accounting.manage");
        return services.createDraftJournal(tx, ctx, input);
      });
    }),
  journalList: tenantProcedure
    .input(
      z.object({
        postingPeriodId: z.string().uuid().optional(),
        limit: z.number().int().min(1).max(100).default(50),
      })
    )
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "accounting.manage");
        const conditions = input.postingPeriodId
          ? eq(schema.journal.postingPeriodId, input.postingPeriodId)
          : undefined;
        return tx
          .select({
            id: schema.journal.id,
            postingPeriodId: schema.journal.postingPeriodId,
            postingPeriodName: schema.postingPeriod.name,
            source: schema.journal.source,
            sourceDocumentId: schema.journal.sourceDocumentId,
            memo: schema.journal.memo,
            status: schema.journal.status,
            postedAt: schema.journal.postedAt,
            createdAt: schema.journal.createdAt,
          })
          .from(schema.journal)
          .innerJoin(
            schema.postingPeriod,
            and(
              eq(schema.postingPeriod.tenantId, schema.journal.tenantId),
              eq(schema.postingPeriod.id, schema.journal.postingPeriodId)
            )
          )
          .where(conditions)
          .orderBy(desc(schema.journal.createdAt))
          .limit(input.limit);
      });
    }),
  journalDetail: tenantProcedure
    .input(z.object({ journalId: z.string().uuid() }))
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "accounting.manage");
        const header = (
          await tx
            .select({
              id: schema.journal.id,
              postingPeriodId: schema.journal.postingPeriodId,
              postingPeriodName: schema.postingPeriod.name,
              source: schema.journal.source,
              sourceDocumentId: schema.journal.sourceDocumentId,
              memo: schema.journal.memo,
              status: schema.journal.status,
              postedAt: schema.journal.postedAt,
              createdAt: schema.journal.createdAt,
            })
            .from(schema.journal)
            .innerJoin(
              schema.postingPeriod,
              and(
                eq(schema.postingPeriod.tenantId, schema.journal.tenantId),
                eq(schema.postingPeriod.id, schema.journal.postingPeriodId)
              )
            )
            .where(
              and(
                eq(schema.journal.tenantId, ctx.tenantId),
                eq(schema.journal.id, input.journalId)
              )
            )
            .limit(1)
        ).at(0);
        if (!header) {
          throw new ORPCError("NOT_FOUND", { message: "Journal not found" });
        }
        const lines = await tx
          .select({
            id: schema.journalLine.id,
            accountId: schema.journalLine.accountId,
            accountCode: schema.ledgerAccount.code,
            accountName: schema.ledgerAccount.name,
            debitMinor: schema.journalLine.debitMinor,
            creditMinor: schema.journalLine.creditMinor,
            currency: schema.journalLine.currency,
            scale: schema.journalLine.scale,
            memo: schema.journalLine.memo,
          })
          .from(schema.journalLine)
          .innerJoin(
            schema.ledgerAccount,
            and(
              eq(schema.ledgerAccount.tenantId, schema.journalLine.tenantId),
              eq(schema.ledgerAccount.id, schema.journalLine.accountId)
            )
          )
          .where(
            and(
              eq(schema.journalLine.tenantId, ctx.tenantId),
              eq(schema.journalLine.journalId, input.journalId)
            )
          )
          .orderBy(schema.journalLine.createdAt);
        return { ...header, lines };
      });
    }),
  journalPost: tenantProcedure
    .input(z.object({ journalId: z.string().uuid() }))
    .handler(({ context, input }) => {
      const ctx = context.requestContext;
      return withTenant(db, ctx.tenantId, async (tx) => {
        await assertPermission(tx, ctx, "accounting.manage");
        try {
          return await services.postJournal(tx, ctx, input.journalId);
        } catch (error) {
          return mapAccountingError(error);
        }
      });
    }),
};
