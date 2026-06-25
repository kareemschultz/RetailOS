import { relations } from "drizzle-orm";
import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";
import {
  BLIND_CLOSE_MODES,
  CASH_DRAWER_MODES,
  COSTING_METHODS,
  EXPIRY_POLICIES,
  OVERSELL_POLICIES,
  REMOVAL_STRATEGIES,
  RETURN_COSTING_POLICIES,
  SHIFT_ENFORCEMENT_MODES,
} from "./product";

// Better Auth `organization` plugin tables (charter §6/§8). A RetailOS tenant
// maps 1:1 to an organization; `organization.id` is the `tenant_id` value used
// across every tenant-owned table.

export const organization = pgTable("organization", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").unique(),
  logo: text("logo"),
  metadata: text("metadata"),
  // Tenant-default strategy settings (resolver §6: platform default below these).
  // Financial settings (costing) stay tenant/category level; operational
  // settings (removal/return) may also resolve deeper (product/category).
  costingMethod: text("costing_method", { enum: COSTING_METHODS }),
  removalStrategy: text("removal_strategy", { enum: REMOVAL_STRATEGIES }),
  returnCostingPolicy: text("return_costing_policy", {
    enum: RETURN_COSTING_POLICIES,
  }),
  oversellPolicy: text("oversell_policy", { enum: OVERSELL_POLICIES }),
  expiryPolicy: text("expiry_policy", { enum: EXPIRY_POLICIES }),
  barcodeParserConfig: jsonb("barcode_parser_config"),
  // Phase-4 Commit 4 — tenant-level cash-control toggles (resolver §6; platform
  // default applies below these). NULL ⇒ fall through to the platform default
  // (shift_enforcement=optional, blind_close=on, cash_drawer=on). Same text-enum
  // (no-CHECK) precedent as costingMethod/oversellPolicy above; the resolver +
  // Zod only ever write known values.
  shiftEnforcement: text("shift_enforcement", {
    enum: SHIFT_ENFORCEMENT_MODES,
  }),
  blindClose: text("blind_close", { enum: BLIND_CLOSE_MODES }),
  cashDrawer: text("cash_drawer", { enum: CASH_DRAWER_MODES }),
  // Tax-identity SEAMS (charter §17 fiscal / §19 tax-invoice fields). Nullable,
  // expand-only: a tenant's VAT registration number + tax identification number
  // (TIN) for fiscal documents and tax filings (e.g. Guyana GRA tax-invoice +
  // Form G0002). No validation/format rules wired yet — reserved for the
  // fiscalization phase; the company-level pair (below) is the per-legal-entity
  // value when a tenant runs multiple companies.
  vatRegistrationNumber: text("vat_registration_number"),
  taxIdentificationNumber: text("tax_identification_number"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const member = pgTable(
  "member",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").default("member").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("member_organizationId_idx").on(table.organizationId),
    index("member_userId_idx").on(table.userId),
  ]
);

export const invitation = pgTable(
  "invitation",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role"),
    status: text("status").default("pending").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    inviterId: text("inviter_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("invitation_organizationId_idx").on(table.organizationId)]
);

export const organizationRelations = relations(organization, ({ many }) => ({
  members: many(member),
  invitations: many(invitation),
}));

export const memberRelations = relations(member, ({ one }) => ({
  organization: one(organization, {
    fields: [member.organizationId],
    references: [organization.id],
  }),
  user: one(user, { fields: [member.userId], references: [user.id] }),
}));

export const invitationRelations = relations(invitation, ({ one }) => ({
  organization: one(organization, {
    fields: [invitation.organizationId],
    references: [organization.id],
  }),
  inviter: one(user, {
    fields: [invitation.inviterId],
    references: [user.id],
  }),
}));
