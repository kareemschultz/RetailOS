import { and, eq, sql } from "drizzle-orm";
import {
  type BlindCloseMode,
  type CashDrawerMode,
  cashMovement,
  location,
  organization,
  type ShiftEnforcementMode,
  sale,
  tender,
} from "../schema";
import type { TenantTransaction } from "../tenant";
import { resolveSetting } from "./settings-resolver";
import type { ServiceContext } from "./types";

// Phase-4 Commit 4 — configurable cash control. ONE place owns the cash-control
// behaviour: the settings resolver. There is NO business-type branch anywhere —
// a single-store owner-operator and a multi-register chain run the same code,
// differing only by these resolved toggles (platform-first, engineering-
// principles Group F).

// Platform defaults = broadest common denominator (owner directive 2026-06-24):
// shifts MAY be opened but aren't required; blind-close + cash-drawer on.
export const PLATFORM_SHIFT_DEFAULTS = {
  blindClose: "on" as BlindCloseMode,
  cashDrawer: "on" as CashDrawerMode,
  shiftEnforcement: "optional" as ShiftEnforcementMode,
};

export interface ShiftSettings {
  blindClose: BlindCloseMode;
  cashDrawer: CashDrawerMode;
  shiftEnforcement: ShiftEnforcementMode;
}

// Resolve the three cash-control toggles for a location: location override →
// tenant default → platform default. Reuses the ONE settings resolver (location
// and tenant carry the columns; platform is the constant below). RLS scopes both
// reads to the tenant.
export async function resolveShiftSettings(
  tx: TenantTransaction,
  ctx: ServiceContext,
  locationId: string
): Promise<ShiftSettings> {
  const loc = (
    await tx
      .select({
        blindClose: location.blindClose,
        cashDrawer: location.cashDrawer,
        shiftEnforcement: location.shiftEnforcement,
      })
      .from(location)
      .where(eq(location.id, locationId))
      .limit(1)
  ).at(0);
  const org = (
    await tx
      .select({
        blindClose: organization.blindClose,
        cashDrawer: organization.cashDrawer,
        shiftEnforcement: organization.shiftEnforcement,
      })
      .from(organization)
      .where(eq(organization.id, ctx.tenantId))
      .limit(1)
  ).at(0);
  const levels = ["location", "tenant", "platform"] as const;
  const shiftEnforcement =
    resolveSetting<ShiftEnforcementMode>(
      { location: loc?.shiftEnforcement, tenant: org?.shiftEnforcement },
      levels
    ).value ?? PLATFORM_SHIFT_DEFAULTS.shiftEnforcement;
  const blindClose =
    resolveSetting<BlindCloseMode>(
      { location: loc?.blindClose, tenant: org?.blindClose },
      levels
    ).value ?? PLATFORM_SHIFT_DEFAULTS.blindClose;
  const cashDrawer =
    resolveSetting<CashDrawerMode>(
      { location: loc?.cashDrawer, tenant: org?.cashDrawer },
      levels
    ).value ?? PLATFORM_SHIFT_DEFAULTS.cashDrawer;
  return { blindClose, cashDrawer, shiftEnforcement };
}

export interface CashAmount {
  amountMinor: number;
  currency: string;
  scale: number;
}

// pay_in / open_float ADD to the drawer; pay_out / drop REMOVE. close_count rows
// are the cashier's physical count and are NOT part of expected (they are the
// COUNTED side of over/short).
const EXPECTED_SIGN: Record<string, number> = {
  drop: -1,
  open_float: 1,
  pay_in: 1,
  pay_out: -1,
};

// THE load-bearing blind-close computation, reconciled against REAL cash flow
// (per currency AND scale — never merge different scales of one currency):
//   expected = Σ open_float + Σ pay_in − Σ pay_out − Σ drop
//              + Σ(cash settled on COMPLETED 'sale'-type sales this shift)   [cash IN]
//              − Σ(cash settled on 'return'-type sales this shift)           [cash OUT]
// A voided sale (status 'void') is EXCLUDED from cash-IN (the cash went back
// out, netting to zero for a same-shift void). System-computed — the cashier
// never supplies or sees it (blind). Returns one CashAmount per (currency,scale).
export async function computeExpectedCash(
  tx: TenantTransaction,
  _ctx: ServiceContext,
  shiftId: string
): Promise<CashAmount[]> {
  // Key by (currency, scale) — a USD scale-2 row and a USD scale-0 row are
  // different denominations and must NOT be summed into one bucket (Codex HIGH).
  const byKey = new Map<
    string,
    { amountMinor: number; currency: string; scale: number }
  >();
  const add = (currency: string, scale: number, deltaMinor: number) => {
    const key = `${currency}:${scale}`;
    const prior = byKey.get(key);
    byKey.set(key, {
      amountMinor: (prior?.amountMinor ?? 0) + deltaMinor,
      currency,
      scale,
    });
  };

  // Drawer movements (float + pay-ins/outs/drops), grouped by type + currency+scale.
  const movements = await tx
    .select({
      currency: cashMovement.currency,
      scale: cashMovement.scale,
      total: sql<string>`COALESCE(SUM(${cashMovement.amountMinor}), 0)`,
      type: cashMovement.type,
    })
    .from(cashMovement)
    .where(eq(cashMovement.shiftId, shiftId))
    .groupBy(cashMovement.type, cashMovement.currency, cashMovement.scale);
  for (const m of movements) {
    const sign = EXPECTED_SIGN[m.type] ?? 0;
    if (sign !== 0) {
      // `pg` returns int8 SUMs as STRINGS even with mode:number columns —
      // coerce explicitly (the Phase-2 raw-bigint lesson).
      add(m.currency, m.scale, sign * Number(m.total));
    }
  }

  // Cash tenders on sales attached to this shift, split by sale type + status:
  //   completed 'sale'  → cash IN  (+settled): the cash that entered the drawer
  //                       (settled = amount − change, so exactly what was kept).
  //   'return'          → cash OUT (−settled): a refund handed to the customer
  //                       from THIS drawer during the shift.
  //   voided 'sale'     → SKIPPED: the cash went back out (net zero same-shift).
  // RLS scopes both tables to the tenant.
  const cashTenders = await tx
    .select({
      currency: tender.currency,
      saleStatus: sale.status,
      saleType: sale.saleType,
      scale: tender.scale,
      total: sql<string>`COALESCE(SUM(${tender.settledAmountMinor}), 0)`,
    })
    .from(tender)
    .innerJoin(sale, eq(sale.id, tender.saleId))
    .where(and(eq(sale.shiftId, shiftId), eq(tender.method, "cash")))
    .groupBy(tender.currency, tender.scale, sale.saleType, sale.status);
  for (const c of cashTenders) {
    if (c.saleType === "sale" && c.saleStatus === "completed") {
      add(c.currency, c.scale, Number(c.total));
    } else if (c.saleType === "return") {
      add(c.currency, c.scale, -Number(c.total));
    }
    // voided 'sale' (status 'void') → skipped.
  }

  return Array.from(byKey.values()).map((v) => ({
    amountMinor: v.amountMinor,
    currency: v.currency,
    scale: v.scale,
  }));
}
