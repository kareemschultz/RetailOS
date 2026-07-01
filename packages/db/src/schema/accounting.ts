import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  date,
  foreignKey,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { actor, tenantId, timestamps } from "./columns";
import { outboxEvent } from "./outbox";

export const ACCOUNT_TYPES = [
  "asset",
  "liability",
  "equity",
  "revenue",
  "expense",
] as const;
export const ACCOUNT_STATUSES = ["active", "archived"] as const;
export const NORMAL_BALANCES = ["debit", "credit"] as const;
export const POSTING_PERIOD_STATUSES = ["open", "closed"] as const;
export const JOURNAL_STATUSES = ["draft", "posted", "reversed"] as const;
export const JOURNAL_SOURCES = [
  "manual",
  "opening_balance",
  "sale",
  "refund",
  "payment",
  "inventory",
  "transfer",
  "bond",
  "procurement",
] as const;

export const ledgerAccount = pgTable(
  "ledger_account",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId,
    code: text("code").notNull(),
    name: text("name").notNull(),
    type: text("type", { enum: ACCOUNT_TYPES }).notNull(),
    normalBalance: text("normal_balance", { enum: NORMAL_BALANCES }).notNull(),
    status: text("status", { enum: ACCOUNT_STATUSES })
      .default("active")
      .notNull(),
    ...timestamps,
    ...actor,
  },
  (table) => [
    index("ledger_account_tenantId_idx").on(table.tenantId),
    unique("ledger_account_tenant_code_uq").on(table.tenantId, table.code),
    unique("ledger_account_tenant_id_uq").on(table.tenantId, table.id),
    check(
      "ledger_account_type_chk",
      sql`${table.type} IN ('asset','liability','equity','revenue','expense')`
    ),
    check(
      "ledger_account_normal_balance_chk",
      sql`${table.normalBalance} IN ('debit','credit')`
    ),
    check(
      "ledger_account_status_chk",
      sql`${table.status} IN ('active','archived')`
    ),
  ]
);

export const postingPeriod = pgTable(
  "posting_period",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId,
    name: text("name").notNull(),
    startsOn: date("starts_on", { mode: "date" }).notNull(),
    endsOn: date("ends_on", { mode: "date" }).notNull(),
    status: text("status", { enum: POSTING_PERIOD_STATUSES })
      .default("open")
      .notNull(),
    ...timestamps,
    ...actor,
  },
  (table) => [
    index("posting_period_tenantId_idx").on(table.tenantId),
    unique("posting_period_tenant_id_uq").on(table.tenantId, table.id),
    unique("posting_period_tenant_name_uq").on(table.tenantId, table.name),
    check(
      "posting_period_date_order_chk",
      sql`${table.startsOn} <= ${table.endsOn}`
    ),
    check(
      "posting_period_status_chk",
      sql`${table.status} IN ('open','closed')`
    ),
  ]
);

export const journal = pgTable(
  "journal",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId,
    postingPeriodId: uuid("posting_period_id")
      .notNull()
      .references(() => postingPeriod.id),
    source: text("source", { enum: JOURNAL_SOURCES })
      .default("manual")
      .notNull(),
    sourceDocumentId: uuid("source_document_id"),
    sourceOutboxEventId: uuid("source_outbox_event_id").references(
      () => outboxEvent.id
    ),
    memo: text("memo"),
    status: text("status", { enum: JOURNAL_STATUSES })
      .default("draft")
      .notNull(),
    postedAt: timestamp("posted_at"),
    ...timestamps,
    ...actor,
  },
  (table) => [
    index("journal_tenantId_idx").on(table.tenantId),
    index("journal_period_idx").on(table.postingPeriodId),
    unique("journal_tenant_id_uq").on(table.tenantId, table.id),
    foreignKey({
      columns: [table.tenantId, table.postingPeriodId],
      foreignColumns: [postingPeriod.tenantId, postingPeriod.id],
      name: "journal_period_composite_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.sourceOutboxEventId],
      foreignColumns: [outboxEvent.tenantId, outboxEvent.id],
      name: "journal_outbox_event_composite_fk",
    }),
    check(
      "journal_source_chk",
      sql`${table.source} IN ('manual','opening_balance','sale','refund','payment','inventory','transfer','bond','procurement')`
    ),
    check(
      "journal_status_chk",
      sql`${table.status} IN ('draft','posted','reversed')`
    ),
  ]
);

export const journalLine = pgTable(
  "journal_line",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId,
    journalId: uuid("journal_id")
      .notNull()
      .references(() => journal.id),
    accountId: uuid("account_id")
      .notNull()
      .references(() => ledgerAccount.id),
    debitMinor: bigint("debit_minor", { mode: "number" }).default(0).notNull(),
    creditMinor: bigint("credit_minor", { mode: "number" })
      .default(0)
      .notNull(),
    currency: text("currency").notNull(),
    scale: bigint("scale", { mode: "number" }).default(2).notNull(),
    memo: text("memo"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    createdBy: text("created_by"),
  },
  (table) => [
    index("journal_line_tenantId_idx").on(table.tenantId),
    index("journal_line_journal_idx").on(table.journalId),
    index("journal_line_account_idx").on(table.accountId),
    unique("journal_line_tenant_id_uq").on(table.tenantId, table.id),
    foreignKey({
      columns: [table.tenantId, table.journalId],
      foreignColumns: [journal.tenantId, journal.id],
      name: "journal_line_journal_composite_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.accountId],
      foreignColumns: [ledgerAccount.tenantId, ledgerAccount.id],
      name: "journal_line_account_composite_fk",
    }),
    check("journal_line_debit_nonnegative_chk", sql`${table.debitMinor} >= 0`),
    check(
      "journal_line_credit_nonnegative_chk",
      sql`${table.creditMinor} >= 0`
    ),
    check(
      "journal_line_one_side_chk",
      sql`(${table.debitMinor} > 0 AND ${table.creditMinor} = 0) OR (${table.creditMinor} > 0 AND ${table.debitMinor} = 0)`
    ),
    check("journal_line_scale_nonnegative_chk", sql`${table.scale} >= 0`),
  ]
);
