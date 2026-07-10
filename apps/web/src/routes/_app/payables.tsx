import { DomainStatusChip } from "@RetailOS/ui/components/status-chip";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, FileText, Wallet } from "lucide-react";

import {
  type ResourceColumn,
  ResourcePage,
} from "@/components/resource-page";
import { MOCK_PAYABLES, type PayableBill } from "@/data/mock/finance";
import { useFeatureQuery } from "@/data/mock-query";
import { formatMoney } from "@/lib/format";

export const Route = createFileRoute("/_app/payables")({
  component: PayablesScreen,
});

const columns: ResourceColumn<PayableBill>[] = [
  {
    key: "number",
    header: "Bill",
    cell: (row) => <span className="font-mono text-sm">{row.number}</span>,
  },
  {
    key: "supplier",
    header: "Supplier",
    cell: (row) => <span className="font-medium">{row.supplier}</span>,
  },
  {
    key: "status",
    header: "Status",
    cell: (row) => <DomainStatusChip status={row.status} />,
  },
  {
    key: "issued",
    header: "Issued",
    align: "right",
    cell: (row) => new Date(row.issuedAt).toLocaleDateString(),
  },
  {
    key: "due",
    header: "Due",
    align: "right",
    cell: (row) => new Date(row.dueAt).toLocaleDateString(),
  },
  {
    key: "total",
    header: "Total",
    align: "right",
    cell: (row) => formatMoney(row.totalMinor, row.currency, row.scale),
  },
  {
    key: "balance",
    header: "Balance",
    align: "right",
    cell: (row) =>
      row.balanceMinor > 0
        ? formatMoney(row.balanceMinor, row.currency, row.scale)
        : "—",
  },
];

function PayablesScreen() {
  const { data, isLoading, isError, refetch } = useFeatureQuery<PayableBill[]>({
    feature: "finance.ap",
    queryKey: ["finance", "payables"],
    mock: MOCK_PAYABLES,
  });

  const rows = data ?? [];
  const outstanding = rows.reduce((sum, r) => sum + r.balanceMinor, 0);
  const overdue = rows
    .filter((r) => r.status === "overdue")
    .reduce((sum, r) => sum + r.balanceMinor, 0);
  const openCount = rows.filter(
    (r) => r.status === "unpaid" || r.status === "overdue"
  ).length;

  return (
    <ResourcePage<PayableBill>
      columns={columns}
      description="Money you owe suppliers — bills to pay and what's overdue."
      emptyDescription="Bills from suppliers will appear here."
      emptyTitle="No payables"
      errorMessage="Could not load payables."
      feature="finance.ap"
      icon={Wallet}
      isError={isError}
      isLoading={isLoading}
      metrics={[
        {
          label: "Outstanding",
          value: formatMoney(outstanding, "GYD", 2),
          icon: Wallet,
          hint: `${openCount} open bills`,
        },
        {
          label: "Overdue",
          value: formatMoney(overdue, "GYD", 2),
          icon: AlertTriangle,
          hint: "Past due date",
        },
        {
          label: "Bills",
          value: String(rows.length),
          icon: FileText,
          hint: "This period",
        },
      ]}
      onRetry={() => refetch()}
      primaryAction={{
        label: "Record bill",
        onClick: () => {
          /* opens bill entry when backend is wired */
        },
      }}
      rowKey={(row) => row.id}
      rows={rows}
      searchFilter={(row, q) =>
        row.number.toLowerCase().includes(q) ||
        row.supplier.toLowerCase().includes(q)
      }
      searchPlaceholder="Search bills"
      title="Payables"
    />
  );
}
