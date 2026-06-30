// Third-party Imports

// Component Imports
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
import { EllipsisVerticalIcon } from "lucide-react";
import { Bar, CartesianGrid, ComposedChart, Line, YAxis } from "recharts";

const listItems = ["Share", "Update", "Refresh"];

const data = [
  {
    name: "Page A",
    uv: 46_400,
    pv: 35_000,
  },
  {
    name: "Page B",
    uv: 69_230,
    pv: 62_000,
  },
  {
    name: "Page C",
    uv: 49_845,
    pv: 41_000,
  },
  {
    name: "Page D",
    uv: 90_000,
    pv: 80_000,
    fill: "var(--chart-2)",
  },
  {
    name: "Page E",
    uv: 83_100,
    pv: 64_000,
  },
  {
    name: "Page F",
    uv: 74_770,
    pv: 67_000,
  },
  {
    name: "Page G",
    uv: 47_770,
    pv: 40_000,
  },
  {
    name: "Page H",
    uv: 30_000,
    pv: 24_000,
  },
];

const totalEarningChartConfig = {
  uv: {
    label: "Sales",
    color: "color-mix(in oklab, var(--chart-2) 20%, var(--background))",
  },
  pv: {
    label: "Profit",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

const WeeklyOverviewCard = ({ className }: { className?: string }) => (
  <Card className={className}>
    <CardHeader className="flex justify-between">
      <span className="font-semibold text-lg">Weekly overview</span>
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
    <CardContent className="space-y-8">
      <ChartContainer
        className="min-h-35 w-full flex-1"
        config={totalEarningChartConfig}
      >
        <ComposedChart data={data} margin={{ left: -22, bottom: 10 }}>
          <CartesianGrid
            stroke="var(--border)"
            strokeDasharray="4"
            vertical={false}
          />
          <YAxis
            allowDataOverflow={false}
            axisLine={false}
            domain={[() => 0, () => 90_000]}
            includeHidden={false}
            scale="linear"
            tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
            tickFormatter={(value) => `${value / 1000}k`}
            tickLine={false}
            tickMargin={8}
            ticks={[0, 30_000, 60_000, 90_000]}
            type="number"
          />
          <ChartTooltip
            content={<ChartTooltipContent hideLabel />}
            cursor={false}
          />
          <Bar barSize={20} dataKey="uv" fill="var(--color-uv)" radius={12} />
          <Line
            dataKey="pv"
            stroke="var(--color-pv)"
            strokeWidth={3}
            type="linear"
          />
        </ComposedChart>
      </ChartContainer>
      <div className="flex flex-col items-stretch gap-4">
        <div className="flex items-center gap-3">
          <span className="font-medium text-2xl">80%</span>
          <span className="text-muted-foreground text-sm">
            Your sales performance is 60% Better compare to Last month
          </span>
        </div>

        <Button>Details</Button>
      </div>
    </CardContent>
  </Card>
);

export default WeeklyOverviewCard;
