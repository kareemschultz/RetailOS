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
import { CircleIcon, EllipsisVerticalIcon } from "lucide-react";
// Third-party Imports
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  XAxis,
  YAxis,
} from "recharts";

const listItems = ["Share", "Update", "Refresh"];

// Sales chart data
const salesChartData = [
  { sr: 1, service: "UI design", sales: 99, fill: "var(--chart-1)" },
  { sr: 2, service: "UX design", sales: 94, fill: "var(--chart-2)" },
  { sr: 3, service: "Music", sales: 80, fill: "var(--chart-3)" },
  { sr: 4, service: "Animation", sales: 68, fill: "var(--chart-4)" },
  { sr: 5, service: "React", sales: 52, fill: "var(--chart-5)" },
  { sr: 6, service: "SEO", sales: 45, fill: "var(--primary)" },
];

const salesChartConfig = {
  sales: {
    label: "Sales",
  },
} satisfies ChartConfig;

const ServicesBySalesCard = ({ className }: { className?: string }) => (
  <Card className={cn("gap-4", className)}>
    <CardHeader className="flex justify-between">
      <span className="font-semibold text-lg">Top Services by Sales</span>
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
    <CardContent className="grid grid-cols-1 gap-4 px-0 lg:grid-cols-2">
      <div className="p-6">
        <ChartContainer
          className="h-full min-h-60 w-full max-lg:max-h-70 lg:max-w-95"
          config={salesChartConfig}
        >
          <BarChart
            accessibilityLayer
            barSize={24}
            data={salesChartData}
            layout="vertical"
            margin={{ left: -35, right: 12 }}
          >
            <CartesianGrid
              horizontal={false}
              stroke="var(--border)"
              strokeDasharray="4"
            />
            <XAxis
              axisLine={false}
              dataKey="sales"
              domain={[0, 100]}
              tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
              tickFormatter={(value) => `${value}%`}
              tickLine={false}
              tickMargin={8}
              type="number"
            />
            <YAxis
              axisLine={false}
              dataKey="sr"
              tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
              tickLine={false}
              tickMargin={10}
              type="category"
            />
            <ChartTooltip
              content={<ChartTooltipContent hideLabel />}
              cursor={false}
            />
            <Bar dataKey="sales" radius={[0, 10, 10, 0]}>
              <LabelList
                className="text-sm"
                dataKey="service"
                fill="var(--primary-foreground)"
                position="middle"
              />
            </Bar>
          </BarChart>
        </ChartContainer>
      </div>
      <div className="grid grid-cols-2 gap-x-23 gap-y-12 px-8 max-lg:gap-x-8 lg:py-10">
        {salesChartData.map((service) => (
          <div className="flex gap-3 px-2" key={service.service}>
            <div className="flex size-4.5 items-center justify-center">
              <CircleIcon
                className="size-2.5"
                fill={service.fill}
                stroke={service.fill}
              />
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-muted-foreground text-sm">
                {service.service}
              </span>
              <span className="font-medium text-lg">{service.sales}%</span>
            </div>
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
);

export default ServicesBySalesCard;
