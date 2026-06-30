// Third-party Imports

// Component Imports
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarImage,
} from "@RetailOS/ui/components/avatar";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@RetailOS/ui/components/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@RetailOS/ui/components/tooltip";
import {
  ArrowDownIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  ChartColumnBigIcon,
  EllipsisVerticalIcon,
} from "lucide-react";
import { Area, AreaChart, Bar, BarChart, XAxis } from "recharts";

const listItems = ["Share", "Update", "Refresh"];

const avatars = [
  {
    src: "/images/avatars/avatar-3.webp",
    fallback: "OS",
    name: "Olivia Sparks",
  },
  {
    src: "/images/avatars/avatar-6.webp",
    fallback: "HL",
    name: "Howard Lloyd",
  },
  {
    src: "/images/avatars/avatar-5.webp",
    fallback: "HR",
    name: "Hallie Richards",
  },
  {
    src: "/images/avatars/avatar-16.webp",
    fallback: "JW",
    name: "Jenny Wilson",
  },
];

const physicalProductsChartData = [
  { month: "Jan", sales: 280 },
  { month: "Feb", sales: 400 },
  { month: "Mar", sales: 280 },
  { month: "Apr", sales: 590 },
  { month: "May", sales: 360 },
  { month: "Jun", sales: 460 },
  { month: "Jul", sales: 400 },
];

const physicalProductsChartConfig = {
  sales: {
    label: "Sales",
  },
} satisfies ChartConfig;

const dailySalesChartData = [
  { day: "Monday", sales: 120 },
  { day: "Tuesday", sales: 240 },
  { day: "Wednesday", sales: 190 },
  { day: "Thursday", sales: 270 },
  { day: "Friday", sales: 210 },
  { day: "Saturday", sales: 320 },
  { day: "Sunday", sales: 270 },
];

const dailySalesChartConfig = {
  sales: {
    label: "Sales",
  },
} satisfies ChartConfig;

const PerformanceCard = ({ className }: { className?: string }) => (
  <Card className={className}>
    <CardHeader className="flex justify-between">
      <div className="flex items-center gap-2">
        <ChartColumnBigIcon className="size-6" />
        <span className="font-semibold text-lg">Performance</span>
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
    <Tabs className="flex-1 gap-6" defaultValue="new-users">
      <TabsList
        className="w-full justify-start gap-0 border-b p-0"
        variant="line"
      >
        <TabsTrigger
          className="rounded-none border-0 group-data-[orientation=horizontal]/tabs:after:bottom-[-0.5px]"
          value="new-users"
        >
          New Users
        </TabsTrigger>
        <TabsTrigger
          className="rounded-none border-0 group-data-[orientation=horizontal]/tabs:after:bottom-[-0.5px]"
          value="online-sales"
        >
          Online Sales
        </TabsTrigger>
        <TabsTrigger
          className="rounded-none border-0 group-data-[orientation=horizontal]/tabs:after:bottom-[-0.5px]"
          value="daily-sales"
        >
          Daily Sales
        </TabsTrigger>
      </TabsList>

      <CardContent>
        <TabsContent
          className="flex flex-col justify-between gap-4 text-base"
          value="new-users"
        >
          <div className="flex items-center gap-4 rounded-xl border px-4 py-2">
            <Avatar className="size-10.5">
              <AvatarImage
                alt="Angel George"
                src="/images/avatars/avatar-5.webp"
              />
              <AvatarFallback className="text-xs">AG</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="text-muted-foreground">Product Manager</span>
              <span className="font-medium text-lg">Angel George</span>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border px-4 py-3">
            <Badge className="h-6 border-none bg-primary/10 px-3 py-1 text-primary focus-visible:outline-none focus-visible:ring-primary/20 dark:focus-visible:ring-primary/40 [a&]:hover:bg-primary/5">
              Daily purchase
            </Badge>
            <span className="font-medium text-xl">10 Items</span>
          </div>

          <div className="flex flex-col gap-4 rounded-xl border px-5 py-3.5">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground">Physical product</span>
                <span className="font-semibold text-xl">$78,263</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Avatar className="size-6.5 after:border-0">
                  <AvatarFallback className="shrink-0 bg-primary/10 text-primary">
                    <ArrowUpIcon className="size-4" />
                  </AvatarFallback>
                </Avatar>
                <span className="font-semibold text-xl">14.78%</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <AvatarGroup>
                {avatars.map((avatar, index) => (
                  <Tooltip key={index}>
                    <TooltipTrigger
                      render={
                        <Avatar className="ring-2 ring-background transition-all duration-300 ease-in-out hover:z-1 hover:-translate-y-1 hover:shadow-md" />
                      }
                    >
                      <AvatarImage alt={avatar.name} src={avatar.src} />
                      <AvatarFallback className="text-xs">
                        {avatar.fallback}
                      </AvatarFallback>
                    </TooltipTrigger>
                    <TooltipContent>{avatar.name}</TooltipContent>
                  </Tooltip>
                ))}
              </AvatarGroup>
              <Button
                className="bg-primary/10 text-primary hover:bg-primary/20 focus-visible:ring-primary/20 dark:focus-visible:ring-primary/40"
                size="sm"
              >
                View all
                <ArrowRightIcon />
              </Button>
            </div>
          </div>

          <p className="text-center">
            <span className="font-medium">Increase 24%</span>{" "}
            <span className="text-muted-foreground text-sm">
              More email marketing to reach your acquisition target.
            </span>
          </p>
        </TabsContent>

        <TabsContent
          className="flex flex-col justify-between gap-4 text-base"
          value="online-sales"
        >
          <div className="flex items-center justify-between rounded-xl border px-4 py-3">
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground">Digital product</span>
              <div className="flex items-center gap-2.5">
                <Avatar className="after:border-0" size="sm">
                  <AvatarFallback className="shrink-0 bg-primary/10 text-primary">
                    <ArrowUpIcon className="size-4" />
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium text-lg">7,589</span>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground">Physical product</span>
              <div className="flex items-center gap-2.5">
                <Avatar className="after:border-0" size="sm">
                  <AvatarFallback className="shrink-0 bg-primary/10 text-primary">
                    <ArrowDownIcon className="size-4" />
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium text-lg">8,365</span>
              </div>
            </div>
          </div>

          <div className="space-y-5 rounded-xl border py-4">
            <div className="flex items-center justify-between px-6">
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground">Physical product</span>
                <span className="font-semibold text-xl">$78,263</span>
              </div>
              <Badge className="rounded-sm border-none bg-primary/10 text-primary focus-visible:outline-none focus-visible:ring-primary/20 dark:focus-visible:ring-primary/40 [a&]:hover:bg-primary/5">
                <ArrowUpIcon className="size-4" />
                5.6%
              </Badge>
            </div>

            <ChartContainer
              className="h-30 w-full"
              config={physicalProductsChartConfig}
            >
              <AreaChart
                data={physicalProductsChartData}
                margin={{
                  left: 20,
                  right: 20,
                  top: 3,
                }}
              >
                <defs>
                  <linearGradient id="fillSales" x1="0" x2="0" y1="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="var(--chart-2)"
                      stopOpacity={0.4}
                    />
                    <stop
                      offset="90%"
                      stopColor="var(--chart-2)"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <XAxis
                  axisLine={false}
                  dataKey="month"
                  tick={{ fill: "var(--muted-foreground)" }}
                  tickFormatter={(value) => value.slice(0, 3)}
                  tickLine={false}
                  tickMargin={10}
                />
                <ChartTooltip
                  content={<ChartTooltipContent hideLabel />}
                  cursor={false}
                />
                <Area
                  dataKey="sales"
                  fill="url(#fillSales)"
                  stackId="a"
                  stroke="var(--chart-2)"
                  strokeWidth={3}
                  type="natural"
                />
              </AreaChart>
            </ChartContainer>
          </div>

          <p className="text-center">
            <span className="font-medium">18%</span>{" "}
            <span className="text-muted-foreground text-sm">
              until your Target this months
            </span>
          </p>
        </TabsContent>

        <TabsContent
          className="flex flex-col justify-between gap-4 text-base"
          value="daily-sales"
        >
          <div className="flex items-center justify-between rounded-xl border px-4 py-3">
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground">Digital product</span>
              <div className="flex items-center gap-2.5">
                <Avatar className="after:border-0" size="sm">
                  <AvatarFallback className="shrink-0 bg-primary/10 text-primary">
                    <ArrowUpIcon className="size-4" />
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium text-lg">8,365</span>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground">Physical product</span>
              <div className="flex items-center gap-2.5">
                <Avatar className="after:border-0" size="sm">
                  <AvatarFallback className="shrink-0 bg-primary/10 text-primary">
                    <ArrowDownIcon className="size-4" />
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium text-lg">7,589</span>
              </div>
            </div>
          </div>

          <div className="space-y-5 rounded-xl border py-4">
            <div className="flex items-center justify-between px-6">
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground">
                  Average daily sales
                </span>
                <span className="font-semibold text-xl">$8,263</span>
              </div>
              <Badge className="rounded-sm border-none bg-primary/10 text-primary focus-visible:outline-none focus-visible:ring-primary/20 dark:focus-visible:ring-primary/40 [a&]:hover:bg-primary/5">
                <ArrowDownIcon className="size-4" />
                3.4%
              </Badge>
            </div>

            <ChartContainer
              className="h-32.5 w-full px-1.5"
              config={dailySalesChartConfig}
            >
              <BarChart
                accessibilityLayer
                barSize={12}
                data={dailySalesChartData}
                margin={{
                  left: 0,
                  right: 0,
                }}
              >
                <Bar
                  background={{
                    fill: "color-mix(in oklab, var(--primary) 10%, transparent)",
                    radius: 12,
                  }}
                  dataKey="sales"
                  fill="var(--chart-1)"
                  radius={12}
                />
                <XAxis
                  axisLine={false}
                  dataKey="day"
                  tick={{ fill: "var(--muted-foreground)" }}
                  tickFormatter={(value) => value.slice(0, 3)}
                  tickLine={false}
                  tickMargin={10}
                />
                <ChartTooltip
                  content={<ChartTooltipContent hideLabel />}
                  cursor={false}
                />
              </BarChart>
            </ChartContainer>
          </div>

          <p className="text-center">
            <span className="font-medium">12%</span>{" "}
            <span className="text-muted-foreground text-sm">
              until your daily purchase target
            </span>
          </p>
        </TabsContent>
      </CardContent>
    </Tabs>
  </Card>
);

export default PerformanceCard;
