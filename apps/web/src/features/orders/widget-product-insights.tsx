// Third-party Imports

// Component Imports
import { Card, CardContent, CardHeader } from "@RetailOS/ui/components/card";
import {
  type ChartConfig,
  ChartContainer,
} from "@RetailOS/ui/components/chart";
import { Separator } from "@RetailOS/ui/components/separator";
import { Bar, BarChart } from "recharts";

// Product reached data
const productReachChartData = [
  { month: "January", reached: 168 },
  { month: "February", reached: 305 },
  { month: "March", reached: 213 },
  { month: "April", reached: 330 },
  { month: "May", reached: 305 },
];

const productReachChartConfig = {
  reached: {
    label: "Reached",
    color: "var(--primary)",
  },
} satisfies ChartConfig;

// Order placed data
const orderPlacedChartData = [
  { month: "January", orders: 168 },
  { month: "February", orders: 305 },
  { month: "March", orders: 213 },
  { month: "April", orders: 330 },
  { month: "May", orders: 305 },
];

const orderPlacedChartConfig = {
  orders: {
    label: "Orders",
    color: "color-mix(in oklab, var(--primary) 10%, transparent)",
  },
} satisfies ChartConfig;

const ProductInsightsCard = ({ className }: { className?: string }) => (
  <Card className={className}>
    <CardHeader className="flex justify-between">
      <div className="flex flex-col gap-1">
        <span className="font-semibold text-lg">Product insight</span>
        <span className="text-muted-foreground text-sm">
          Published on 12 MAY 2025 - 6:10 PM
        </span>
      </div>
      <img
        alt="Product"
        className="w-20.5 rounded-md"
        height={82}
        src="/images/widgets/image-7.webp"
        width={82}
      />
    </CardHeader>
    <CardContent>
      <Separator />
    </CardContent>
    <CardContent className="space-y-4">
      <div className="flex items-center justify-between gap-1">
        <div className="flex flex-col gap-1">
          <span className="text-xs">Product reached</span>
          <span className="font-semibold text-2xl">21,153</span>
        </div>
        <ChartContainer
          className="min-h-13 max-w-18"
          config={productReachChartConfig}
        >
          <BarChart accessibilityLayer barSize={8} data={productReachChartData}>
            <Bar dataKey="reached" fill="var(--color-reached)" radius={2} />
          </BarChart>
        </ChartContainer>
      </div>

      <div className="flex items-center justify-between gap-1">
        <div className="flex flex-col gap-1">
          <span className="text-xs">Order placed </span>
          <span className="font-semibold text-2xl">2,123</span>
        </div>
        <ChartContainer
          className="min-h-13 max-w-18"
          config={orderPlacedChartConfig}
        >
          <BarChart accessibilityLayer barSize={8} data={orderPlacedChartData}>
            <Bar dataKey="orders" fill="var(--color-orders)" radius={2} />
          </BarChart>
        </ChartContainer>
      </div>
    </CardContent>
  </Card>
);

export default ProductInsightsCard;
