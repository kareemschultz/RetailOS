import { Card } from "@RetailOS/ui/components/card";
import { createFileRoute } from "@tanstack/react-router";
import {
  BellRingIcon,
  BookMarkedIcon,
  CircleOffIcon,
  DollarSignIcon,
  MailOpenIcon,
  MousePointerClickIcon,
  ShoppingCartIcon,
  TicketCheckIcon,
  TriangleAlertIcon,
} from "lucide-react";
import TotalEarningCard from "@/features/campaigns/chart-total-earning";
import TotalIncomeCard from "@/features/campaigns/chart-total-income";
import CustomersCardSvg from "@/features/campaigns/customers-card-svg";
import UserDatatable, { type Item } from "@/features/campaigns/datatable-user";
import StatisticsCard, {
  type StatisticsCardProps,
} from "@/features/campaigns/statistics-card-03";
import StatisticsCardWithSvg from "@/features/campaigns/statistics-card-04";
import ForBusinessSharkCard from "@/features/campaigns/widget-for-business-shark";
import MonthlyCampaignCard from "@/features/campaigns/widget-monthly-campaign";
import VehiclesConditionCard from "@/features/campaigns/widget-vehicles-condition";

export const Route = createFileRoute("/_app/campaigns")({
  component: CampaignDashboard,
});

// Promotion headline metrics
const statisticsCardData: StatisticsCardProps[] = [
  {
    icon: <TicketCheckIcon />,
    title: "Promo Sales",
    value: "G$13.4M",
    trend: "up",
    changePercentage: "+38%",
    badgeContent: "Last 6 months",
    iconClassName: "bg-chart-1/10 text-chart-1",
  },
  {
    icon: <ShoppingCartIcon />,
    title: "Coupons Redeemed",
    value: "15.5K",
    trend: "up",
    changePercentage: "+22%",
    badgeContent: "Last 4 months",
    iconClassName: "bg-chart-2/10 text-chart-2",
  },
  {
    icon: <DollarSignIcon />,
    title: "Discount Given",
    value: "G$8.93M",
    trend: "down",
    changePercentage: "-16%",
    badgeContent: "Last one year",
    iconClassName: "bg-chart-3/10 text-chart-3",
  },
  {
    icon: <BookMarkedIcon />,
    title: "Loyalty Signups",
    value: "1,200",
    trend: "up",
    changePercentage: "+38%",
    badgeContent: "Last 6 months",
    iconClassName: "bg-chart-4/10 text-chart-4",
  },
];

// Promo channel funnel (SMS / WhatsApp blast)
const campaignData = [
  {
    icon: <MailOpenIcon />,
    title: "Messages sent",
    value: "14,250",
    percentage: "0.3%",
    avatarClassName: "bg-chart-1/10 text-chart-1",
  },
  {
    icon: <MailOpenIcon />,
    title: "Opened",
    value: "4,523",
    percentage: "3.1%",
    avatarClassName: "bg-chart-2/10 text-chart-2",
  },
  {
    icon: <MousePointerClickIcon />,
    title: "Clicked",
    value: "1,250",
    percentage: "1.3%",
    avatarClassName: "bg-chart-4/10 text-chart-4",
  },
  {
    icon: <BellRingIcon />,
    title: "Redeemed",
    value: "750",
    percentage: "9.8%",
    avatarClassName: "bg-chart-3/10 text-chart-3",
  },
  {
    icon: <TriangleAlertIcon />,
    title: "Failed",
    value: "20",
    percentage: "1.5%",
    avatarClassName: "bg-chart-5/10 text-chart-5",
  },
  {
    icon: <CircleOffIcon />,
    title: "Opted out",
    value: "86",
    percentage: "0.6%",
  },
];

// Active promotions status board
const promotionStatusData = [
  {
    condition: "Active",
    details: "12 promotions live",
    progressValue: 55,
    changePercentage: "+25%",
    progressClassName: "stroke-chart-1",
  },
  {
    condition: "Scheduled",
    details: "24 queued",
    progressValue: 20,
    changePercentage: "+30%",
    progressClassName: "stroke-chart-2",
  },
  {
    condition: "Mix & Match",
    details: "182 SKUs",
    progressValue: 12,
    changePercentage: "-15%",
    progressClassName: "stroke-chart-3",
  },
  {
    condition: "Paused",
    details: "9 promotions",
    progressValue: 7,
    changePercentage: "+35%",
    progressClassName: "stroke-chart-4",
  },
  {
    condition: "Ended",
    details: "3 promotions",
    progressValue: 4,
    changePercentage: "-2%",
    progressClassName: "stroke-chart-5",
  },
  {
    condition: "Draft",
    details: "2 promotions",
    progressValue: 2,
    changePercentage: "+1%",
  },
];

// Loyalty members reached
const memberData: Item[] = [
  {
    id: "1",
    avatar: "/images/avatars/avatar-1.webp",
    fallback: "JA",
    user: "Jack Alfredo",
    email: "jack.alfredo@gmail.com",
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
    email: "sarah.mitchell@gmail.com",
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
    email: "robert.chen@gmail.com",
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
    email: "emily.wilson@gmail.com",
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
    email: "david.garcia@gmail.com",
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
    email: "lisa.thompson@gmail.com",
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
    email: "michael.anderson@gmail.com",
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
    email: "jessica.rodriguez@gmail.com",
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
    email: "chris.brown@gmail.com",
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
    email: "amanda.davis@gmail.com",
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
    email: "james.johnson@gmail.com",
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
    email: "maria.williams@gmail.com",
    role: "editor",
    plan: "company",
    billing: "manual-cash",
    status: "active",
  },
];

function CampaignDashboard() {
  return (
    <div className="grid grid-cols-2 gap-6 xl:grid-cols-3">
      <div className="col-span-2 grid grid-cols-2 gap-6 xl:grid-cols-4">
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
      </div>

      <StatisticsCardWithSvg
        badgeContent="Daily customers"
        changePercentage={9.2}
        className="max-xl:col-span-full"
        svg={<CustomersCardSvg />}
        title="Customers"
        value="42.4k"
      />

      <TotalIncomeCard className="col-span-2" />

      <MonthlyCampaignCard
        campaignData={campaignData}
        className="justify-between max-sm:col-span-full md:max-lg:col-span-full"
        subTitle="7.58k loyalty members"
        title="Monthly campaign state"
      />

      <TotalEarningCard className="justify-between *:data-[slot=card-content]:space-y-6 max-sm:col-span-full md:max-lg:col-span-full" />

      <ForBusinessSharkCard className="max-sm:col-span-full md:max-lg:col-span-full" />

      <VehiclesConditionCard
        className="justify-between gap-6 max-sm:col-span-full md:max-lg:col-span-full"
        title="Promotion Status"
        vehicleConditionData={promotionStatusData}
      />

      <Card className="col-span-full py-0">
        <UserDatatable data={memberData} />
      </Card>
    </div>
  );
}
