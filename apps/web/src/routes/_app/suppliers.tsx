import { DomainStatusChip } from "@RetailOS/ui/components/status-chip";
import { createFileRoute } from "@tanstack/react-router";
import { Clock, Truck, Wallet } from "lucide-react";

import {
  type ResourceColumn,
  ResourcePage,
} from "@/components/resource-page";
import { MOCK_SUPPLIERS, type Supplier } from "@/data/mock/crm";
import { useFeatureQuery } from "@/data/mock-query";
import { formatMoney } from "@/lib/format";

export const Route = createFileRoute("/_app/suppliers")({
  component: SuppliersScreen,
});

const columns: ResourceColumn<Supplier>[] = [
  {
    key: "name",
    header: "Supplier",
    cell: (row) => (
      <div className="min-w-0">
        <p className="truncate font-medium">{row.name}</p>
        <p className="truncate text-muted-foreground text-xs">
          {row.contact} · {row.email}
        </p>
      </div>
    ),
  },
  {
    key: "status",
    header: "Status",
    cell: (row) => <DomainStatusChip status={row.status} />,
  },
  {
    key: "lead",
    header: "Lead time",
    align: "right",
    cell: (row) => `${row.leadTimeDays}d`,
  },
  {
    key: "po",
    header: "Open POs",
    align: "right",
    cell: (row) => row.openPurchaseOrders,
  },
  {
    key: "payable",
    header: "Payable",
    align: "right",
    cell: (row) =>
      row.payableMinor > 0
        ? formatMoney(row.payableMinor, row.currency, row.scale)
        : "—",
  },
];

function SuppliersScreen() {
  const { data, isLoading, isError, refetch } = useFeatureQuery<Supplier[]>({
    feature: "procurement.suppliers",
    queryKey: ["procurement", "suppliers"],
    mock: MOCK_SUPPLIERS,
  });

  const rows = data ?? [];
  const activeCount = rows.filter((r) => r.status === "active").length;
  const openPos = rows.reduce((sum, r) => sum + r.openPurchaseOrders, 0);
  const payable = rows
    .filter((r) => r.currency === "GYD")
    .reduce((sum, r) => sum + r.payableMinor, 0);

  return (
    <ResourcePage<Supplier>
      columns={columns}
      description="Vendors you buy from, their lead times, and what you owe them."
      emptyDescription="Add a supplier to start raising purchase orders."
      emptyTitle="No suppliers yet"
      errorMessage="Could not load suppliers."
      feature="procurement.suppliers"
      icon={Truck}
      isError={isError}
      isLoading={isLoading}
      metrics={[
        {
          label: "Suppliers",
          value: String(rows.length),
          icon: Truck,
          hint: `${activeCount} active`,
        },
        {
          label: "Open purchase orders",
          value: String(openPos),
          icon: Clock,
          hint: "Awaiting receipt",
        },
        {
          label: "Payable (GYD)",
          value: formatMoney(payable, "GYD", 2),
          icon: Wallet,
          hint: "Local-currency balance",
        },
      ]}
      onRetry={() => refetch()}
      primaryAction={{
        label: "New supplier",
        onClick: () => {
          /* opens create sheet when backend is wired */
        },
      }}
      rowKey={(row) => row.id}
      rows={rows}
      searchFilter={(row, q) =>
        row.name.toLowerCase().includes(q) ||
        row.contact.toLowerCase().includes(q)
      }
      searchPlaceholder="Search suppliers"
      title="Suppliers"
    />
  );
}
