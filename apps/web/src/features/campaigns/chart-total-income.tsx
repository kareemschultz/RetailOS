// Third-party Imports

// Component Imports
import { Avatar, AvatarFallback } from "@RetailOS/ui/components/avatar";
import { Button } from "@RetailOS/ui/components/button";
import { Card, CardContent, CardHeader } from "@RetailOS/ui/components/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@RetailOS/ui/components/chart";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@RetailOS/ui/components/dropdown-menu";
// Util Imports
import { cn } from "@RetailOS/ui/lib/utils";
import {
  CircleDollarSignIcon,
  CreditCardIcon,
  EllipsisVerticalIcon,
  WalletIcon,
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

const listItems = ["Share", "Update", "Refresh"];

// Income chart data
const totalIncomeChartData = [
  { day: "Monday", incomes: 3100 },
  { day: "Tuesday", incomes: 3100 },
  { day: "Wednesday", incomes: 5000 },
  { day: "Thursday", incomes: 5000 },
  { day: "Friday", incomes: 4000 },
  { day: "Saturday", incomes: 4000 },
  { day: "Sunday", incomes: 5920 },
];

const totalIncomeChartConfig = {
  incomes: {
    label: "Incomes",
  },
} satisfies ChartConfig;

const ReportData = [
  {
    icons: <WalletIcon className="size-6 stroke-[1.5] text-chart-2" />,
    title: "Income",
    amount: "$5,550",
  },
  {
    icons: <CreditCardIcon className="size-6 stroke-[1.5] text-chart-1" />,
    title: "Expense",
    amount: "$3,520",
  },
  {
    icons: (
      <CircleDollarSignIcon className="size-6 stroke-[1.5] text-chart-5" />
    ),
    title: "Profit",
    amount: "$2,350",
  },
];

const TotalIncomeCard = ({ className }: { className?: string }) => (
  <Card className={cn("grid gap-0 py-0 lg:grid-cols-3", className)}>
    <Card className="rounded-none shadow-none ring-0 max-lg:border-b lg:col-span-2 lg:border-r">
      <CardHeader className="flex justify-between">
        <div className="flex flex-col gap-1">
          <span className="font-semibold text-lg">Total Income</span>
          <span className="text-muted-foreground text-sm">
            Weekly report overview
          </span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                className="size-6 rounded-full text-muted-foreground"
                size="icon"
                variant="ghost"
              />
            }
          >
            <EllipsisVerticalIcon />
            <span className="sr-only">Menu</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuGroup>
              {listItems.map((item, index) => (
                <DropdownMenuItem key={index}>{item}</DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent>
        <ChartContainer
          className="max-h-80 min-h-48 w-full text-sm uppercase max-[400px]:max-w-73"
          config={totalIncomeChartConfig}
        >
          <AreaChart
            data={totalIncomeChartData}
            margin={{ left: -18, right: 12, top: 12, bottom: 0 }}
          >
            <defs>
              <linearGradient id="fillSales" x1="0" x2="0" y1="0" y2="1">
                <stop offset="20%" stopColor="var(--chart-2)" stopOpacity={1} />
                <stop offset="80%" stopColor="var(--chart-2)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              stroke="var(--border)"
              strokeDasharray="3"
              strokeWidth={2}
              vertical={false}
            />
            <XAxis
              axisLine={false}
              dataKey="day"
              tick={{ fill: "var(--muted-foreground)" }}
              tickFormatter={(value) => value.slice(0, 2)}
              tickLine={false}
              tickMargin={5.5}
            />
            <YAxis
              allowDataOverflow
              axisLine={false}
              domain={[1000, 6000]}
              tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
              tickFormatter={(value) => `$${value / 1000}k`}
              tickLine={false}
              tickMargin={8}
              ticks={[1000, 2000, 3000, 4000, 5000, 6000]}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  className="normal-case"
                  formatter={(value) => [
                    `$${((value as number) / 1000).toFixed(1)}k`,
                    " Income",
                  ]}
                  hideLabel
                />
              }
            />
            <Area
              dataKey="incomes"
              fill="url(#fillSales)"
              stackId="a"
              stroke="var(--chart-2)"
              strokeWidth={2}
              type="linear"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
    <Card className="flex flex-col gap-10 rounded-none shadow-none ring-0">
      <CardHeader className="flex justify-between">
        <div className="flex flex-col gap-1">
          <span className="font-semibold text-lg">Report</span>
          <span className="text-muted-foreground text-sm">Weekly activity</span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                className="size-6 rounded-full text-muted-foreground"
                size="icon"
                variant="ghost"
              />
            }
          >
            <EllipsisVerticalIcon />
            <span className="sr-only">Menu</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuGroup>
              {listItems.map((item, index) => (
                <DropdownMenuItem key={index}>{item}</DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent className="grow text-base">
        <div className="flex h-full flex-col gap-4">
          {ReportData.map((report, index) => (
            <div
              className="flex grow items-center justify-between gap-4 rounded-md bg-muted px-4 py-2"
              key={index}
            >
              <div className="flex items-center gap-4">
                <Avatar className="rounded-sm after:border-0" size="lg">
                  <AvatarFallback className="shrink-0 rounded-sm bg-card text-primary">
                    {report.icons}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium text-muted-foreground">
                    {report.title}
                  </span>
                  <span className="font-medium text-lg">{report.amount}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  </Card>
);

export default TotalIncomeCard;
