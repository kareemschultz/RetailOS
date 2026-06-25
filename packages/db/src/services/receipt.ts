import { eq, inArray } from "drizzle-orm";
import {
  company,
  fiscalDocument,
  invoice,
  location,
  organization,
  product,
  sale,
  saleLine,
  shift,
  sku,
  tender,
  user,
} from "../schema";
import type { TenantTransaction } from "../tenant";
import type { ServiceContext } from "./types";

export interface SaleReceiptReadModel {
  barcode: {
    imageUrl: string | null;
    symbology: "code128";
    value: string;
  };
  cashier: {
    email: string | null;
    id: string | null;
    name: string | null;
  };
  company: {
    id: string;
    name: string;
    taxIdentificationNumber: string | null;
    vatRegistrationNumber: string | null;
  };
  currency: string;
  fiscal: {
    documentId: string | null;
    fiscalNumber: string | null;
    provider: string | null;
    providerDocumentId: string | null;
    qrPayload: string | null;
    signature: string | null;
    status: string | null;
  };
  footer: {
    policyText: string | null;
  };
  invoiceNumber: string | null;
  lines: Array<{
    discountMinor: number;
    lineTotalMinor: number;
    productId: string;
    productName: string | null;
    qty: number;
    qtyBase: number | null;
    qtyScale: number | null;
    saleLineId: string;
    skuCode: string | null;
    skuId: string | null;
    taxMinor: number;
    taxRateId: string | null;
    unitPriceMinor: number;
  }>;
  location: {
    id: string;
    name: string;
    type: string;
  };
  organization: {
    id: string;
    name: string;
    taxIdentificationNumber: string | null;
    vatRegistrationNumber: string | null;
  };
  payments: {
    items: Array<{
      amountMinor: number;
      changeMinor: number;
      currency: string;
      direction: "payment" | "refund";
      method: string;
      paymentId: string;
      scale: number;
      settledAmountMinor: number | null;
      tenderId: string;
    }>;
    summary: {
      balanceDueMinor: number;
      changeMinor: number;
      settledMinor: number;
      tenderedMinor: number;
    };
  };
  qr: {
    imageUrl: string | null;
    payload: string | null;
  };
  receiptNumber: string;
  receiptVersion: 1;
  sale: {
    id: string;
    number: string;
    status: string;
    type: string | null;
  };
  scale: number;
  schemaVersion: 1;
  status: {
    isRefund: boolean;
    isVoid: boolean;
    originalSaleId: string | null;
  };
  taxBreakdown: Array<{
    baseMinor: number | null;
    taxMinor: number;
    taxRateId: string | null;
  }>;
  terminal: {
    id: string | null;
    shiftId: string | null;
  };
  timestamp: string;
  totals: {
    discountMinor: number;
    subtotalMinor: number;
    taxMinor: number;
    totalMinor: number;
  };
}

type SaleType = "sale" | "return" | "exchange" | null;
type SaleLineRow = typeof saleLine.$inferSelect;
type ProductRow = typeof product.$inferSelect;
type SkuRow = typeof sku.$inferSelect;
type TenderRow = typeof tender.$inferSelect;
type SaleRow = typeof sale.$inferSelect;
type OrganizationRow = typeof organization.$inferSelect;
type LocationRow = typeof location.$inferSelect;
type CompanyRow = typeof company.$inferSelect;
type InvoiceRow = typeof invoice.$inferSelect;
type FiscalRow = typeof fiscalDocument.$inferSelect;
type UserRow = typeof user.$inferSelect;
type ShiftRow = typeof shift.$inferSelect;

type ReceiptLine = SaleReceiptReadModel["lines"][number];
type ReceiptPayment = SaleReceiptReadModel["payments"]["items"][number];
interface ReceiptData {
  cashier: UserRow | undefined;
  company: CompanyRow;
  fiscal: FiscalRow | undefined;
  invoice: InvoiceRow | undefined;
  lines: ReceiptLine[];
  location: LocationRow;
  organization: OrganizationRow | undefined;
  payments: ReceiptPayment[];
  sale: SaleRow;
  shift: ShiftRow | undefined;
}

function mapReceiptLines(
  lineRows: SaleLineRow[],
  productRows: ProductRow[],
  skuRows: SkuRow[],
  saleType: SaleType
): ReceiptLine[] {
  const productsById = new Map(productRows.map((row) => [row.id, row]));
  const skusById = new Map(skuRows.map((row) => [row.id, row]));
  const sign = saleType === "return" ? -1 : 1;

  return lineRows.map((line) => {
    const discountMinor = line.lineDiscountMinor ?? 0;
    const taxMinor = line.lineTaxMinor ?? 0;
    const lineGross = line.qty * line.unitPriceMinor;
    return {
      discountMinor,
      lineTotalMinor: sign * (lineGross - discountMinor + taxMinor),
      productId: line.productId,
      productName: productsById.get(line.productId)?.name ?? null,
      qty: line.qty,
      qtyBase: line.qtyBase ?? null,
      qtyScale: line.qtyScale ?? null,
      saleLineId: line.id,
      skuCode: line.skuId ? (skusById.get(line.skuId)?.code ?? null) : null,
      skuId: line.skuId ?? null,
      taxMinor,
      taxRateId: line.taxRateId ?? null,
      unitPriceMinor: line.unitPriceMinor,
    };
  });
}

function buildTaxBreakdown(
  lines: ReceiptLine[]
): SaleReceiptReadModel["taxBreakdown"] {
  const byRate = new Map<
    string,
    { baseMinor: number | null; taxMinor: number; taxRateId: string | null }
  >();

  for (const line of lines) {
    if (line.taxMinor === 0) {
      continue;
    }
    const key = line.taxRateId ?? "__no_rate__";
    const current = byRate.get(key) ?? {
      baseMinor: 0,
      taxMinor: 0,
      taxRateId: line.taxRateId,
    };
    current.baseMinor =
      current.baseMinor == null
        ? null
        : current.baseMinor +
          line.qty * line.unitPriceMinor -
          line.discountMinor;
    current.taxMinor += line.taxMinor;
    byRate.set(key, current);
  }

  return [...byRate.values()];
}

function mapReceiptPayments(
  tenderRows: TenderRow[],
  saleType: SaleType
): ReceiptPayment[] {
  const direction = saleType === "return" ? "refund" : "payment";
  return tenderRows.map((row) => ({
    amountMinor: row.amountMinor,
    changeMinor: row.changeMinor ?? 0,
    currency: row.currency,
    direction,
    method: row.method,
    paymentId: row.id,
    scale: row.scale,
    settledAmountMinor: row.settledAmountMinor ?? null,
    tenderId: row.id,
  }));
}

function buildPaymentSummary(
  payments: ReceiptPayment[],
  saleType: SaleType,
  totalMinor: number
): SaleReceiptReadModel["payments"]["summary"] {
  const tenderedMinor = payments.reduce((sum, row) => sum + row.amountMinor, 0);
  const settledMinor = payments.reduce(
    (sum, row) => sum + (row.settledAmountMinor ?? 0),
    0
  );
  const changeMinor = payments.reduce((sum, row) => sum + row.changeMinor, 0);
  return {
    balanceDueMinor:
      saleType === "sale" ? Math.max(totalMinor - settledMinor, 0) : 0,
    changeMinor,
    settledMinor,
    tenderedMinor,
  };
}

function buildCompanySection(
  data: ReceiptData
): SaleReceiptReadModel["company"] {
  return {
    id: data.company.id,
    name: data.company.name,
    taxIdentificationNumber:
      data.company.taxIdentificationNumber ??
      data.organization?.taxIdentificationNumber ??
      null,
    vatRegistrationNumber:
      data.company.vatRegistrationNumber ??
      data.organization?.vatRegistrationNumber ??
      null,
  };
}

function buildFiscalSection(data: ReceiptData): SaleReceiptReadModel["fiscal"] {
  return {
    documentId: data.fiscal?.id ?? null,
    fiscalNumber: data.fiscal?.fiscalNumber ?? null,
    provider: data.fiscal?.provider ?? null,
    providerDocumentId: data.fiscal?.providerDocumentId ?? null,
    qrPayload: data.fiscal?.qrPayload ?? null,
    signature: data.fiscal?.signature ?? null,
    status: data.fiscal?.status ?? null,
  };
}

function buildOrganizationSection(
  ctx: ServiceContext,
  data: ReceiptData
): SaleReceiptReadModel["organization"] {
  return {
    id: data.organization?.id ?? ctx.tenantId,
    name: data.organization?.name ?? "",
    taxIdentificationNumber: data.organization?.taxIdentificationNumber ?? null,
    vatRegistrationNumber: data.organization?.vatRegistrationNumber ?? null,
  };
}

function buildStatusSection(data: ReceiptData): SaleReceiptReadModel["status"] {
  return {
    isRefund: data.sale.saleType === "return",
    isVoid: data.sale.status === "void",
    originalSaleId: data.sale.originalSaleId ?? null,
  };
}

function buildTotalsSection(data: ReceiptData): SaleReceiptReadModel["totals"] {
  return {
    discountMinor: data.sale.discountMinor ?? 0,
    subtotalMinor: data.sale.subtotalMinor ?? data.sale.totalMinor,
    taxMinor: data.sale.taxMinor ?? 0,
    totalMinor: data.sale.totalMinor,
  };
}

async function loadSaleCore(
  tx: TenantTransaction,
  ctx: ServiceContext,
  saleId: string
): Promise<{
  companyRow: CompanyRow;
  fiscalRows: FiscalRow[];
  invoiceRows: InvoiceRow[];
  lineRows: SaleLineRow[];
  locationRow: LocationRow;
  organizationRow: OrganizationRow | undefined;
  saleRow: SaleRow;
  tenderRows: TenderRow[];
} | null> {
  const saleRow = (
    await tx.select().from(sale).where(eq(sale.id, saleId)).limit(1)
  ).at(0);
  if (!saleRow) {
    return null;
  }

  const orgRow = await tx
    .select()
    .from(organization)
    .where(eq(organization.id, ctx.tenantId))
    .limit(1);
  const locationRow = await tx
    .select()
    .from(location)
    .where(eq(location.id, saleRow.locationId))
    .limit(1);
  const invoiceRow = await tx
    .select()
    .from(invoice)
    .where(eq(invoice.saleId, saleRow.id))
    .limit(1);
  const fiscalRow = await tx
    .select()
    .from(fiscalDocument)
    .where(eq(fiscalDocument.saleId, saleRow.id))
    .limit(1);
  const lineRows = await tx
    .select()
    .from(saleLine)
    .where(eq(saleLine.saleId, saleRow.id));
  const tenderRows = await tx
    .select()
    .from(tender)
    .where(eq(tender.saleId, saleRow.id));

  const loc = locationRow.at(0);
  if (!loc) {
    return null;
  }
  const companyRow = (
    await tx
      .select()
      .from(company)
      .where(eq(company.id, loc.companyId))
      .limit(1)
  ).at(0);
  if (!companyRow) {
    return null;
  }

  return {
    companyRow,
    fiscalRows: fiscalRow,
    invoiceRows: invoiceRow,
    lineRows,
    locationRow: loc,
    organizationRow: orgRow.at(0),
    saleRow,
    tenderRows,
  };
}

async function loadReceiptData(
  tx: TenantTransaction,
  ctx: ServiceContext,
  saleId: string
): Promise<ReceiptData | null> {
  const core = await loadSaleCore(tx, ctx, saleId);
  if (!core) {
    return null;
  }

  const productIds = [...new Set(core.lineRows.map((line) => line.productId))];
  const skuIds = [
    ...new Set(
      core.lineRows
        .map((line) => line.skuId)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const productRows = productIds.length
    ? await tx.select().from(product).where(inArray(product.id, productIds))
    : [];
  const skuRows = skuIds.length
    ? await tx.select().from(sku).where(inArray(sku.id, skuIds))
    : [];
  const cashierRows = core.saleRow.createdBy
    ? await tx
        .select()
        .from(user)
        .where(eq(user.id, core.saleRow.createdBy))
        .limit(1)
    : [];
  const shiftRows = core.saleRow.shiftId
    ? await tx
        .select()
        .from(shift)
        .where(eq(shift.id, core.saleRow.shiftId))
        .limit(1)
    : [];

  const lines = mapReceiptLines(
    core.lineRows,
    productRows,
    skuRows,
    core.saleRow.saleType
  );
  return {
    cashier: cashierRows.at(0),
    company: core.companyRow,
    fiscal: core.fiscalRows.at(0),
    invoice: core.invoiceRows.at(0),
    lines,
    location: core.locationRow,
    organization: core.organizationRow,
    payments: mapReceiptPayments(core.tenderRows, core.saleRow.saleType),
    sale: core.saleRow,
    shift: shiftRows.at(0),
  };
}

function buildSaleReceiptModel(
  ctx: ServiceContext,
  data: ReceiptData
): SaleReceiptReadModel {
  const paymentSummary = buildPaymentSummary(
    data.payments,
    data.sale.saleType,
    data.sale.totalMinor
  );
  return {
    barcode: {
      imageUrl: null,
      symbology: "code128",
      value: data.sale.number,
    },
    cashier: {
      email: data.cashier?.email ?? null,
      id: data.sale.createdBy ?? null,
      name: data.cashier?.name ?? null,
    },
    company: buildCompanySection(data),
    currency: data.sale.currency,
    fiscal: buildFiscalSection(data),
    footer: {
      policyText: null,
    },
    invoiceNumber: data.invoice?.number ?? null,
    lines: data.lines,
    location: {
      id: data.location.id,
      name: data.location.name,
      type: data.location.type,
    },
    organization: buildOrganizationSection(ctx, data),
    payments: {
      items: data.payments,
      summary: paymentSummary,
    },
    qr: {
      imageUrl: null,
      payload: data.fiscal?.qrPayload ?? null,
    },
    receiptNumber: data.fiscal?.fiscalNumber ?? data.sale.number,
    receiptVersion: 1,
    sale: {
      id: data.sale.id,
      number: data.sale.number,
      status: data.sale.status,
      type: data.sale.saleType ?? null,
    },
    scale: data.sale.scale,
    schemaVersion: 1,
    status: buildStatusSection(data),
    taxBreakdown: buildTaxBreakdown(data.lines),
    terminal: {
      id: data.shift?.terminalId ?? null,
      shiftId: data.sale.shiftId ?? null,
    },
    timestamp: data.sale.createdAt.toISOString(),
    totals: buildTotalsSection(data),
  };
}

export async function buildSaleReceipt(
  tx: TenantTransaction,
  ctx: ServiceContext,
  saleId: string
): Promise<SaleReceiptReadModel | null> {
  const data = await loadReceiptData(tx, ctx, saleId);
  return data ? buildSaleReceiptModel(ctx, data) : null;
}
