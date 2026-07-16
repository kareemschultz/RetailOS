import { DomainStatusChip } from "@RetailOS/ui/components/status-chip";
import { createFileRoute } from "@tanstack/react-router";
import { ClipboardList, PackageMinus, Scale } from "lucide-react";

import { type ResourceColumn, ResourcePage } from "@/components/resource-page";
import { MOCK_ADJUSTMENTS, type StockAdjustment } from "@/data/mock/finance";
import { useFeatureQuery } from "@/data/mock-query";
import { formatMoney } from "@/lib/format";

export const Route = createFileRoute("/_app/adjustments")({
  component: AdjustmentsScreen,
});

const columns: ResourceColumn<StockAdjustment>[] = [
  {
    key: "reference",
    header: "Reference",
    cell: (row) => <span className="font-mono text-sm">{row.reference}</span>,
  },
  {
    key: "location",
    header: "Location",
    cell: (row) => <span className="font-medium">{row.location}</span>,
  },
  {
    key: "reason",
    header: "Reason",
    cell: (row) => <span className="capitalize">{row.reason}</span>,
  },
  {
    key: "status",
    header: "Status",
    cell: (row) => <DomainStatusChip status={row.status} />,
  },
  {
    key: "items",
    header: "Items",
    align: "right",
    cell: (row) => row.itemsCount,
  },
  {
    key: "value",
    header: "Value change",
    align: "right",
    cell: (row) => (
      <span
        className={
          row.valueChangeMinor < 0
            ? "text-red-600 dark:text-red-400"
            : "text-emerald-600 dark:text-emerald-400"
        }
      >
        {row.valueChangeMinor < 0 ? "−" : "+"}
        {formatMoney(Math.abs(row.valueChangeMinor), row.currency, row.scale)}
      </span>
    ),
  },
  {
    key: "created",
    header: "Created",
    align: "right",
    cell: (row) => (
      <div className="text-right">
        <p>{new Date(row.createdAt).toLocaleDateString()}</p>
        <p className="text-muted-foreground text-xs">{row.createdBy}</p>
      </div>
    ),
  },
];

function AdjustmentsScreen() {
  const { data, isLoading, isError, refetch } = useFeatureQuery<
    StockAdjustment[]
  >({
    feature: "inventory.adjustments",
    queryKey: ["inventory", "adjustments"],
    mock: MOCK_ADJUSTMENTS,
  });

  const rows = data ?? [];
  const pending = rows.filter((r) => r.status === "pending").length;
  const netValue = rows.reduce((s, r) => s + r.valueChangeMinor, 0);

  return (
    <ResourcePage<StockAdjustment>
      columns={columns}
      description="Write-offs, cycle-count corrections, and other stock value changes."
      emptyDescription="Record an adjustment when physical stock differs from the system."
      emptyTitle="No adjustments"
      errorMessage="Could not load adjustments."
      feature="inventory.adjustments"
      icon={Scale}
      isError={isError}
      isLoading={isLoading}
      metrics={[
        {
          label: "Adjustments",
          value: String(rows.length),
          icon: ClipboardList,
          hint: "This period",
        },
        {
          label: "Pending approval",
          value: String(pending),
          icon: PackageMinus,
          hint: "Awaiting sign-off",
        },
        {
          label: "Net value change",
          value: `${netValue < 0 ? "−" : "+"}${formatMoney(
            Math.abs(netValue),
            "GYD",
            2
          )}`,
          icon: Scale,
          hint: "Across all adjustments",
        },
      ]}
      onRetry={() => refetch()}
      primaryAction={{
        label: "New adjustment",
        onClick: () => {
          /* opens adjustment wizard when backend is wired */
        },
      }}
      rowKey={(row) => row.id}
      rows={rows}
      searchFilter={(row, q) =>
        row.reference.toLowerCase().includes(q) ||
        row.location.toLowerCase().includes(q)
      }
      searchPlaceholder="Search adjustments"
      title="Stock Adjustments"
    />
  );
}
