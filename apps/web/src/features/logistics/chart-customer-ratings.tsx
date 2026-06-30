// Third-party Imports

// Component Imports
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
import { Rating } from "@RetailOS/ui/components/rating";
import { EllipsisVerticalIcon, PlusIcon } from "lucide-react";
import { Line, LineChart, XAxis } from "recharts";

const listItems = ["Share", "Update", "Refresh"];

const chartData = [
  { month: "January", online: 0.5, offline: 1 },
  { month: "February", online: 2, offline: 3.5 },
  { month: "March", online: 1, offline: 1.5 },
  { month: "April", online: 4.5, offline: 4 },
  { month: "May", online: 3, offline: 0.5 },
  { month: "June", online: 1.5, offline: 1 },
  { month: "July", online: 5, offline: 0.5 },
];

const chartConfig = {
  online: {
    label: "Online",
    color: "var(--chart-2)",
  },
  offline: {
    label: "Offline",
    color: "color-mix(in oklab, var(--primary) 10%, transparent)",
  },
} satisfies ChartConfig;

// @ts-expect-error recharts custom dot has untyped props
const CustomDot = (props) => {
  const { cx, cy, index } = props;

  if (index !== chartData.length - 1) {
    return null;
  }

  return (
    <svg
      fill="none"
      height="16"
      viewBox="0 0 18 18"
      width="16"
      x={cx - 10}
      xmlns="http://www.w3.org/2000/svg"
      y={cy - 8}
    >
      <g filter="url(#filter0_d_16482_113925)">
        <path
          d="M2.3335 9C2.3335 4.58172 5.91522 1 10.3335 1C14.7518 1 18.3335 4.58172 18.3335 9C18.3335 13.4183 14.7518 17 10.3335 17C5.91522 17 2.3335 13.4183 2.3335 9Z"
          fill="var(--card)"
          shapeRendering="crispEdges"
        />
        <path
          d="M10.3335 1.5C14.4756 1.5 17.8335 4.85786 17.8335 9C17.8335 13.1421 14.4756 16.5 10.3335 16.5C6.19136 16.5 2.8335 13.1421 2.8335 9C2.8335 4.85786 6.19136 1.5 10.3335 1.5Z"
          shapeRendering="crispEdges"
          stroke="var(--chart-2)"
        />
        <circle cx="10.3335" cy="9" fill="var(--chart-2)" r="4" />
      </g>
      <defs>
        <filter
          colorInterpolationFilters="sRGB"
          filterUnits="userSpaceOnUse"
          height="20"
          id="filter0_d_16482_113925"
          width="20"
          x="0.333496"
          y="0"
        >
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feColorMatrix
            in="SourceAlpha"
            result="hardAlpha"
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
          />
          <feOffset dy="1" />
          <feGaussianBlur stdDeviation="1" />
          <feComposite in2="hardAlpha" operator="out" />
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.05 0"
          />
          <feBlend
            in2="BackgroundImageFix"
            mode="normal"
            result="effect1_dropShadow_16482_113925"
          />
          <feBlend
            in="SourceGraphic"
            in2="effect1_dropShadow_16482_113925"
            mode="normal"
            result="shape"
          />
        </filter>
      </defs>
    </svg>
  );
};

// @ts-expect-error recharts custom dot has untyped props
const CustomActiveDot = (props) => {
  const { cx, cy } = props;

  return (
    <svg
      fill="none"
      height="16"
      viewBox="0 0 18 18"
      width="16"
      x={cx - 10}
      xmlns="http://www.w3.org/2000/svg"
      y={cy - 8}
    >
      <g filter="url(#filter0_d_16482_113925)">
        <path
          d="M2.3335 9C2.3335 4.58172 5.91522 1 10.3335 1C14.7518 1 18.3335 4.58172 18.3335 9C18.3335 13.4183 14.7518 17 10.3335 17C5.91522 17 2.3335 13.4183 2.3335 9Z"
          fill="var(--card)"
          shapeRendering="crispEdges"
        />
        <path
          d="M10.3335 1.5C14.4756 1.5 17.8335 4.85786 17.8335 9C17.8335 13.1421 14.4756 16.5 10.3335 16.5C6.19136 16.5 2.8335 13.1421 2.8335 9C2.8335 4.85786 6.19136 1.5 10.3335 1.5Z"
          shapeRendering="crispEdges"
          stroke="var(--chart-2)"
        />
        <circle cx="10.3335" cy="9" fill="var(--chart-2)" r="4" />
      </g>
      <defs>
        <filter
          colorInterpolationFilters="sRGB"
          filterUnits="userSpaceOnUse"
          height="20"
          id="filter0_d_16482_113925"
          width="20"
          x="0.333496"
          y="0"
        >
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feColorMatrix
            in="SourceAlpha"
            result="hardAlpha"
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
          />
          <feOffset dy="1" />
          <feGaussianBlur stdDeviation="1" />
          <feComposite in2="hardAlpha" operator="out" />
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.05 0"
          />
          <feBlend
            in2="BackgroundImageFix"
            mode="normal"
            result="effect1_dropShadow_16482_113925"
          />
          <feBlend
            in="SourceGraphic"
            in2="effect1_dropShadow_16482_113925"
            mode="normal"
            result="shape"
          />
        </filter>
      </defs>
    </svg>
  );
};

const CustomerRatingsCard = ({ className }: { className?: string }) => (
  <Card className={className}>
    <CardHeader className="flex justify-between">
      <span className="font-semibold text-lg">Customer Ratings</span>
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
    <CardContent className="flex flex-1 flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-6">
          <span className="font-semibold text-3xl">4.5</span>
          <Rating
            precision={0.5}
            readOnly
            size={24}
            value={4.5}
            variant="yellow"
          />
        </div>
        <div className="flex items-center gap-6">
          <Badge className="h-6 rounded-sm bg-primary/10 px-3 py-1 text-primary focus-visible:outline-none focus-visible:ring-primary/20 dark:focus-visible:ring-primary/40 [a&]:hover:bg-primary/5">
            <PlusIcon />
            5.0
          </Badge>
          <span className="text-muted-foreground text-sm">
            Points from last month
          </span>
        </div>
      </div>

      <ChartContainer className="min-h-47.5 w-full flex-1" config={chartConfig}>
        <LineChart
          accessibilityLayer
          data={chartData}
          margin={{
            left: 15,
            right: 7,
            top: -75,
          }}
        >
          <XAxis
            axisLine={false}
            dataKey="month"
            tick={{ fontSize: 14, fill: "var(--muted-foreground)" }}
            tickFormatter={(value) => value.slice(0, 3)}
            tickLine={false}
            tickMargin={8}
          />
          <ChartTooltip content={<ChartTooltipContent />} cursor={false} />
          <Line
            activeDot={<CustomActiveDot />}
            dataKey="online"
            dot={<CustomDot />}
            stroke="var(--color-online)"
            strokeWidth={5}
            type="bump"
          />
          <Line
            activeDot={{
              fill: "color-mix(in oklab, var(--primary) 50%, transparent)",
              r: 5,
            }}
            dataKey="offline"
            dot={false}
            stroke="var(--color-offline)"
            strokeDasharray="12 12"
            strokeWidth={3}
            type="monotone"
          />
        </LineChart>
      </ChartContainer>
    </CardContent>
  </Card>
);

export default CustomerRatingsCard;
