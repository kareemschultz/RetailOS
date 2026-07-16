import { StatusChip } from "@RetailOS/ui/components/status-chip";
import { createFileRoute } from "@tanstack/react-router";
import { Layers, Percent, Tag } from "lucide-react";

import { type ResourceColumn, ResourcePage } from "@/components/resource-page";
import { MOCK_PRICE_LIST, type PriceListEntry } from "@/data/mock/finance";
import { useFeatureQuery } from "@/data/mock-query";
import { formatMoney } from "@/lib/format";

export const Route = createFileRoute("/_app/pricing")({
  component: PricingScreen,
});

const columns: ResourceColumn<PriceListEntry>[] = [
  {
    key: "product",
    header: "Product",
    cell: (row) => (
      <div className="min-w-0">
        <p className="truncate font-medium">{row.product}</p>
        <p className="truncate font-mono text-muted-foreground text-xs">
          {row.sku}
        </p>
      </div>
    ),
  },
  {
    key: "list",
    header: "Price list",
    cell: (row) => (
      <StatusChip tone={row.priceList === "Wholesale" ? "info" : "neutral"}>
        {row.priceList}
      </StatusChip>
    ),
  },
  {
    key: "base",
    header: "Base cost",
    align: "right",
    cell: (row) => formatMoney(row.basePriceMinor, row.currency, row.scale),
  },
  {
    key: "price",
    header: "List price",
    align: "right",
    cell: (row) => formatMoney(row.listPriceMinor, row.currency, row.scale),
  },
  {
    key: "margin",
    header: "Margin",
    align: "right",
    cell: (row) => `${row.marginPct}%`,
  },
  {
    key: "effective",
    header: "Effective",
    align: "right",
    cell: (row) => new Date(row.effectiveFrom).toLocaleDateString(),
  },
];

function PricingScreen() {
  const { data, isLoading, isError, refetch } = useFeatureQuery<
    PriceListEntry[]
  >({
    feature: "pricing.lists",
    queryKey: ["pricing", "lists"],
    mock: MOCK_PRICE_LIST,
  });

  const rows = data ?? [];
  const lists = new Set(rows.map((r) => r.priceList)).size;
  const avgMargin =
    rows.length > 0
      ? Math.round(rows.reduce((s, r) => s + r.marginPct, 0) / rows.length)
      : 0;

  return (
    <ResourcePage<PriceListEntry>
      columns={columns}
      description="Price lists, per-channel pricing, and margins across your catalog."
      emptyDescription="Define a price list to control what you charge per channel."
      emptyTitle="No pricing rules"
      errorMessage="Could not load pricing."
      feature="pricing.lists"
      icon={Tag}
      isError={isError}
      isLoading={isLoading}
      metrics={[
        {
          label: "Priced items",
          value: String(rows.length),
          icon: Tag,
          hint: "Across all lists",
        },
        {
          label: "Price lists",
          value: String(lists),
          icon: Layers,
          hint: "Retail, wholesale…",
        },
        {
          label: "Average margin",
          value: `${avgMargin}%`,
          icon: Percent,
          hint: "Blended across items",
        },
      ]}
      onRetry={() => refetch()}
      primaryAction={{
        label: "New price rule",
        onClick: () => {
          /* opens pricing wizard when backend is wired */
        },
      }}
      rowKey={(row) => row.id}
      rows={rows}
      searchFilter={(row, q) =>
        row.product.toLowerCase().includes(q) ||
        row.sku.toLowerCase().includes(q)
      }
      searchPlaceholder="Search products"
      title="Pricing"
    />
  );
}
