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
  ChevronUpIcon,
  DollarSignIcon,
  EllipsisVerticalIcon,
  ShoppingCartIcon,
} from "lucide-react";
import { Bar, BarChart } from "recharts";

const listItems = ["Share", "Update", "Refresh"];

// Earning chart data
const totalEarningChartData = [
  { name: "January", uv: -2120, pv: 2080, amt: 2210 },
  { name: "February", uv: -1720, pv: 1560, amt: 2290 },
  { name: "March", uv: -2841, pv: 2320, amt: 2210 },
  { name: "April", uv: -1720, pv: 2080, amt: 2500 },
  { name: "May", uv: -2200, pv: 1160, amt: 2100 },
  { name: "June", uv: -2200, pv: 2480, amt: 2100 },
  { name: "July", uv: -1200, pv: 2682, amt: 2100 },
  { name: "August", uv: -2200, pv: 960, amt: 2100 },
];

const totalEarningChartConfig = {
  pv: {
    label: "2025",
    color: "var(--chart-5)",
  },
  uv: {
    label: "2024",
    color: "var(--chart-3)",
  },
} satisfies ChartConfig;

const data = [
  {
    icon: <DollarSignIcon className="size-5" />,
    title: "Total revenue",
    status: "Successful payments",
    value: "+$250",
  },
  {
    icon: <ShoppingCartIcon className="size-5" />,
    title: "Total sales",
    status: "Refund",
    value: "+$80",
  },
];

const TotalEarningCard = ({ className }: { className?: string }) => (
  <Card className={cn("gap-4", className)}>
    <CardHeader className="flex justify-between">
      <div className="flex flex-col gap-4">
        <span className="font-semibold text-lg">Total earning</span>
        <div className="flex items-center gap-3">
          <span className="font-semibold text-4xl">87%</span>
          <div className="flex items-center gap-1">
            <ChevronUpIcon className="size-4" />
            <span className="text-sm">+38%</span>
          </div>
        </div>
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
    <CardContent className="flex flex-col justify-between gap-4">
      <ChartContainer
        className="min-h-37.5 w-full"
        config={totalEarningChartConfig}
      >
        <BarChart
          barSize={12}
          data={totalEarningChartData}
          margin={{ right: 0, left: 0 }}
          stackOffset="sign"
        >
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

      <div className="space-y-4">
        {data.map((earning, index) => (
          <div className="flex items-center justify-between gap-2" key={index}>
            <div className="flex items-center gap-3">
              <Avatar className="rounded-sm after:border-0" size="lg">
                <AvatarFallback className="shrink-0 rounded-sm bg-primary/10 text-primary">
                  {earning.icon}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col gap-0.5">
                <span className="font-medium text-lg">{earning.title}</span>
                <span className="text-muted-foreground text-sm">
                  {earning.status}
                </span>
              </div>
            </div>
            <span className="text-sm">{earning.value}</span>
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
);

export default TotalEarningCard;
