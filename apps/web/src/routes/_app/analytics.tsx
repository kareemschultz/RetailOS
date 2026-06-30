import { createFileRoute } from "@tanstack/react-router";
import {
  BookMarkedIcon,
  ChartPieIcon,
  DollarSignIcon,
  ShoppingCartIcon,
  WalletIcon,
} from "lucide-react";

import ConversionRateCard from "@/features/analytics/chart-conversion-rate";
import EarningReportCard from "@/features/analytics/chart-earning-report";
import PerformanceCard from "@/features/analytics/chart-performance";
import ServicesBySalesCard from "@/features/analytics/chart-services-by-sales";
import StatisticsCard, {
  type StatisticsCardProps,
} from "@/features/analytics/statistics-card-03";
import StatisticsImpressionCard from "@/features/analytics/statistics-impression-card";
import StatisticsTotalProfitCard from "@/features/analytics/statistics-total-profit-card";
import StatisticsTotalRevenueCard from "@/features/analytics/statistics-total-revenue-card";
import PaymentHistoryCard from "@/features/analytics/widget-payment-history";

export const Route = createFileRoute("/_app/analytics")({
  component: AnalyticsDashboard,
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
    iconClassName: "bg-chart-1/10 text-chart-1",
  },
  {
    icon: <BookMarkedIcon />,
    title: "Bookmarks",
    value: "$1,200",
    trend: "up",
    changePercentage: "+38%",
    badgeContent: "Last 6 months",
    iconClassName: "bg-chart-3/10 text-chart-3",
  },
];

// Chart data
const conversionRateChartData = [
  { month: "January", conversion: 240 },
  { month: "February", conversion: 270 },
  { month: "March", conversion: 380 },
  { month: "April", conversion: 230 },
  { month: "May", conversion: 450 },
  { month: "June", conversion: 570 },
  { month: "July", conversion: 310 },
];

// Conversion data
const conversionData = [
  {
    title: "Impressions",
    stat: "12.2K Visits",
    trend: "up",
    percentageChange: 20.3,
  },
  {
    title: "Added to cart",
    stat: "32 product in cart",
    trend: "up",
    percentageChange: 6.3,
  },
  {
    title: "Checkout",
    stat: "15 Product checkout",
    trend: "down",
    percentageChange: 9.56,
  },
  {
    title: "Purchased",
    stat: "12 orders",
    trend: "up",
    percentageChange: 2.62,
  },
];

// Earning report data
const statData = [
  {
    icon: <ChartPieIcon />,
    title: "Net profit",
    department: "Sales",
    value: "$1,623",
    trend: "up",
    percentage: 20.3,
    iconClassName: "bg-chart-1/10 text-chart-1",
  },
  {
    icon: <DollarSignIcon />,
    title: "Total income",
    department: "Sales, Affiliation",
    value: "$5,600",
    trend: "up",
    percentage: 16.2,
    iconClassName: "bg-chart-2/10 text-chart-2",
  },
  {
    icon: <WalletIcon />,
    title: "Total expense",
    department: "ADVT, Marketing",
    value: "$3,200",
    trend: "up",
    percentage: 10.5,
    iconClassName: "bg-chart-3/10 text-chart-3",
  },
];

// Chart data
const earningReportChartData = [
  {
    day: "Monday",
    earning: 48,
    fill: "color-mix(in oklab, var(--chart-3) 20%, transparent)",
  },
  {
    day: "Tuesday",
    earning: 147,
    fill: "color-mix(in oklab, var(--chart-3) 20%, transparent)",
  },
  {
    day: "Wednesday",
    earning: 106,
    fill: "color-mix(in oklab, var(--chart-3) 20%, transparent)",
  },
  { day: "Thursday", earning: 180, fill: "var(--chart-3)" },
  {
    day: "Friday",
    earning: 75,
    fill: "color-mix(in oklab, var(--chart-3) 20%, transparent)",
  },
  {
    day: "Saturday",
    earning: 60,
    fill: "color-mix(in oklab, var(--chart-3) 20%, transparent)",
  },
  {
    day: "Sunday",
    earning: 128,
    fill: "color-mix(in oklab, var(--chart-3) 20%, transparent)",
  },
];

// Payment data
const paymentData = [
  {
    img: "/images/widgets/master-card.webp",
    imgWidth: "w-8",
    cardNumber: "5688",
    cardType: "Credit Card",
    date: "05/Jan",
    spend: "2,820",
    remaining: "10,020",
  },
  {
    img: "/images/widgets/visa.webp",
    imgWidth: "w-8",
    cardNumber: "8562",
    cardType: "Debit Card",
    date: "15/Feb",
    spend: "1,450",
    remaining: "8,570",
  },
  {
    img: "/images/widgets/american-express.webp",
    imgWidth: "w-10.5",
    cardNumber: "5238",
    cardType: "ATM card",
    date: "20/Mar",
    spend: "500",
    remaining: "7,070",
  },
  {
    img: "/images/widgets/visa.webp",
    imgWidth: "w-8",
    cardNumber: "8562",
    cardType: "Debit card",
    date: "10/Mar",
    spend: "750",
    remaining: "5,120",
  },
  {
    img: "/images/widgets/master-card.webp",
    imgWidth: "w-8",
    cardNumber: "*5688",
    cardType: "Credit Card",
    date: "25/May",
    spend: "1,200",
    remaining: "5,870",
  },
  {
    img: "/images/widgets/visa.webp",
    imgWidth: "w-8",
    cardNumber: "8562",
    cardType: "Credit card",
    date: "10/Mar",
    spend: "950",
    remaining: "4920",
  },
];

function AnalyticsDashboard() {
  return (
    <div className="grid grid-cols-6 gap-6">
      <StatisticsTotalProfitCard className="max-sm:col-span-full max-lg:col-span-3 max-2xl:col-span-2" />

      <StatisticsTotalRevenueCard className="max-sm:col-span-full max-lg:col-span-3 max-2xl:col-span-2" />

      <StatisticsImpressionCard className="max-sm:col-span-full max-lg:col-span-3 max-2xl:col-span-2" />

      {statisticsCardData.map((card) => (
        <StatisticsCard
          badgeContent={card.badgeContent}
          changePercentage={card.changePercentage}
          className="max-sm:col-span-full max-lg:col-span-3 max-2xl:col-span-2"
          icon={card.icon}
          iconClassName={card.iconClassName}
          key={card.title}
          title={card.title}
          trend={card.trend}
          value={card.value}
        />
      ))}

      <ServicesBySalesCard className="col-span-full 2xl:col-span-4" />

      <ConversionRateCard
        chartData={conversionRateChartData}
        className="col-span-full lg:col-span-3 2xl:col-span-2"
        conversionData={conversionData}
        conversionTrend="up"
        percentageChange={6.3}
        subTitle="Compared to last month"
        title="Conversion rate"
        totalConversion={92.8}
      />

      <PerformanceCard className="col-span-full lg:col-span-3 2xl:col-span-2" />

      <EarningReportCard
        chartData={earningReportChartData}
        className="col-span-full lg:col-span-3 2xl:col-span-2"
        statData={statData}
        subTitle="Weekly Earning overview"
        title="Earning Report"
      />

      <PaymentHistoryCard
        className="col-span-full lg:col-span-3 2xl:col-span-2"
        paymentData={paymentData}
        title="Payment History"
      />
    </div>
  );
}
