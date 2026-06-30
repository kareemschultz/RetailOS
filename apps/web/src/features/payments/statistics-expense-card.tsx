// Third-party Imports

// Component Imports
import { Badge } from "@RetailOS/ui/components/badge";
import { Card, CardContent } from "@RetailOS/ui/components/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@RetailOS/ui/components/chart";
import { Area, AreaChart } from "recharts";

// Expense chart data
const expenseChartData = [
  { date: "2024-06-14", expense: 290 },
  { date: "2024-06-15", expense: 360 },
  { date: "2024-06-16", expense: 360 },
  { date: "2024-06-17", expense: 360 },
  { date: "2024-06-18", expense: 400 },
  { date: "2024-06-19", expense: 550 },
  { date: "2024-06-20", expense: 590 },
  { date: "2024-06-21", expense: 500 },
  { date: "2024-06-22", expense: 450 },
  { date: "2024-06-23", expense: 460 },
  { date: "2024-06-24", expense: 400 },
  { date: "2024-06-25", expense: 350 },
  { date: "2024-06-26", expense: 320 },
  { date: "2024-06-27", expense: 300 },
];

const expenseChartConfig = {
  expense: {
    label: "Expense",
  },
} satisfies ChartConfig;

const StatisticsCardData = {
  title: "Expense this month",
  amount: "$4,120",
  changePercentage: "-12.2%",
  children: (
    <ChartContainer
      className="max-h-26.5 w-full max-w-70 flex-1 max-sm:max-w-35"
      config={expenseChartConfig}
    >
      <AreaChart
        data={expenseChartData}
        margin={{
          left: 4,
          right: 0,
        }}
      >
        <defs>
          <linearGradient id="fillExpense" x1="0" x2="0" y1="0" y2="1">
            <stop offset="10%" stopColor="var(--primary)" stopOpacity={1} />
            <stop offset="90%" stopColor="var(--primary)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <ChartTooltip
          content={<ChartTooltipContent hideLabel />}
          cursor={false}
        />
        <Area
          dataKey="expense"
          fill="url(#fillExpense)"
          stackId="a"
          stroke="var(--primary)"
          strokeWidth={2}
          type="natural"
        />
      </AreaChart>
    </ChartContainer>
  ),
};

const StatisticsExpenseCard = ({ className }: { className?: string }) => (
  <Card className={className}>
    <CardContent className="flex flex-1 items-center justify-between gap-4 pr-0">
      <div className="flex shrink-0 flex-col justify-between gap-6">
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-sm">
            {StatisticsCardData.title}
          </span>
          <span className="font-semibold text-3xl">
            {StatisticsCardData.amount}
          </span>
        </div>
        <div className="flex gap-3">
          <Badge className="h-6 rounded-sm bg-primary/10 px-3 py-1 text-primary">
            {StatisticsCardData.changePercentage}
          </Badge>
          <span className="text-muted-foreground">vs Last month</span>
        </div>
      </div>
      {StatisticsCardData.children}
    </CardContent>
  </Card>
);

export default StatisticsExpenseCard;
