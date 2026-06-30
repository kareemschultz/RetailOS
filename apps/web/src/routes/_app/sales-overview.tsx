import { Card } from "@RetailOS/ui/components/card";
import { createFileRoute } from "@tanstack/react-router";
import {
  ChartPieIcon,
  CircleDollarSignIcon,
  CreditCardIcon,
  DollarSignIcon,
  WalletIcon,
} from "lucide-react";
import EarningReportCard from "@/features/sales-overview/chart-earning-report";
import TotalSalesCard from "@/features/sales-overview/chart-total-sales";
import TotalTransactionCard from "@/features/sales-overview/chart-total-transaction";
import InvoiceDatatable, {
  type Item,
} from "@/features/sales-overview/datatable-invoice";
import StatisticsCard from "@/features/sales-overview/statistics-card-05";
import StatisticsOrderCard from "@/features/sales-overview/statistics-order-card";
import StatisticsProfitCard from "@/features/sales-overview/statistics-profit-card";
import StatisticsTotalProfitCard from "@/features/sales-overview/statistics-total-profit-card";
import StatisticsUserReachCard from "@/features/sales-overview/statistics-user-reach-card";
import AdvertisementCard from "@/features/sales-overview/widget-advertisement";

export const Route = createFileRoute("/_app/sales-overview")({
  component: SalesOverviewDashboard,
});

// Tender-mix headline cards (GYD)
const statisticsCardData = [
  {
    icon: <CircleDollarSignIcon />,
    title: "Cash Sales",
    badgeContent: "Last week",
    value: "G$4.67M",
    changePercentage: 25.2,
    iconClassName: "bg-chart-2/10 text-chart-2",
  },
  {
    icon: <CreditCardIcon />,
    title: "Card Settlements",
    badgeContent: "Last month",
    value: "G$1.28M",
    changePercentage: -12.2,
    iconClassName: "bg-chart-1/10 text-chart-1",
  },
];

// Earning report breakdown by channel
const statData = [
  {
    icon: <ChartPieIcon />,
    title: "Net margin",
    department: "Georgetown Flagship",
    value: "G$1.62M",
    trend: "up",
    percentage: 20.3,
    iconClassName: "bg-chart-1/10 text-chart-1",
  },
  {
    icon: <DollarSignIcon />,
    title: "Total revenue",
    department: "Retail, Wholesale",
    value: "G$5.60M",
    trend: "up",
    percentage: 16.2,
    iconClassName: "bg-chart-2/10 text-chart-2",
  },
  {
    icon: <WalletIcon />,
    title: "Total expense",
    department: "Restock, Freight",
    value: "G$3.20M",
    trend: "up",
    percentage: 10.5,
    iconClassName: "bg-chart-5/10 text-chart-5",
  },
];

// Weekly earnings (thousands GYD)
const earningReportChartData = [
  {
    day: "Monday",
    earning: 48,
    fill: "color-mix(in oklab, var(--chart-2) 20%, transparent)",
  },
  {
    day: "Tuesday",
    earning: 147,
    fill: "color-mix(in oklab, var(--chart-2) 20%, transparent)",
  },
  {
    day: "Wednesday",
    earning: 106,
    fill: "color-mix(in oklab, var(--chart-2) 20%, transparent)",
  },
  { day: "Thursday", earning: 180, fill: "var(--chart-2)" },
  {
    day: "Friday",
    earning: 75,
    fill: "color-mix(in oklab, var(--chart-2) 20%, transparent)",
  },
  {
    day: "Saturday",
    earning: 60,
    fill: "color-mix(in oklab, var(--chart-2) 20%, transparent)",
  },
  {
    day: "Sunday",
    earning: 128,
    fill: "color-mix(in oklab, var(--chart-2) 20%, transparent)",
  },
];

// Wholesale invoices (Caribbean retail context)
const invoiceData: Item[] = [
  {
    id: "INV-5099",
    status: "draft",
    avatar: "/images/avatars/avatar-1.webp",
    fallback: "GS",
    client: "Giftland Supermarket",
    field: "Wholesale",
    total: 312_000,
    issuedDate: new Date("2025-04-03"),
    balance: 0,
  },
  {
    id: "INV-5008",
    status: "paid",
    avatar: "/images/avatars/avatar-2.webp",
    fallback: "MR",
    client: "Mohamed's Retail",
    field: "Wholesale",
    total: 145_000,
    issuedDate: new Date("2025-05-12"),
    balance: 0,
  },
  {
    id: "INV-5101",
    status: "paid",
    avatar: "/images/avatars/avatar-3.webp",
    fallback: "BH",
    client: "Bounty Hardware",
    field: "Hardware",
    total: 120_000,
    issuedDate: new Date("2025-06-26"),
    balance: 0,
  },
  {
    id: "INV-4586",
    status: "downloaded",
    avatar: "/images/avatars/avatar-4.webp",
    fallback: "LP",
    client: "Linden Pharmacy",
    field: "Pharmacy",
    total: 268_000,
    issuedDate: new Date("2025-07-05"),
    balance: -7800,
  },
  {
    id: "INV-4360",
    status: "draft",
    avatar: "/images/avatars/avatar-5.webp",
    fallback: "AE",
    client: "Amazonia Electronics",
    field: "Electronics",
    total: 312_000,
    issuedDate: new Date("2025-08-07"),
    balance: 0,
  },
  {
    id: "INV-5104",
    status: "past due",
    avatar: "/images/avatars/avatar-6.webp",
    fallback: "BD",
    client: "Berbice Distributors",
    field: "Wholesale",
    total: 160_000,
    issuedDate: new Date("2025-08-26"),
    balance: 8600,
  },
  {
    id: "INV-5201",
    status: "paid",
    avatar: "/images/avatars/avatar-7.webp",
    fallback: "NA",
    client: "New Amsterdam Grocers",
    field: "Supermarket",
    total: 285_000,
    issuedDate: new Date("2025-01-15"),
    balance: 0,
  },
  {
    id: "INV-4987",
    status: "draft",
    avatar: "/images/avatars/avatar-8.webp",
    fallback: "BT",
    client: "Bartica Trading Co.",
    field: "Wholesale",
    total: 175_000,
    issuedDate: new Date("2025-02-20"),
    balance: 0,
  },
  {
    id: "INV-5342",
    status: "downloaded",
    avatar: "/images/avatars/avatar-9.webp",
    fallback: "SP",
    client: "Stabroek Provisions",
    field: "Supermarket",
    total: 350_000,
    issuedDate: new Date("2025-03-10"),
    balance: -12_000,
  },
  {
    id: "INV-4723",
    status: "past due",
    avatar: "/images/avatars/avatar-10.webp",
    fallback: "EA",
    client: "Essequibo Auto Parts",
    field: "Auto Parts",
    total: 220_000,
    issuedDate: new Date("2025-04-18"),
    balance: 25_000,
  },
  {
    id: "INV-5445",
    status: "paid",
    avatar: "/images/avatars/avatar-11.webp",
    fallback: "DF",
    client: "Diamond Furniture",
    field: "Furniture",
    total: 420_000,
    issuedDate: new Date("2025-05-22"),
    balance: 0,
  },
  {
    id: "INV-4892",
    status: "draft",
    avatar: "/images/avatars/avatar-12.webp",
    fallback: "TC",
    client: "Tropical Clothing",
    field: "Apparel",
    total: 195_000,
    issuedDate: new Date("2025-06-14"),
    balance: 0,
  },
];

function SalesOverviewDashboard() {
  return (
    <div className="grid grid-cols-6 gap-6">
      <StatisticsTotalProfitCard className="max-md:col-span-3 max-xl:col-span-2" />
      <StatisticsOrderCard className="max-md:col-span-3 max-xl:col-span-2" />
      <StatisticsProfitCard className="max-md:col-span-3 max-xl:col-span-2" />
      <StatisticsUserReachCard className="max-md:col-span-3 max-xl:col-span-2" />

      {statisticsCardData.map((card) => (
        <StatisticsCard
          changePercentage={card.changePercentage}
          className="max-md:col-span-3 max-xl:col-span-2"
          icon={card.icon}
          iconClassName={card.iconClassName}
          key={card.title}
          time={card.badgeContent}
          title={card.title}
          value={card.value}
        />
      ))}

      <TotalTransactionCard className="col-span-full lg:col-span-4" />

      <TotalSalesCard className="col-span-full sm:col-span-3 lg:col-span-2" />

      <EarningReportCard
        chartData={earningReportChartData}
        className="col-span-full sm:col-span-3 lg:col-span-2"
        statData={statData}
        subTitle="Weekly earning overview"
        title="Earning Report"
      />

      <AdvertisementCard className="col-span-full sm:col-span-3 lg:col-span-2" />

      <Card className="col-span-full py-0">
        <InvoiceDatatable data={invoiceData} />
      </Card>
    </div>
  );
}
