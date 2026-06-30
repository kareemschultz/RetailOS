// Third-party Imports

// Component Imports
import { Avatar, AvatarFallback } from "@RetailOS/ui/components/avatar";
import { Badge } from "@RetailOS/ui/components/badge";
import { Button } from "@RetailOS/ui/components/button";
import { Card, CardContent, CardHeader } from "@RetailOS/ui/components/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@RetailOS/ui/components/chart";
import { Separator } from "@RetailOS/ui/components/separator";
// Util Imports
import { cn } from "@RetailOS/ui/lib/utils";
import { GlobeIcon, StoreIcon, TrendingUpIcon } from "lucide-react";
import { Bar, ComposedChart, Line, XAxis } from "recharts";

const chartData = [
  { time: "09:00", uv: 88, pv: 88 },
  { time: "10:00", uv: 88, pv: 88 },
  { time: "11:00", uv: 144, pv: 144 },
  { time: "12:00", uv: 144, pv: 144 },
  { time: "13:00", uv: 109, pv: 109 },
  { time: "14:00", uv: 102, pv: 109 },
  { time: "15:00", uv: 62, pv: 62 },
  { time: "16:00", uv: 62, pv: 62 },
  { time: "17:00", uv: 128, pv: 144 },
  { time: "18:00", uv: 144, pv: 144 },
  { time: "19:00", uv: 183, pv: 200 },
  { time: "20:00", uv: 200, pv: 200 },
];

const totalEarningChartConfig = {
  uv: {
    label: "Online Store",
    color: "color-mix(in oklab, var(--chart-2) 10%, transparent)",
  },
  pv: {
    label: "Offline Store",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

const data = [
  {
    icon: <GlobeIcon className="size-4" />,
    platform: "Online Store",
    sales: "$20k",
    growth: "+12.6%",
  },
  {
    icon: <StoreIcon className="size-4" />,
    platform: "Offline Store",
    sales: "$20k",
    growth: "-4.2%",
  },
];

const TotalSalesCard = ({ className }: { className?: string }) => (
  <Card className={cn("justify-between gap-4", className)}>
    <CardHeader className="flex flex-col">
      <div className="flex w-full items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-base">
          <Avatar className="rounded-sm after:border-0">
            <AvatarFallback className="shrink-0 rounded-sm bg-chart-2/10 text-chart-2">
              <TrendingUpIcon className="size-4" />
            </AvatarFallback>
          </Avatar>
          <span>Total sales</span>
        </div>
        <Button size="xs" variant="outline">
          Details
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <span className="font-semibold text-2xl">$2,150.00</span>
        <Badge className="rounded-sm bg-primary/10 text-primary focus-visible:outline-none focus-visible:ring-primary/20 dark:focus-visible:ring-primary/40 [a&]:hover:bg-primary/5">
          +5%
        </Badge>
      </div>
    </CardHeader>
    <CardContent className="space-y-4">
      <Separator />

      <div className="space-y-1">
        {data.map((item, index) => (
          <div
            className="flex items-center justify-between gap-2 py-2"
            key={index}
          >
            <div className="flex items-center gap-2 text-muted-foreground">
              {item.icon}
              <span className="text-sm">{item.platform}</span>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">{item.sales}</span>
              <span>{item.growth}</span>
            </div>
          </div>
        ))}
      </div>

      <Separator />

      <ChartContainer className="h-40 w-full" config={totalEarningChartConfig}>
        <ComposedChart data={chartData} margin={{ top: 4, right: 6 }}>
          <ChartTooltip
            content={<ChartTooltipContent hideLabel />}
            cursor={false}
          />
          <XAxis
            axisLine={false}
            dataKey="time"
            minTickGap={15}
            tick={{ fontSize: 14, fill: "var(--muted-foreground)" }}
            tickLine={false}
            tickMargin={8}
          />
          <Bar barSize={16} dataKey="uv" fill="var(--color-uv)" radius={2} />
          <Line
            dataKey="pv"
            dot={false}
            stroke="var(--color-pv)"
            strokeWidth={3}
            type="linear"
          />
        </ComposedChart>
      </ChartContainer>
    </CardContent>
  </Card>
);

export default TotalSalesCard;
