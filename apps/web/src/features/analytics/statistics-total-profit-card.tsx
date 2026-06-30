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
// Util Imports
import { cn } from "@RetailOS/ui/lib/utils";
// Third-party Imports
import { Bar, BarChart } from "recharts";

// Profit chart data
const profitChartData = [
  {
    name: "Page A",
    cy: -2120,
    py: 2080,
    amt: 2210,
  },
  {
    name: "Page B",
    cy: -1720,
    py: 1560,
    amt: 2290,
  },
  {
    name: "Page C",
    cy: -2200,
    py: 2480,
    amt: 2181,
  },
  {
    name: "Page D",
    cy: -1200,
    py: 2700,
    amt: 2500,
  },
  {
    name: "Page E",
    cy: -2200,
    py: 960,
    amt: 2100,
  },
];

const profitChartConfig = {
  cy: {
    label: "Cy",
    color: "var(--chart-4)",
  },
  py: {
    label: "Py",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

const StatisticsCardData = {
  title: "$88.5k",
  description: "Total Profit",
  children: (
    <>
      <ChartContainer className="h-31 w-full" config={profitChartConfig}>
        <BarChart
          barSize={12}
          data={profitChartData}
          height={300}
          margin={{
            right: -8,
            left: -7,
          }}
          stackOffset="sign"
          width={500}
        >
          <ChartTooltip
            content={<ChartTooltipContent hideLabel />}
            cursor={false}
          />
          <Bar
            dataKey="py"
            fill="var(--color-py)"
            radius={[12, 12, 0, 0]}
            stackId="stack"
          />
          <Bar
            dataKey="cy"
            fill="var(--color-cy)"
            radius={[12, 12, 0, 0]}
            stackId="stack"
          />
        </BarChart>
      </ChartContainer>
    </>
  ),
  changePercentage: "-18%",
};

const StatisticsTotalProfitCard = ({ className }: { className?: string }) => (
  <Card className={cn("justify-between", className)}>
    <CardHeader>
      <div className="flex items-center gap-2">
        <CardTitle className="font-semibold text-lg">
          {StatisticsCardData.title}
        </CardTitle>
        <span className="text-base">{StatisticsCardData.changePercentage}</span>
      </div>
      <CardDescription className="text-base text-muted-foreground">
        {StatisticsCardData.description}
      </CardDescription>
    </CardHeader>
    <CardContent>{StatisticsCardData.children}</CardContent>
  </Card>
);

export default StatisticsTotalProfitCard;
