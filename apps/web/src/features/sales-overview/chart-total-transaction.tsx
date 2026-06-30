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
import { Separator } from "@RetailOS/ui/components/separator";
// Util Imports
import { cn } from "@RetailOS/ui/lib/utils";
import {
  CircleDollarSignIcon,
  EllipsisVerticalIcon,
  WalletIcon,
} from "lucide-react";
import { Bar, BarChart, LabelList, XAxis } from "recharts";

const listItems = ["Share", "Update", "Refresh"];

const transactionsChartData = [
  {
    month: "January",
    transaction: "38000",
    fill: "color-mix(in oklab, var(--chart-2) 20%, transparent)",
  },
  { month: "February", transaction: "52000", fill: "var(--chart-2)" },
  {
    month: "March",
    transaction: "32000",
    fill: "color-mix(in oklab, var(--chart-2) 20%, transparent)",
  },
  {
    month: "April",
    transaction: "12000",
    fill: "color-mix(in oklab, var(--chart-2) 20%, transparent)",
  },
  {
    month: "May",
    transaction: "35000",
    fill: "color-mix(in oklab, var(--chart-2) 20%, transparent)",
  },
  {
    month: "June",
    transaction: "28000",
    fill: "color-mix(in oklab, var(--chart-2) 20%, transparent)",
  },
  {
    month: "July",
    transaction: "33000",
    fill: "color-mix(in oklab, var(--chart-2) 20%, transparent)",
  },
  {
    month: "August",
    transaction: "25000",
    fill: "color-mix(in oklab, var(--chart-2) 20%, transparent)",
  },
];

const transactionsChartConfig = {
  transaction: {
    label: "Transaction",
  },
} satisfies ChartConfig;

const TotalTransactionCard = ({ className }: { className?: string }) => (
  <Card className={cn("grid grid-cols-1 gap-4 md:grid-cols-5", className)}>
    <div className="max-md:border-b md:col-span-3 md:border-r md:pr-4">
      <CardHeader className="flex justify-between">
        <div className="flex flex-col gap-1">
          <span className="font-semibold text-lg">Total Transaction</span>
          <span className="text-muted-foreground text-sm">Weekly overview</span>
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
      <CardContent className="max-md:pb-6">
        <ChartContainer
          className="h-83 w-full"
          config={transactionsChartConfig}
        >
          <BarChart
            accessibilityLayer
            barSize={35}
            data={transactionsChartData}
            margin={{
              top: 7,
            }}
          >
            <XAxis
              axisLine={false}
              dataKey="month"
              tick={{ fontSize: 14, fill: "var(--muted-foreground)" }}
              tickFormatter={(value) => value.slice(0, 3)}
              tickLine={false}
              tickMargin={5.5}
            />
            <ChartTooltip
              content={<ChartTooltipContent hideLabel />}
              cursor={false}
            />
            <Bar dataKey="transaction" radius={10}>
              <LabelList
                className="fill-card-foreground font-semibold"
                fontSize={16}
                formatter={(value: unknown) => `${String(value).slice(0, 2)}K`}
                offset={12}
                position="top"
              />
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </div>
    <div className="flex flex-col gap-8 md:col-span-2">
      <CardHeader className="flex justify-between">
        <div className="flex flex-col gap-1">
          <span className="font-semibold text-lg">Report</span>
          <span className="text-muted-foreground text-sm">
            Last month transactions $23.4K
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
      <CardContent className="flex flex-1 items-center text-base">
        <div className="flex flex-1 justify-around gap-1">
          <div className="flex flex-col items-center gap-4 p-2">
            <Avatar className="size-12 rounded-sm after:border-0">
              <AvatarFallback className="shrink-0 rounded-sm bg-chart-5/10 text-chart-5">
                <CircleDollarSignIcon className="size-6" />
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col items-center gap-1">
              <span className="text-muted-foreground">This week</span>
              <span className="font-medium text-2xl">+82.46%</span>
            </div>
          </div>
          <Separator className="h-[inherit]!" orientation="vertical" />
          <div className="flex flex-col items-center gap-4 p-2">
            <Avatar className="size-12 rounded-sm after:border-0">
              <AvatarFallback className="shrink-0 rounded-sm bg-chart-2/10 text-chart-2">
                <WalletIcon className="size-6" />
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col items-center gap-1">
              <span className="text-muted-foreground">This week</span>
              <span className="font-medium text-2xl">-24.8%</span>
            </div>
          </div>
        </div>
      </CardContent>
      <div className="px-6">
        <Separator />
      </div>
      <div className="flex items-center justify-between gap-2 px-6">
        <div className="flex flex-col gap-2">
          <span className="text-base text-muted-foreground">Performance</span>
          <span className="font-medium text-xl">+94.13%</span>
        </div>
        <Button nativeButton={false} render={<a href="#" />}>
          View Report
        </Button>
      </div>
    </div>
  </Card>
);

export default TotalTransactionCard;
