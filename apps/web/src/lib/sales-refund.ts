export type TenderMethod =
  | "cash"
  | "card"
  | "bank_transfer"
  | "mobile_money"
  | "cheque"
  | "store_credit"
  | "gift_card";

interface RefundableSaleLine {
  lineTotalMinor: number;
  qty: number;
  saleLineId: string;
}

interface RefundedLineState {
  refundedQty: number;
  saleLineId: string;
}

interface RefundableSaleDetail {
  receipt: {
    currency: string;
    lines: RefundableSaleLine[];
    sale: { id: string };
    scale: number;
  };
  refundState: {
    lines: RefundedLineState[];
  };
}

export interface FullRefundLineDraft {
  lineTotalMinor: number;
  originalSaleLineId: string;
  qty: number;
  unitPriceMinor: number;
}

export function getRefundableLines(
  detail: RefundableSaleDetail
): FullRefundLineDraft[] {
  return detail.receipt.lines.flatMap((line) => {
    const alreadyRefunded =
      detail.refundState.lines.find(
        (state) => state.saleLineId === line.saleLineId
      )?.refundedQty ?? 0;
    const remainingQty = Math.max(0, line.qty - alreadyRefunded);

    if (remainingQty === 0) {
      return [];
    }

    const unitPriceMinor = Math.round(line.lineTotalMinor / line.qty);

    return [
      {
        lineTotalMinor: unitPriceMinor * remainingQty,
        originalSaleLineId: line.saleLineId,
        qty: remainingQty,
        unitPriceMinor,
      },
    ];
  });
}

export function getRefundableTotalMinor(detail: RefundableSaleDetail) {
  return getRefundableLines(detail).reduce(
    (sum, line) => sum + line.lineTotalMinor,
    0
  );
}

export function buildFullRefundInput({
  detail,
  doNotRestock,
  idempotencyKey,
  method,
  refundReason,
  terminalId,
}: {
  detail: RefundableSaleDetail;
  doNotRestock?: boolean;
  idempotencyKey: string;
  method: TenderMethod;
  refundReason?: string;
  terminalId?: string;
}) {
  const refundableLines = getRefundableLines(detail);
  const amountMinor = refundableLines.reduce(
    (sum, line) => sum + line.lineTotalMinor,
    0
  );

  return {
    doNotRestock: doNotRestock || undefined,
    idempotencyKey,
    lines: refundableLines.map((line) => ({
      originalSaleLineId: line.originalSaleLineId,
      qty: line.qty,
    })),
    originalSaleId: detail.receipt.sale.id,
    refundReason: refundReason?.trim() || undefined,
    terminalId: terminalId?.trim() || undefined,
    tenders: [
      {
        amountMinor,
        currency: detail.receipt.currency,
        method,
      },
    ],
  };
}
