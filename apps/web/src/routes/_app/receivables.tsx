import { DomainStatusChip } from "@RetailOS/ui/components/status-chip";
import { createFileRoute } from "@tanstack/react-router";
import { FileText, TrendingUp, Wallet } from "lucide-react";

import { type ResourceColumn, ResourcePage } from "@/components/resource-page";
import { MOCK_RECEIVABLES, type ReceivableInvoice } from "@/data/mock/finance";
import { useFeatureQuery } from "@/data/mock-query";
import { formatMoney } from "@/lib/format";

export const Route = createFileRoute("/_app/receivables")({
  component: ReceivablesScreen,
});

const columns: ResourceColumn<ReceivableInvoice>[] = [
  {
    key: "number",
    header: "Invoice",
    cell: (row) => <span className="font-mono text-sm">{row.number}</span>,
  },
  {
    key: "customer",
    header: "Customer",
    cell: (row) => <span className="font-medium">{row.customer}</span>,
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

function ReceivablesScreen() {
  const { data, isLoading, isError, refetch } = useFeatureQuery<
    ReceivableInvoice[]
  >({
    feature: "finance.ar",
    queryKey: ["finance", "receivables"],
    mock: MOCK_RECEIVABLES,
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
    <ResourcePage<ReceivableInvoice>
      columns={columns}
      description="Money owed to you by customers — outstanding and overdue invoices."
      emptyDescription="Invoices you issue will appear here."
      emptyTitle="No receivables"
      errorMessage="Could not load receivables."
      feature="finance.ar"
      icon={Wallet}
      isError={isError}
      isLoading={isLoading}
      metrics={[
        {
          label: "Outstanding",
          value: formatMoney(outstanding, "GYD", 2),
          icon: Wallet,
          hint: `${openCount} open invoices`,
        },
        {
          label: "Overdue",
          value: formatMoney(overdue, "GYD", 2),
          icon: TrendingUp,
          hint: "Past due date",
        },
        {
          label: "Invoices",
          value: String(rows.length),
          icon: FileText,
          hint: "This period",
        },
      ]}
      onRetry={() => refetch()}
      primaryAction={{
        label: "New invoice",
        onClick: () => {
          /* opens invoice wizard when backend is wired */
        },
      }}
      rowKey={(row) => row.id}
      rows={rows}
      searchFilter={(row, q) =>
        row.number.toLowerCase().includes(q) ||
        row.customer.toLowerCase().includes(q)
      }
      searchPlaceholder="Search invoices"
      title="Receivables"
    />
  );
}
