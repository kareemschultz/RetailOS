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
// Util Imports
import { cn } from "@RetailOS/ui/lib/utils";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  EllipsisVerticalIcon,
} from "lucide-react";
// Third-party Imports
import { Area, AreaChart } from "recharts";

const listItems = ["Share", "Update", "Refresh"];

interface Props {
  chartData: {
    month: string;
    conversion: number;
  }[];
  className?: string;
  conversionData: {
    title: string;
    stat: string;
    trend: string;
    percentageChange: number;
  }[];
  conversionTrend: "up" | "down";
  percentageChange: number;
  subTitle: string;
  title: string;
  totalConversion: number;
}

const conversionRateChartConfig = {
  conversion: {
    label: "Conversion",
  },
} satisfies ChartConfig;

const ConversionRateCard = ({
  title,
  subTitle,
  totalConversion,
  conversionTrend,
  percentageChange,
  conversionData,
  chartData,
  className,
}: Props) => (
  <Card className={cn("gap-4 text-base", className)}>
    <CardHeader className="flex justify-between">
      <div className="flex flex-col gap-1">
        <span className="font-semibold text-lg">{title}</span>
        <span className="text-muted-foreground text-sm">{subTitle}</span>
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
            {listItems.map((item) => (
              <DropdownMenuItem key={item}>{item}</DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </CardHeader>
    <CardContent className="flex flex-1 flex-col justify-between gap-4">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-3xl">{totalConversion}%</span>
          <div className="flex items-center gap-1">
            {conversionTrend === "up" ? (
              <ChevronUpIcon className="size-4" />
            ) : (
              <ChevronDownIcon className="size-4" />
            )}
            <span className="text-sm">{percentageChange}%</span>
          </div>
        </div>
        <ChartContainer
          className="h-20 w-full"
          config={conversionRateChartConfig}
        >
          <AreaChart
            data={chartData}
            margin={{
              left: 4,
              right: 4,
            }}
          >
            <defs>
              <linearGradient id="fillSales" x1="0" x2="0" y1="0" y2="1">
                <stop
                  offset="10%"
                  stopColor="var(--chart-2)"
                  stopOpacity={0.3}
                />
                <stop offset="90%" stopColor="var(--chart-2)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <ChartTooltip
              content={<ChartTooltipContent hideLabel />}
              cursor={false}
            />
            <Area
              dataKey="conversion"
              fill="url(#fillSales)"
              stackId="a"
              stroke="var(--chart-2)"
              strokeWidth={2}
              type="natural"
            />
          </AreaChart>
        </ChartContainer>
      </div>

      {conversionData.map((campaign) => (
        <div className="grid grid-cols-5 gap-2" key={campaign.title}>
          <div className="col-span-4 flex flex-col gap-0.5">
            <span className="font-medium">{campaign.title}</span>
            <span className="text-muted-foreground text-sm">
              {campaign.stat}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            {campaign.trend === "up" ? (
              <ArrowUpIcon className="size-4" />
            ) : (
              <ArrowDownIcon className="size-4" />
            )}
            <span className="text-sm">{campaign.percentageChange}%</span>
          </div>
        </div>
      ))}
    </CardContent>
  </Card>
);

export default ConversionRateCard;
