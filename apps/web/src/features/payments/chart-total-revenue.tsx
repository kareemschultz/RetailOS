// Third-party Imports

// Component Imports
import { Avatar, AvatarFallback } from "@RetailOS/ui/components/avatar";
import { Button } from "@RetailOS/ui/components/button";
import { Card, CardContent, CardHeader } from "@RetailOS/ui/components/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@RetailOS/ui/components/select";
// Util Imports
import { cn } from "@RetailOS/ui/lib/utils";
import {
  CircleDollarSignIcon,
  EllipsisVerticalIcon,
  WalletIcon,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Label,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";

const listItems = ["Share", "Update", "Refresh"];

const totalEarningChartData = [
  {
    name: "January",
    uv: -13,
    pv: 21,
    amt: 2210,
  },
  {
    name: "February",
    uv: -16,
    pv: 10,
    amt: 2290,
  },
  {
    name: "March",
    uv: -14,
    pv: 13,
    amt: 2210,
  },
  {
    name: "April",
    uv: -10,
    pv: 12,
    amt: 2500,
  },
  {
    name: "May",
    uv: -17,
    pv: 20,
    amt: 2100,
  },
  {
    name: "June",
    uv: -13,
    pv: 12,
    amt: 2100,
  },
  {
    name: "July",
    uv: -12,
    pv: 15,
    amt: 2100,
  },
];

const totalEarningChartConfig = {
  uv: {
    label: "2023",
    color: "color-mix(in oklab, var(--primary) 20%, var(--background))",
  },
  pv: {
    label: "2024",
    color: "var(--primary)",
  },
} satisfies ChartConfig;

const growthChartData = [
  { date: "2023-11-30", revenue: 20, fill: "var(--primary)" },
  { date: "2023-12-12", revenue: 20, fill: "var(--primary)" },
  { date: "2023-11-20", revenue: 20, fill: "var(--primary)" },
  { date: "2023-12-12", revenue: 20, fill: "var(--primary)" },
  { date: "2023-12-12", revenue: 20, fill: "var(--primary)" },
  {
    date: "2023-12-12",
    revenue: 20,
    fill: "color-mix(in oklab, var(--primary) 90%, var(--background))",
  },
  {
    date: "2023-12-12",
    revenue: 20,
    fill: "color-mix(in oklab, var(--primary) 90%, var(--background))",
  },
  {
    date: "2023-12-12",
    revenue: 20,
    fill: "color-mix(in oklab, var(--primary) 80%, var(--background))",
  },
  {
    date: "2023-12-12",
    revenue: 20,
    fill: "color-mix(in oklab, var(--primary) 80%, var(--background))",
  },
  {
    date: "2023-12-12",
    revenue: 20,
    fill: "color-mix(in oklab, var(--primary) 70%, var(--background))",
  },
  {
    date: "2023-12-12",
    revenue: 20,
    fill: "color-mix(in oklab, var(--primary) 70%, var(--background))",
  },
  {
    date: "2023-12-12",
    revenue: 20,
    fill: "color-mix(in oklab, var(--primary) 60%, var(--background))",
  },
  {
    date: "2023-12-12",
    revenue: 20,
    fill: "color-mix(in oklab, var(--primary) 60%, var(--background))",
  },
  {
    date: "2023-12-12",
    revenue: 20,
    fill: "color-mix(in oklab, var(--primary) 50%, var(--background))",
  },
  {
    date: "2023-12-12",
    revenue: 20,
    fill: "color-mix(in oklab, var(--primary) 50%, var(--background))",
  },
  {
    date: "2023-12-12",
    revenue: 20,
    fill: "color-mix(in oklab, var(--primary) 40%, var(--background))",
  },
  {
    date: "2023-12-12",
    revenue: 20,
    fill: "color-mix(in oklab, var(--primary) 40%, var(--background))",
  },
  {
    date: "2023-12-12",
    revenue: 20,
    fill: "color-mix(in oklab, var(--primary) 30%, var(--background))",
  },
  {
    date: "2023-12-12",
    revenue: 20,
    fill: "color-mix(in oklab, var(--primary) 30%, var(--background))",
  },
  {
    date: "2023-12-12",
    revenue: 20,
    fill: "color-mix(in oklab, var(--primary) 20%, var(--background))",
  },
  {
    date: "2023-12-12",
    revenue: 20,
    fill: "color-mix(in oklab, var(--primary) 20%, var(--background))",
  },
  {
    date: "2023-12-12",
    revenue: 20,
    fill: "color-mix(in oklab, var(--primary) 10%, var(--background))",
  },
  {
    date: "2023-12-12",
    revenue: 20,
    fill: "color-mix(in oklab, var(--primary) 10%, var(--background))",
  },
  {
    date: "2023-12-12",
    revenue: 20,
    fill: "color-mix(in oklab, var(--primary) 5%, var(--background))",
  },
  {
    date: "2023-12-12",
    revenue: 20,
    fill: "color-mix(in oklab, var(--primary) 5%, var(--background))",
  },
];

const growthChartConfig = {
  revenue: {
    label: "Revenue",
  },
} satisfies ChartConfig;

const data = [
  {
    icon: <CircleDollarSignIcon className="size-5" />,
    year: "2024",
    amount: "$32.5K",
  },
  {
    icon: <WalletIcon className="size-5" />,
    year: "2023",
    amount: "$41.2K",
  },
];

const selectItems = [
  { label: "Revenue", value: "revenue" },
  { label: "Expenses", value: "expenses" },
  { label: "Profit", value: "profit" },
  { label: "Loss", value: "loss" },
  { label: "Net Income", value: "net_income" },
];

const TotalRevenueCard = ({ className }: { className?: string }) => (
  <Card className={cn("grid lg:grid-cols-5", className)}>
    <div className="flex flex-col gap-4 max-lg:border-b max-lg:pb-6 lg:col-span-3 lg:border-r">
      <CardHeader className="flex justify-between">
        <span className="font-semibold text-lg">Total Revenue</span>
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
      <CardContent className="flex-1 max-[475px]:mx-auto">
        <ChartContainer
          className="h-full min-h-55 w-full max-[475px]:max-w-73 lg:min-h-75"
          config={totalEarningChartConfig}
        >
          <BarChart
            barSize={12}
            data={totalEarningChartData}
            margin={{
              left: -25,
            }}
            stackOffset="sign"
          >
            <CartesianGrid
              stroke="var(--border)"
              strokeDasharray="6"
              vertical={false}
            />
            <XAxis
              axisLine={false}
              dataKey="name"
              tick={{ fontSize: "14", fill: "var(--muted-foreground)" }}
              tickFormatter={(value) => value.slice(0, 3)}
              tickLine={false}
              tickMargin={10}
            />
            <YAxis
              axisLine={false}
              domain={[-20, 30]}
              tick={{ fontSize: "14", fill: "var(--muted-foreground)" }}
              tickFormatter={(value) => value}
              tickLine={false}
              tickMargin={8}
              ticks={[-20, -10, 0, 10, 20, 30]}
            />
            <ChartLegend
              className="justify-start px-6 pb-6 text-muted-foreground text-sm [&_div>div]:rounded-full"
              content={<ChartLegendContent />}
              verticalAlign="top"
            />
            <ChartTooltip
              content={<ChartTooltipContent hideLabel />}
              cursor={false}
            />
            <Bar
              dataKey="pv"
              fill="var(--color-pv)"
              radius={[12, 12, 0, 0]}
              stackId="stack"
            />
            <Bar
              dataKey="uv"
              fill="var(--color-uv)"
              radius={[12, 12, 0, 0]}
              stackId="stack"
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </div>
    <div className="flex flex-col justify-between gap-8 lg:col-span-2">
      <CardHeader className="lg:pl-0">
        <Select items={selectItems}>
          <SelectTrigger className="w-full [&>svg]:opacity-100" size="sm">
            <SelectValue placeholder="Report" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {selectItems.map((item, index) => (
                <SelectItem key={index} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="space-y-8 lg:pl-0">
        <div className="space-y-8 pt-6 text-center">
          <ChartContainer
            className="h-40 w-full sm:h-45"
            config={growthChartConfig}
          >
            <PieChart margin={{ top: 0, bottom: -20 }}>
              <Pie
                data={growthChartData}
                dataKey="revenue"
                endAngle={220}
                innerRadius={60}
                nameKey="date"
                outerRadius={85}
                paddingAngle={5}
                startAngle={0}
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
                            className="fill-card-foreground font-semibold text-2xl"
                            x={viewBox.cx}
                            y={(viewBox.cy || 0) + 3}
                          >
                            78%
                          </tspan>
                          <tspan
                            className="fill-muted-foreground text-sm"
                            x={viewBox.cx}
                            y={(viewBox.cy || 0) + 24}
                          >
                            Growth
                          </tspan>
                        </text>
                      );
                    }
                  }}
                />
              </Pie>
            </PieChart>
          </ChartContainer>

          <span className="text-muted-foreground text-sm">
            62% Company Growth
          </span>
        </div>

        <div className="flex items-center justify-between gap-4 md:max-lg:gap-0">
          {data.map((item, index) => (
            <div className="flex items-center gap-2 p-2" key={index}>
              <Avatar className="rounded-sm after:border-0" size="lg">
                <AvatarFallback className="shrink-0 rounded-sm bg-primary/10 text-primary">
                  {item.icon}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col gap-0.5">
                <span className="text-muted-foreground">{item.year}</span>
                <span className="font-medium text-base">{item.amount}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </div>
  </Card>
);

export default TotalRevenueCard;
