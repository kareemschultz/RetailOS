import { Card } from "@RetailOS/ui/components/card";
import { createFileRoute } from "@tanstack/react-router";
import ConversionRateCard from "@/features/productivity/chart-conversion-rate";
import PerformanceCard from "@/features/productivity/chart-performance";
import ProjectTimelineCard from "@/features/productivity/chart-project-timeline";
import WeeklyOverviewCard from "@/features/productivity/chart-weekly-overview";
import UserDatatable, {
  type Item,
} from "@/features/productivity/datatable-user";

export const Route = createFileRoute("/_app/productivity")({
  component: ProductivityDashboard,
});

// Fulfilment throughput by month
const fulfilmentChartData = [
  { month: "January", conversion: 240 },
  { month: "February", conversion: 270 },
  { month: "March", conversion: 380 },
  { month: "April", conversion: 230 },
  { month: "May", conversion: 450 },
  { month: "June", conversion: 570 },
  { month: "July", conversion: 310 },
];

// Warehouse pick-pack-dispatch funnel
const fulfilmentFunnel = [
  {
    title: "Orders received",
    stat: "12.2K orders",
    trend: "up",
    percentageChange: 20.3,
  },
  {
    title: "Picked",
    stat: "11.8K picked",
    trend: "up",
    percentageChange: 6.3,
  },
  {
    title: "Packed",
    stat: "10.4K packed",
    trend: "down",
    percentageChange: 9.56,
  },
  {
    title: "Dispatched",
    stat: "9.9K dispatched",
    trend: "up",
    percentageChange: 2.62,
  },
];

// Staff & warehouse roster
const staffData: Item[] = [
  {
    id: "1",
    avatar: "/images/avatars/avatar-1.webp",
    fallback: "JA",
    user: "Jack Alfredo",
    email: "jack.alfredo@retailos.gy",
    role: "maintainer",
    plan: "enterprise",
    billing: "auto-debit",
    status: "active",
  },
  {
    id: "2",
    avatar: "/images/avatars/avatar-2.webp",
    fallback: "SM",
    user: "Sarah Mitchell",
    email: "sarah.mitchell@retailos.gy",
    role: "admin",
    plan: "enterprise",
    billing: "auto-debit",
    status: "active",
  },
  {
    id: "3",
    avatar: "/images/avatars/avatar-3.webp",
    fallback: "RC",
    user: "Robert Chen",
    email: "robert.chen@retailos.gy",
    role: "editor",
    plan: "team",
    billing: "manual-paypal",
    status: "pending",
  },
  {
    id: "4",
    avatar: "/images/avatars/avatar-4.webp",
    fallback: "EW",
    user: "Emily Wilson",
    email: "emily.wilson@retailos.gy",
    role: "author",
    plan: "basic",
    billing: "manual-cash",
    status: "inactive",
  },
  {
    id: "5",
    avatar: "/images/avatars/avatar-5.webp",
    fallback: "DG",
    user: "David Garcia",
    email: "david.garcia@retailos.gy",
    role: "subscriber",
    plan: "company",
    billing: "auto-debit",
    status: "active",
  },
  {
    id: "6",
    avatar: "/images/avatars/avatar-6.webp",
    fallback: "LT",
    user: "Lisa Thompson",
    email: "lisa.thompson@retailos.gy",
    role: "editor",
    plan: "team",
    billing: "manual-paypal",
    status: "active",
  },
  {
    id: "7",
    avatar: "/images/avatars/avatar-7.webp",
    fallback: "MA",
    user: "Michael Anderson",
    email: "michael.anderson@retailos.gy",
    role: "maintainer",
    plan: "enterprise",
    billing: "auto-debit",
    status: "pending",
  },
  {
    id: "8",
    avatar: "/images/avatars/avatar-8.webp",
    fallback: "JR",
    user: "Jessica Rodriguez",
    email: "jessica.rodriguez@retailos.gy",
    role: "author",
    plan: "basic",
    billing: "manual-cash",
    status: "active",
  },
  {
    id: "9",
    avatar: "/images/avatars/avatar-9.webp",
    fallback: "CB",
    user: "Christopher Brown",
    email: "chris.brown@retailos.gy",
    role: "admin",
    plan: "company",
    billing: "auto-debit",
    status: "inactive",
  },
  {
    id: "10",
    avatar: "/images/avatars/avatar-10.webp",
    fallback: "AD",
    user: "Amanda Davis",
    email: "amanda.davis@retailos.gy",
    role: "subscriber",
    plan: "basic",
    billing: "manual-paypal",
    status: "active",
  },
  {
    id: "11",
    avatar: "/images/avatars/avatar-11.webp",
    fallback: "JJ",
    user: "James Johnson",
    email: "james.johnson@retailos.gy",
    role: "maintainer",
    plan: "team",
    billing: "auto-debit",
    status: "pending",
  },
  {
    id: "12",
    avatar: "/images/avatars/avatar-12.webp",
    fallback: "MW",
    user: "Maria Williams",
    email: "maria.williams@retailos.gy",
    role: "editor",
    plan: "company",
    billing: "manual-cash",
    status: "active",
  },
];

function ProductivityDashboard() {
  return (
    <div className="grid grid-cols-6 gap-6">
      <ProjectTimelineCard className="col-span-full 2xl:col-span-4" />

      <WeeklyOverviewCard className="col-span-full lg:col-span-3 2xl:col-span-2" />

      <ConversionRateCard
        chartData={fulfilmentChartData}
        className="col-span-full lg:col-span-3 2xl:col-span-2"
        conversionData={fulfilmentFunnel}
        conversionTrend="up"
        percentageChange={6.3}
        subTitle="Compared to last month"
        title="Fulfilment rate"
        totalConversion={92.8}
      />

      <PerformanceCard className="col-span-full lg:col-span-3 2xl:col-span-2" />

      <Card className="col-span-full py-0 shadow-none">
        <UserDatatable data={staffData} />
      </Card>
    </div>
  );
}
