import { StatusChip } from "@RetailOS/ui/components/status-chip";
import { createFileRoute } from "@tanstack/react-router";
import { Crown, Users, Wallet } from "lucide-react";

import { type ResourceColumn, ResourcePage } from "@/components/resource-page";
import { type Customer, MOCK_CUSTOMERS } from "@/data/mock/crm";
import { useFeatureQuery } from "@/data/mock-query";
import { formatMoney } from "@/lib/format";

export const Route = createFileRoute("/_app/customers")({
  component: CustomersScreen,
});

const SEGMENT_TONE = {
  vip: "accent",
  wholesale: "info",
  retail: "neutral",
} as const;

const columns: ResourceColumn<Customer>[] = [
  {
    key: "name",
    header: "Customer",
    cell: (row) => (
      <div className="min-w-0">
        <p className="truncate font-medium">{row.name}</p>
        <p className="truncate text-muted-foreground text-xs">{row.email}</p>
      </div>
    ),
  },
  {
    key: "segment",
    header: "Segment",
    cell: (row) => (
      <StatusChip tone={SEGMENT_TONE[row.segment]}>
        {row.segment.charAt(0).toUpperCase() + row.segment.slice(1)}
      </StatusChip>
    ),
  },
  {
    key: "status",
    header: "Status",
    cell: (row) => (
      <StatusChip tone={row.status === "active" ? "success" : "neutral"}>
        {row.status === "active" ? "Active" : "Inactive"}
      </StatusChip>
    ),
  },
  {
    key: "orders",
    header: "Orders",
    align: "right",
    cell: (row) => row.ordersCount,
  },
  {
    key: "ltv",
    header: "Lifetime spend",
    align: "right",
    cell: (row) => formatMoney(row.lifetimeSpendMinor, row.currency, row.scale),
  },
  {
    key: "balance",
    header: "Balance",
    align: "right",
    cell: (row) =>
      row.balanceMinor > 0 ? (
        <span className="text-amber-600 dark:text-amber-400">
          {formatMoney(row.balanceMinor, row.currency, row.scale)}
        </span>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    key: "lastOrder",
    header: "Last order",
    align: "right",
    cell: (row) => new Date(row.lastOrderAt).toLocaleDateString(),
  },
];

function CustomersScreen() {
  const { data, isLoading, isError, refetch } = useFeatureQuery<Customer[]>({
    feature: "crm.customers",
    queryKey: ["crm", "customers"],
    mock: MOCK_CUSTOMERS,
  });

  const rows = data ?? [];
  const activeCount = rows.filter((r) => r.status === "active").length;
  const outstanding = rows.reduce((sum, r) => sum + r.balanceMinor, 0);
  const vipCount = rows.filter((r) => r.segment === "vip").length;

  return (
    <ResourcePage<Customer>
      columns={columns}
      description="Every shopper and wholesale account, their spend, and open balances."
      emptyDescription="Add your first customer to start tracking orders and balances."
      emptyTitle="No customers yet"
      errorMessage="Could not load customers."
      feature="crm.customers"
      icon={Users}
      isError={isError}
      isLoading={isLoading}
      metrics={[
        {
          label: "Total customers",
          value: String(rows.length),
          icon: Users,
          hint: `${activeCount} active`,
        },
        {
          label: "VIP accounts",
          value: String(vipCount),
          icon: Crown,
          hint: "Top-tier segment",
        },
        {
          label: "Outstanding balance",
          value: formatMoney(outstanding, "GYD", 2),
          icon: Wallet,
          hint: "Across all accounts",
        },
      ]}
      onRetry={() => refetch()}
      primaryAction={{
        label: "New customer",
        onClick: () => {
          /* opens create sheet when backend is wired */
        },
      }}
      rowKey={(row) => row.id}
      rows={rows}
      searchFilter={(row, q) =>
        row.name.toLowerCase().includes(q) ||
        row.email.toLowerCase().includes(q)
      }
      searchPlaceholder="Search customers"
      title="Customers"
    />
  );
}
