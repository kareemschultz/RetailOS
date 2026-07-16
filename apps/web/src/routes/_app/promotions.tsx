import { DomainStatusChip } from "@RetailOS/ui/components/status-chip";
import { createFileRoute } from "@tanstack/react-router";
import { Megaphone, Tag, TicketPercent } from "lucide-react";

import { type ResourceColumn, ResourcePage } from "@/components/resource-page";
import { MOCK_PROMOTIONS, type Promotion } from "@/data/mock/finance";
import { useFeatureQuery } from "@/data/mock-query";

export const Route = createFileRoute("/_app/promotions")({
  component: PromotionsScreen,
});

const columns: ResourceColumn<Promotion>[] = [
  {
    key: "name",
    header: "Promotion",
    cell: (row) => (
      <div className="min-w-0">
        <p className="truncate font-medium">{row.name}</p>
        <p className="truncate font-mono text-muted-foreground text-xs">
          {row.code}
        </p>
      </div>
    ),
  },
  {
    key: "type",
    header: "Type",
    cell: (row) => <span className="capitalize">{row.type}</span>,
  },
  {
    key: "value",
    header: "Reward",
    cell: (row) => <span className="font-medium">{row.value}</span>,
  },
  {
    key: "status",
    header: "Status",
    cell: (row) => <DomainStatusChip status={row.status} />,
  },
  {
    key: "redemptions",
    header: "Redemptions",
    align: "right",
    cell: (row) => row.redemptions.toLocaleString(),
  },
  {
    key: "window",
    header: "Active window",
    align: "right",
    cell: (row) =>
      `${new Date(row.startsAt).toLocaleDateString()} – ${new Date(
        row.endsAt
      ).toLocaleDateString()}`,
  },
];

function PromotionsScreen() {
  const { data, isLoading, isError, refetch } = useFeatureQuery<Promotion[]>({
    feature: "promotions.campaigns",
    queryKey: ["promotions", "campaigns"],
    mock: MOCK_PROMOTIONS,
  });

  const rows = data ?? [];
  const active = rows.filter((r) => r.status === "active").length;
  const redemptions = rows.reduce((s, r) => s + r.redemptions, 0);

  return (
    <ResourcePage<Promotion>
      columns={columns}
      description="Discount codes, campaigns, and bundle offers across your channels."
      emptyDescription="Launch a promotion to drive sales across POS and storefront."
      emptyTitle="No promotions"
      errorMessage="Could not load promotions."
      feature="promotions.campaigns"
      icon={Megaphone}
      isError={isError}
      isLoading={isLoading}
      metrics={[
        {
          label: "Active promotions",
          value: String(active),
          icon: TicketPercent,
          hint: "Running now",
        },
        {
          label: "Total campaigns",
          value: String(rows.length),
          icon: Megaphone,
          hint: "All statuses",
        },
        {
          label: "Redemptions",
          value: redemptions.toLocaleString(),
          icon: Tag,
          hint: "Lifetime uses",
        },
      ]}
      onRetry={() => refetch()}
      primaryAction={{
        label: "New promotion",
        onClick: () => {
          /* opens promotion wizard when backend is wired */
        },
      }}
      rowKey={(row) => row.id}
      rows={rows}
      searchFilter={(row, q) =>
        row.name.toLowerCase().includes(q) || row.code.toLowerCase().includes(q)
      }
      searchPlaceholder="Search promotions"
      title="Promotions"
    />
  );
}
