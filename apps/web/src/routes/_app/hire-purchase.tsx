import { Button } from "@RetailOS/ui/components/button";
import { DataTableCard } from "@RetailOS/ui/components/data-table-card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@RetailOS/ui/components/dialog";
import {
  PageBody,
  PageHeader,
  PageMetrics,
} from "@RetailOS/ui/components/page-header";
import { Skeleton } from "@RetailOS/ui/components/skeleton";
import { StatCard } from "@RetailOS/ui/components/stat-card";
import {
  StatusChip,
  type StatusTone,
} from "@RetailOS/ui/components/status-chip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@RetailOS/ui/components/table";
import { createFileRoute } from "@tanstack/react-router";
import {
  BadgeDollarSign,
  Banknote,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { EmptyState, ErrorState } from "@/components/states";
import { FeatureStatusBadge } from "@/data/feature-status-badge";
import {
  type AgreementStatus,
  type HirePurchaseAgreement,
  type HirePurchasePayment,
  MOCK_HIRE_PURCHASE,
  type PaymentStatus,
} from "@/data/mock/hire-purchase";
import { useFeatureQuery } from "@/data/mock-query";
import { formatMoney } from "@/lib/format";

export const Route = createFileRoute("/_app/hire-purchase")({
  component: HirePurchaseScreen,
});

const SKELETON_KEYS = ["a", "b", "c", "d", "e"] as const;

const AGREEMENT_TONE: Record<AgreementStatus, StatusTone> = {
  active: "success",
  completed: "neutral",
  overdue: "warning",
  defaulted: "error",
};

const AGREEMENT_LABEL: Record<AgreementStatus, string> = {
  active: "Active",
  completed: "Completed",
  overdue: "Overdue",
  defaulted: "Defaulted",
};

const PAYMENT_TONE: Record<PaymentStatus, StatusTone> = {
  paid: "success",
  due: "info",
  overdue: "error",
  upcoming: "neutral",
};

const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  paid: "Paid",
  due: "Due soon",
  overdue: "Overdue",
  upcoming: "Upcoming",
};

function progressPct(a: HirePurchaseAgreement): number {
  const total = a.depositMinor + a.financedMinor + a.financeChargeMinor;
  if (total <= 0) {
    return 0;
  }
  return Math.min(100, Math.round((a.paidToDateMinor / total) * 100));
}

function HirePurchaseScreen() {
  const { data, isLoading, isError, refetch } = useFeatureQuery<
    HirePurchaseAgreement[]
  >({
    feature: "sales.hirePurchase",
    queryKey: ["sales", "hire-purchase"],
    mock: MOCK_HIRE_PURCHASE,
  });

  // Locally-applied payments so "Record payment" reflects immediately in the
  // preview without a backend. Keyed by `${agreementId}:${paymentNumber}`.
  const [paidExtra, setPaidExtra] = useState<Record<string, true>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const agreements = useMemo(() => {
    const base = data ?? [];
    return base.map((a) => applyLocalPayments(a, paidExtra));
  }, [data, paidExtra]);

  const selected = agreements.find((a) => a.id === selectedId) ?? null;

  const totals = useMemo(() => {
    const outstanding = agreements.reduce((s, a) => s + a.balanceMinor, 0);
    const activeCount = agreements.filter(
      (a) => a.status === "active" || a.status === "overdue"
    ).length;
    const overdueCount = agreements.filter(
      (a) => a.status === "overdue" || a.status === "defaulted"
    ).length;
    const dueThisMonth = agreements.reduce((s, a) => {
      const due = a.schedule
        .filter((p) => p.status === "due" || p.status === "overdue")
        .reduce((ss, p) => ss + p.amountMinor, 0);
      return s + due;
    }, 0);
    return { outstanding, activeCount, overdueCount, dueThisMonth };
  }, [agreements]);

  const settled = !(isLoading || isError);

  const exportRows = useMemo(
    () =>
      agreements.map((a) => ({
        Reference: a.reference,
        Customer: a.customerName,
        Item: a.productName,
        SKU: a.productSku,
        "Cash price": a.cashPriceMinor / 10 ** a.scale,
        Deposit: a.depositMinor / 10 ** a.scale,
        Monthly: a.monthlyPaymentMinor / 10 ** a.scale,
        "Term (months)": a.termMonths,
        Balance: a.balanceMinor / 10 ** a.scale,
        Status: AGREEMENT_LABEL[a.status],
      })),
    [agreements]
  );

  function handleRecordPayment(agreement: HirePurchaseAgreement) {
    const next = agreement.schedule.find((p) => p.status !== "paid");
    if (!next) {
      toast.info("This agreement is fully paid.");
      return;
    }
    setPaidExtra((prev) => ({
      ...prev,
      [`${agreement.id}:${next.number}`]: true,
    }));
    toast.success(
      `Payment ${next.number} recorded — ${formatMoney(
        next.amountMinor,
        agreement.currency,
        agreement.scale
      )}`
    );
  }

  return (
    <>
      <PageHeader
        actions={<FeatureStatusBadge featureKey="sales.hirePurchase" />}
        description="Deposit-and-instalment plans on big-ticket appliances, with live balances and payment schedules."
        title="Hire Purchase"
      />
      <PageBody>
        <PageMetrics>
          <StatCard
            hint={`${totals.activeCount} active plans`}
            icon={Wallet}
            label="Outstanding balance"
            value={formatMoney(totals.outstanding, "GYD", 2)}
          />
          <StatCard
            hint="Due within 31 days"
            icon={CalendarClock}
            label="Collections due"
            value={formatMoney(totals.dueThisMonth, "GYD", 2)}
          />
          <StatCard
            hint="Across all plans"
            icon={BadgeDollarSign}
            label="Agreements"
            value={String(agreements.length)}
          />
          <StatCard
            hint="Overdue or defaulted"
            icon={TriangleAlert}
            label="Needs attention"
            value={String(totals.overdueCount)}
          />
        </PageMetrics>

        <DataTableCard
          count={settled ? agreements.length : undefined}
          exportFilename="hire-purchase-agreements"
          exportRows={exportRows}
          title="Agreements"
        >
          {isError ? (
            <div className="p-4">
              <ErrorState
                message="Could not load agreements."
                onRetry={() => refetch()}
              />
            </div>
          ) : null}

          {isLoading ? (
            <div className="flex flex-col gap-px">
              {SKELETON_KEYS.map((key) => (
                <Skeleton className="h-[56px] rounded-none" key={key} />
              ))}
            </div>
          ) : null}

          {settled && agreements.length === 0 ? (
            <EmptyState
              description="Hire-purchase agreements will appear here once created."
              icon={CreditCard}
              title="No agreements yet"
            />
          ) : null}

          {settled && agreements.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead className="text-right">Monthly</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agreements.map((a) => {
                  const pct = progressPct(a);
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">
                        {a.reference}
                      </TableCell>
                      <TableCell>{a.customerName}</TableCell>
                      <TableCell className="max-w-[220px]">
                        <p className="truncate">{a.productName}</p>
                        <p className="text-muted-foreground text-xs">
                          {a.termMonths} months
                        </p>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-muted-foreground text-xs tabular-nums">
                            {pct}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(
                          a.monthlyPaymentMinor,
                          a.currency,
                          a.scale
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {a.balanceMinor > 0 ? (
                          formatMoney(a.balanceMinor, a.currency, a.scale)
                        ) : (
                          <span className="text-muted-foreground">Settled</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusChip tone={AGREEMENT_TONE[a.status]}>
                          {AGREEMENT_LABEL[a.status]}
                        </StatusChip>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          onClick={() => setSelectedId(a.id)}
                          size="sm"
                          variant="outline"
                        >
                          View schedule
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : null}
        </DataTableCard>
      </PageBody>

      <Dialog
        onOpenChange={(open) => !open && setSelectedId(null)}
        open={selected !== null}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span>{selected.reference}</span>
                  <StatusChip tone={AGREEMENT_TONE[selected.status]}>
                    {AGREEMENT_LABEL[selected.status]}
                  </StatusChip>
                </DialogTitle>
                <DialogDescription>
                  {selected.customerName} · {selected.productName}
                </DialogDescription>
              </DialogHeader>

              <dl className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/40 p-3 text-sm">
                <SummaryItem
                  label="Cash price"
                  value={formatMoney(
                    selected.cashPriceMinor,
                    selected.currency,
                    selected.scale
                  )}
                />
                <SummaryItem
                  label="Deposit"
                  value={formatMoney(
                    selected.depositMinor,
                    selected.currency,
                    selected.scale
                  )}
                />
                <SummaryItem
                  label="Finance charge"
                  value={formatMoney(
                    selected.financeChargeMinor,
                    selected.currency,
                    selected.scale
                  )}
                />
                <SummaryItem
                  label="Monthly"
                  value={formatMoney(
                    selected.monthlyPaymentMinor,
                    selected.currency,
                    selected.scale
                  )}
                />
                <SummaryItem
                  label="Paid to date"
                  value={formatMoney(
                    selected.paidToDateMinor,
                    selected.currency,
                    selected.scale
                  )}
                />
                <SummaryItem
                  emphasize
                  label="Balance"
                  value={
                    selected.balanceMinor > 0
                      ? formatMoney(
                          selected.balanceMinor,
                          selected.currency,
                          selected.scale
                        )
                      : "Settled"
                  }
                />
              </dl>

              <div className="rounded-lg border">
                <div className="border-b px-3 py-2 font-medium text-sm">
                  Payment schedule
                </div>
                <ul className="divide-y">
                  {selected.schedule.map((p) => (
                    <ScheduleRow
                      currency={selected.currency}
                      key={p.number}
                      payment={p}
                      scale={selected.scale}
                    />
                  ))}
                </ul>
              </div>

              <DialogFooter>
                <Button
                  disabled={selected.balanceMinor <= 0}
                  onClick={() => handleRecordPayment(selected)}
                >
                  <Banknote className="size-4" />
                  {selected.balanceMinor <= 0
                    ? "Fully paid"
                    : "Record next payment"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function SummaryItem({
  label,
  value,
  emphasize,
}: {
  emphasize?: boolean;
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className={emphasize ? "font-semibold tabular-nums" : "tabular-nums"}>
        {value}
      </dd>
    </div>
  );
}

function ScheduleRow({
  payment,
  currency,
  scale,
}: {
  currency: string;
  payment: HirePurchasePayment;
  scale: number;
}) {
  return (
    <li className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
      <div className="flex items-center gap-2">
        {payment.status === "paid" ? (
          <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
        ) : (
          <span className="inline-flex size-4 items-center justify-center text-muted-foreground text-xs">
            {payment.number}
          </span>
        )}
        <div>
          <p className="tabular-nums">
            {formatMoney(payment.amountMinor, currency, scale)}
          </p>
          <p className="text-muted-foreground text-xs">
            Due {new Date(payment.dueAt).toLocaleDateString()}
          </p>
        </div>
      </div>
      <StatusChip tone={PAYMENT_TONE[payment.status]}>
        {PAYMENT_LABEL[payment.status]}
      </StatusChip>
    </li>
  );
}

// Re-derive an agreement's paid state after locally-recorded payments, so the
// balance / progress / status all stay internally consistent in the preview.
function applyLocalPayments(
  agreement: HirePurchaseAgreement,
  paidExtra: Record<string, true>
): HirePurchaseAgreement {
  const hasExtra = agreement.schedule.some(
    (p) => paidExtra[`${agreement.id}:${p.number}`]
  );
  if (!hasExtra) {
    return agreement;
  }

  let paidToDateMinor = agreement.depositMinor;
  const schedule = agreement.schedule.map((p) => {
    const isLocallyPaid = paidExtra[`${agreement.id}:${p.number}`];
    const status: PaymentStatus = isLocallyPaid ? "paid" : p.status;
    if (status === "paid") {
      paidToDateMinor += p.amountMinor;
      return { ...p, status, paidAt: p.paidAt ?? p.dueAt };
    }
    return { ...p, status };
  });

  const total =
    agreement.depositMinor +
    agreement.financedMinor +
    agreement.financeChargeMinor;
  const balanceMinor = total - paidToDateMinor;
  const hasOverdue = schedule.some((p) => p.status === "overdue");
  let status: AgreementStatus;
  if (balanceMinor <= 0) {
    status = "completed";
  } else if (hasOverdue) {
    status = "overdue";
  } else {
    status = "active";
  }

  return { ...agreement, schedule, paidToDateMinor, balanceMinor, status };
}
