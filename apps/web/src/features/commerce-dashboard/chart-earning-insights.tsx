// React Imports

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@RetailOS/ui/components/dropdown-menu";
import { Progress } from "@RetailOS/ui/components/progress";
// Util Imports
import { cn } from "@RetailOS/ui/lib/utils";
import { EllipsisVerticalIcon } from "lucide-react";
import type { ReactNode } from "react";
// Third-party Imports
import { Bar, BarChart, XAxis } from "recharts";

const listItems = ["Share", "Update", "Refresh"];

interface Props {
  changePercentage: number;
  chartData: {
    day: string;
    earning: number;
    fill: string;
  }[];
  className?: string;
  description: string;
  statData: {
    icon: ReactNode;
    title: string;
    amount: string;
    progress: number;
  }[];
  subTitle: string;
  title: string;
  totalEarning: string;
  trend: "up" | "down";
}

const earningReportChartConfig = {
  earning: {
    label: "Earning",
  },
} satisfies ChartConfig;

const EarningInsightsCard = ({
  title,
  subTitle,
  totalEarning,
  trend,
  changePercentage,
  description,
  chartData,
  statData,
  className,
}: Props) => (
  <Card className={cn("gap-4", className)}>
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
    <CardContent className="flex flex-col gap-4 text-base">
      <div className="grid gap-10 md:grid-cols-5">
        <div className="flex flex-col justify-center gap-3 md:col-span-2">
          <div className="flex items-center gap-4">
            <span className="font-medium text-6xl">{totalEarning}</span>
            <Badge className="h-6 rounded-sm bg-primary/10 px-3 py-1 text-primary focus-visible:outline-none focus-visible:ring-primary/20 dark:focus-visible:ring-primary/40 [a&]:hover:bg-primary/5">
              {trend === "up" ? "+" : "-"}
              {changePercentage}%
            </Badge>
          </div>
          <p className="text-muted-foreground text-xs">{description}</p>
        </div>
        <ChartContainer
          className="w-full text-sm sm:h-37.5 md:col-span-3 md:pl-6"
          config={earningReportChartConfig}
        >
          <BarChart
            accessibilityLayer
            barSize={24}
            data={chartData}
            margin={{
              left: -5,
              right: -5,
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
              content={<ChartTooltipContent hideLabel />}
              cursor={false}
            />
            <Bar dataKey="earning" radius={8} />
          </BarChart>
        </ChartContainer>
      </div>

      <Card className="shadow-none ring-foreground/10">
        <CardContent className="flex flex-wrap justify-between gap-6 text-base max-md:gap-5">
          {statData.map((data) => (
            <div className="flex flex-col gap-3" key={data.title}>
              <div className="flex items-center gap-2">
                <Avatar className="rounded-sm after:border-0">
                  <AvatarFallback className="shrink-0 rounded-sm bg-primary/10 text-primary *:size-4">
                    {data.icon}
                  </AvatarFallback>
                </Avatar>
                <span>{data.title}</span>
              </div>
              <span className="font-medium text-2xl">{data.amount}</span>
              <Progress
                className="w-37.5 *:data-[slot=progress-track]:h-1.5"
                value={data.progress}
              />
            </div>
          ))}
        </CardContent>
      </Card>
    </CardContent>
  </Card>
);

export default EarningInsightsCard;
