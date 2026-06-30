// React Imports

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
  ChevronDownIcon,
  ChevronUpIcon,
  EllipsisVerticalIcon,
} from "lucide-react";
import type { ReactNode } from "react";
// Third-party Imports
import { Bar, BarChart, XAxis } from "recharts";

const listItems = ["Share", "Update", "Refresh"];

type Props = {
  title: string;
  subTitle: string;
  statData: {
    icon: ReactNode;
    title: string;
    department: string;
    value: string;
    trend: string;
    percentage: number;
    iconClassName?: string;
  }[];
  chartData: {
    day: string;
    earning: number;
    fill: string;
  }[];
  className?: string;
};

const earningReportChartConfig = {
  earning: {
    label: "Earning",
  },
} satisfies ChartConfig;

const EarningReportCard = ({
  title,
  subTitle,
  statData,
  chartData,
  className,
}: Props) => (
  <Card className={className}>
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
            {listItems.map((item, index) => (
              <DropdownMenuItem key={index}>{item}</DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </CardHeader>
    <CardContent className="flex flex-1 flex-col justify-between gap-6 text-base">
      <div className="flex flex-col gap-4">
        {statData.map((earning, index) => (
          <div className="flex items-center justify-between gap-2" key={index}>
            <div className="flex items-center justify-between gap-2">
              <Avatar className="rounded-sm after:border-0" size="lg">
                <AvatarFallback
                  className={cn(
                    "shrink-0 rounded-sm bg-primary/10 text-primary *:size-5",
                    earning.iconClassName
                  )}
                >
                  {earning.icon}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col gap-0.5">
                <span className="font-medium">{earning.title}</span>
                <span className="text-muted-foreground text-sm">
                  {earning.department}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">{earning.value}</span>
              <div className="flex items-center gap-1">
                {earning.trend === "up" ? (
                  <ChevronUpIcon className="size-4" />
                ) : (
                  <ChevronDownIcon className="size-4" />
                )}
                <span className="text-sm">{earning.percentage}%</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <ChartContainer
        className="h-45 w-full text-sm uppercase"
        config={earningReportChartConfig}
      >
        <BarChart
          accessibilityLayer
          barSize={36}
          data={chartData}
          margin={{
            top: 7,
            left: -4,
            right: -4,
          }}
        >
          <XAxis
            axisLine={false}
            dataKey="day"
            tick={{ fill: "var(--muted-foreground)" }}
            tickFormatter={(value) => value.slice(0, 2)}
            tickLine={false}
            tickMargin={5.5}
          />
          <ChartTooltip
            content={<ChartTooltipContent className="normal-case" hideLabel />}
          />
          <Bar dataKey="earning" radius={8} />
        </BarChart>
      </ChartContainer>
    </CardContent>
  </Card>
);

export default EarningReportCard;
