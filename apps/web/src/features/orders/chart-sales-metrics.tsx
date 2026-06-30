// Third-party Imports

// Component Imports
import { Avatar, AvatarFallback } from "@RetailOS/ui/components/avatar";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@RetailOS/ui/components/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@RetailOS/ui/components/chart";
import {
  BadgePercentIcon,
  ChartNoAxesCombinedIcon,
  CirclePercentIcon,
  DollarSignIcon,
  ShoppingBagIcon,
  TrendingUpIcon,
} from "lucide-react";
import { Bar, BarChart, Label, Pie, PieChart } from "recharts";

const salesPlanPercentage = 54;
const totalBars = 24;
const filledBars = Math.round((salesPlanPercentage * totalBars) / 100);

// Sales chart data
const salesChartData = Array.from({ length: totalBars }, (_, index) => {
  const date = new Date(2025, 5, 15);

  const formattedDate = date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return {
    date: formattedDate,
    sales: index < filledBars ? 315 : 0.0001,
  };
});

const salesChartConfig = {
  sales: {
    label: "Sales",
  },
} satisfies ChartConfig;

const MetricsData = [
  {
    icons: <TrendingUpIcon className="size-5" />,
    title: "Sales trend",
    value: "$11,548",
  },
  {
    icons: <BadgePercentIcon className="size-5" />,
    title: "Discount offers",
    value: "$1,326",
  },
  {
    icons: <DollarSignIcon className="size-5" />,
    title: "Net profit",
    value: "$17,356",
  },
  {
    icons: <ShoppingBagIcon className="size-5" />,
    title: "Total orders",
    value: "248",
  },
];

const revenueChartData = [
  { month: "january", sales: 340, fill: "var(--color-january)" },
  { month: "february", sales: 200, fill: "var(--color-february)" },
  { month: "march", sales: 200, fill: "var(--color-march)" },
];

const revenueChartConfig = {
  sales: {
    label: "Sales",
  },
  january: {
    label: "January",
    color: "var(--primary)",
  },
  february: {
    label: "February",
    color: "color-mix(in oklab, var(--primary) 60%, transparent)",
  },
  march: {
    label: "March",
    color: "color-mix(in oklab, var(--primary) 20%, transparent)",
  },
} satisfies ChartConfig;

const SalesMetricsCard = ({ className }: { className?: string }) => (
  <Card className={className}>
    <CardContent>
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="flex flex-col justify-between gap-7 lg:col-span-3">
          <span className="font-semibold text-lg">Sales metrics</span>
          <div className="flex items-center gap-3">
            <img
              alt="logo"
              className="size-10.5 rounded-lg"
              height={42}
              src="/images/brands/logo-square.webp"
              width={42}
            />
            <div className="flex flex-col gap-0.5">
              <span className="font-medium text-xl">Sandy&apos; Company</span>
              <span className="text-muted-foreground text-sm">
                sandy@company.com
              </span>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {MetricsData.map((metric) => (
              <Card
                className="py-2 shadow-none ring-1 ring-foreground/10"
                key={metric.title}
              >
                <CardContent className="flex items-center gap-3 px-4">
                  <Avatar className="rounded-sm after:border-0">
                    <AvatarFallback className="shrink-0 rounded-sm bg-primary/10 text-primary">
                      {metric.icons}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-muted-foreground text-sm">
                      {metric.title}
                    </span>
                    <span className="font-medium text-lg">{metric.value}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
        <Card className="justify-between gap-4 shadow-none ring-1 ring-foreground/10 lg:col-span-2">
          <CardHeader className="gap-1">
            <CardTitle className="font-semibold text-lg">
              Revenue goal
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <ChartContainer
              className="h-38.5 w-full"
              config={revenueChartConfig}
            >
              <PieChart margin={{ top: 0, bottom: 0, left: 0, right: 0 }}>
                <ChartTooltip
                  content={<ChartTooltipContent hideLabel />}
                  cursor={false}
                />
                <Pie
                  data={revenueChartData}
                  dataKey="sales"
                  endAngle={660}
                  innerRadius={58}
                  nameKey="month"
                  outerRadius={75}
                  paddingAngle={2}
                  startAngle={300}
                >
                  <Label
                    content={({ viewBox }) => {
                      if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                        return (
                          <text
                            dominantBaseline="middle"
                            textAnchor="middle"
                            x={viewBox.cx}
                            y={viewBox.cy}
                          >
                            <tspan
                              className="fill-card-foreground font-medium text-lg"
                              x={viewBox.cx}
                              y={(viewBox.cy || 0) - 12}
                            >
                              256.24
                            </tspan>
                            <tspan
                              className="fill-muted-foreground text-sm"
                              x={viewBox.cx}
                              y={(viewBox.cy || 0) + 19}
                            >
                              Total Profit
                            </tspan>
                          </text>
                        );
                      }
                    }}
                  />
                </Pie>
              </PieChart>
            </ChartContainer>
            <div className="flex items-center justify-between">
              <span className="text-xl">Plan completed</span>
              <span className="font-medium text-2xl">56%</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </CardContent>
    <CardContent>
      <Card className="shadow-none ring-1 ring-foreground/10">
        <CardContent className="grid gap-4 lg:grid-cols-5">
          <div className="flex flex-col justify-center gap-6">
            <span className="font-semibold text-lg">Sales plan</span>
            <span className="max-lg:5xl text-6xl">{salesPlanPercentage}%</span>
            <span className="text-muted-foreground text-sm">
              Percentage profit from total sales
            </span>
          </div>
          <div className="flex flex-col gap-6 text-lg md:col-span-4">
            <span className="font-medium">Cohort analysis indicators</span>
            <span className="text-wrap text-muted-foreground">
              Analyzes the behaviour of a group of users who joined a
              product/service at the same time. over a certain period.
            </span>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="flex items-center gap-2">
                <ChartNoAxesCombinedIcon className="size-6" />
                <span className="font-medium text-lg">Open Statistics</span>
              </div>
              <div className="flex items-center gap-2">
                <CirclePercentIcon className="size-6" />
                <span className="font-medium text-lg">Percentage Change</span>
              </div>
            </div>

            <ChartContainer className="h-7.75 w-full" config={salesChartConfig}>
              <BarChart
                accessibilityLayer
                data={salesChartData}
                margin={{
                  left: 0,
                  right: 0,
                }}
                maxBarSize={16}
              >
                <Bar
                  background={{
                    fill: "color-mix(in oklab, var(--primary) 10%, transparent)",
                    radius: 12,
                  }}
                  dataKey="sales"
                  fill="var(--primary)"
                  radius={12}
                />
              </BarChart>
            </ChartContainer>
          </div>
        </CardContent>
      </Card>
    </CardContent>
  </Card>
);

export default SalesMetricsCard;
