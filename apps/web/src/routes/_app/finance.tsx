import { createFileRoute } from "@tanstack/react-router";
import {
  DollarSignIcon,
  Gamepad2Icon,
  HeadphonesIcon,
  LaptopIcon,
  LaptopMinimalIcon,
  MonitorIcon,
  ShoppingCartIcon,
  SmartphoneIcon,
  TabletIcon,
  WatchIcon,
} from "lucide-react";

import FinanceCard from "@/features/finance/chart-finance";
import TotalVisitorsCard from "@/features/finance/chart-total-visitors";
import StatisticsCard, {
  type StatisticsCardProps,
} from "@/features/finance/statistics-card-03";
import StatisticsImpressionCard from "@/features/finance/statistics-impression-card";
import StatisticsTotalRevenueCard from "@/features/finance/statistics-total-revenue-card";
import TopProductsCard from "@/features/finance/widget-top-products";

export const Route = createFileRoute("/_app/finance")({
  component: FinanceDashboard,
});

// Statistics card data
const statisticsCardData: StatisticsCardProps[] = [
  {
    icon: <ShoppingCartIcon />,
    title: "Total Orders",
    value: "155K",
    trend: "up",
    changePercentage: "+22%",
    badgeContent: "Last 4 months",
    iconClassName: "bg-chart-2/10 text-chart-2",
  },
  {
    icon: <DollarSignIcon />,
    title: "Total Profit",
    value: "$89.34k",
    trend: "down",
    changePercentage: "-16%",
    badgeContent: "Last One year",
    iconClassName: "bg-chart-3/10 text-chart-3",
  },
];

// Visitor data
const visitorData = [
  {
    product: "Desktop",
    percentage: 17,
    amount: 23.8,
    trend: "up",
    heightClass: "h-[17%]",
    color: "bg-chart-1",
  },
  {
    product: "Tablet",
    percentage: 65,
    amount: 13.604,
    trend: "down",
    heightClass: "h-[65%]",
    color: "bg-chart-1/20",
  },
  {
    product: "Mobile",
    percentage: 18,
    amount: 47.146,
    trend: "up",
    heightClass: "h-[18%]",
    color: "bg-chart-1/50",
  },
];

// Product by sales data
const productsBySalesData = [
  {
    icon: <SmartphoneIcon />,
    productName: "Samsung galaxy S25",
    productBrand: "Samsung",
    sales: "$32,203",
    iconClassName: "bg-chart-1/10 text-chart-1",
  },
  {
    icon: <LaptopIcon />,
    productName: "Apple MacBook Pro",
    productBrand: "Apple",
    sales: "$1,299",
    iconClassName: "bg-chart-2/10 text-chart-2",
  },
  {
    icon: <HeadphonesIcon />,
    productName: "Sony WH-1000XM4",
    productBrand: "Sony",
    sales: "$348",
    iconClassName: "bg-chart-5/10 text-chart-5",
  },
  {
    icon: <LaptopMinimalIcon />,
    productName: "Dell XPS 13",
    productBrand: "Dell",
    sales: "$999",
  },
  {
    icon: <WatchIcon />,
    productName: "Smart band 4",
    productBrand: "Xiaomi",
    sales: "$749",
    iconClassName: "bg-chart-3/10 text-chart-3",
  },
];

// Products by volume data
const productsByVolumeData = [
  {
    icon: <LaptopIcon />,
    productName: "Dell XPS 13",
    productBrand: "Dell",
    volume: "200k",
    changePercentage: 5,
    iconClassName: "bg-chart-1/10 text-chart-1",
  },
  {
    icon: <TabletIcon />,
    productName: "Apple iPad",
    productBrand: "Apple",
    volume: "80K",
    changePercentage: 10,
    iconClassName: "bg-chart-2/10 text-chart-2",
  },
  {
    icon: <Gamepad2Icon />,
    productName: "Sony PlayStation 5",
    productBrand: "Sony",
    volume: "30k",
    changePercentage: -20,
    iconClassName: "bg-chart-5/10 text-chart-5",
  },
  {
    icon: <MonitorIcon />,
    productName: "IMac pro",
    productBrand: "Apple",
    volume: "15k",
    changePercentage: 12,
  },
  {
    icon: <SmartphoneIcon />,
    productName: "Samsung galaxy S25",
    productBrand: "Samsung",
    volume: "12.4k",
    changePercentage: -15,
    iconClassName: "bg-chart-3/10 text-chart-3",
  },
];

function FinanceDashboard() {
  return (
    <div className="grid grid-cols-6 gap-6">
      <FinanceCard className="col-span-full xl:col-span-4" />

      <div className="col-span-full grid grid-cols-2 gap-6 lg:col-span-3 xl:col-span-2">
        {statisticsCardData.map((card) => (
          <StatisticsCard
            badgeContent={card.badgeContent}
            changePercentage={card.changePercentage}
            icon={card.icon}
            iconClassName={card.iconClassName}
            key={card.title}
            title={card.title}
            trend={card.trend}
            value={card.value}
          />
        ))}

        <StatisticsTotalRevenueCard />

        <StatisticsImpressionCard />
      </div>

      <TotalVisitorsCard
        className="col-span-full lg:col-span-3 xl:col-span-2"
        percentage={-6}
        title="Total visitors"
        totalVisitors="23.02K"
        visitorData={visitorData}
      />

      <TopProductsCard
        className="col-span-full xl:col-span-4"
        productsBySalesData={productsBySalesData}
        productsByVolumeData={productsByVolumeData}
        salesTitle="Top Products by Sales"
        volumeTitle="Top Products by Volume"
      />
    </div>
  );
}
