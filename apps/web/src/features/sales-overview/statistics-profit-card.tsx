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
import { CartesianGrid, Line, LineChart } from "recharts";

// Profit chart data
const profitChartData = [
  { month: "January", profit: 10 },
  { month: "February", profit: 75 },
  { month: "March", profit: 40 },
  { month: "April", profit: 100 },
  { month: "May", profit: 70 },
  { month: "June", profit: 110 },
];

const profitChartConfig = {
  profit: {
    label: "Profit",
  },
} satisfies ChartConfig;

const StatisticsCardData = {
  title: "Profit",
  description: "Last Month",
  children: (
    <>
      <ChartContainer className="h-21 w-full" config={profitChartConfig}>
        <LineChart
          accessibilityLayer
          data={profitChartData}
          margin={{
            left: 5,
            right: 5,
          }}
        >
          <CartesianGrid
            horizontal={false}
            stroke="var(--border)"
            strokeDasharray="4"
          />
          <ChartTooltip
            content={<ChartTooltipContent hideLabel />}
            cursor={false}
          />
          <Line
            activeDot={{ r: 3, fill: "var(--primary-foreground)" }}
            dataKey="profit"
            dot={{
              r: 3.5,
              fill: "var(--chart-2)",
            }}
            stroke="var(--chart-2)"
            strokeWidth={3}
            type="linear"
          />
        </LineChart>
      </ChartContainer>
    </>
  ),
  value: "624K",
  changePercentage: "+12.6%",
};

const StatisticsProfitCard = ({ className }: { className?: string }) => (
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

export default StatisticsProfitCard;
