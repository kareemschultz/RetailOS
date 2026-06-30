// Third-party Imports

// Component Imports
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@RetailOS/ui/components/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@RetailOS/ui/components/chart";
import { Bar, BarChart } from "recharts";

// Order chart data
const orderChartData = [
  { day: "Monday", orders: 120 },
  { day: "Tuesday", orders: 285 },
  { day: "Wednesday", orders: 190 },
  { day: "Thursday", orders: 190 },
  { day: "Friday", orders: 315 },
  { day: "Saturday", orders: 190 },
  { day: "Sunday", orders: 220 },
];

const orderChartConfig = {
  orders: {
    label: "Orders",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

const StatisticsCardData = {
  title: "Order",
  description: "Last week",
  children: (
    <>
      <ChartContainer className="h-21 w-full" config={orderChartConfig}>
        <BarChart
          accessibilityLayer
          barSize={12}
          data={orderChartData}
          margin={{
            left: -4,
            right: -6,
          }}
        >
          <Bar
            background={{
              fill: "color-mix(in oklab, var(--primary) 10%, transparent)",
              radius: 12,
            }}
            dataKey="orders"
            fill="var(--color-orders)"
            radius={12}
          />
          <ChartTooltip
            content={<ChartTooltipContent hideLabel />}
            cursor={false}
          />
        </BarChart>
      </ChartContainer>
    </>
  ),
  value: "124K",
  changePercentage: "+12.6%",
};

const StatisticsOrderCard = ({ className }: { className?: string }) => (
  <Card className={className}>
    <CardHeader>
      <CardTitle className="font-semibold text-lg">
        {StatisticsCardData.title}
      </CardTitle>
      <CardDescription className="text-base text-muted-foreground">
        {StatisticsCardData.description}
      </CardDescription>
    </CardHeader>
    <CardContent>{StatisticsCardData.children}</CardContent>

    <CardContent className="flex items-center justify-between">
      <span className="font-semibold text-xl">{StatisticsCardData.value}</span>
      <span className="text-base text-primary">
        {StatisticsCardData.changePercentage}
      </span>
    </CardContent>
  </Card>
);

export default StatisticsOrderCard;
