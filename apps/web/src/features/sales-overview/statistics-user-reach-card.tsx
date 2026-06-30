// Third-party Imports

// Component Imports
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@RetailOS/ui/components/card";
import {
  type ChartConfig,
  ChartContainer,
} from "@RetailOS/ui/components/chart";
import {
  Label,
  PolarGrid,
  PolarRadiusAxis,
  RadialBar,
  RadialBarChart,
} from "recharts";

// User reach chart data
const userReachChartData = [{ visitors: 500, fill: "var(--color-visitors)" }];

const userReachChartConfig = {
  visitors: {
    label: "Visitors",
    color: "var(--chart-5)",
  },
} satisfies ChartConfig;

const StatisticsCardData = {
  title: "User reach",
  description: "Last week",
  children: (
    <>
      <ChartContainer className="h-21 w-full" config={userReachChartConfig}>
        <RadialBarChart
          data={userReachChartData}
          endAngle={250}
          innerRadius={43}
          outerRadius={32}
          startAngle={90}
        >
          <PolarGrid
            className="first:fill-primary/10 last:fill-card"
            gridType="circle"
            polarRadius={[42, 32]}
            radialLines={false}
            stroke="none"
          />
          <RadialBar dataKey="visitors" />
          <PolarRadiusAxis axisLine={false} tick={false} tickLine={false}>
            <Label
              content={({ viewBox }) => {
                if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                  return (
                    <text
                      dominantBaseline="middle"
                      textAnchor="middle"
                      x={viewBox.cx}
                      y={20}
                    >
                      <tspan
                        className="fill-foreground font-semibold text-base"
                        x={viewBox.cx}
                        y={(viewBox.cy || 0) - 8}
                      >
                        {userReachChartData[0].visitors.toLocaleString()}
                      </tspan>
                      <tspan
                        className="fill-muted-foreground text-xs"
                        x={viewBox.cx}
                        y={(viewBox.cy || 0) + 15}
                      >
                        Visitors
                      </tspan>
                    </text>
                  );
                }
              }}
            />
          </PolarRadiusAxis>
        </RadialBarChart>
      </ChartContainer>
    </>
  ),
  value: "32K",
  changePercentage: "+12%",
};

const StatisticsUserReachCard = ({ className }: { className?: string }) => (
  <Card className={className}>
    <CardHeader>
      <CardTitle className="font-semibold text-lg">
        {StatisticsCardData.title}
      </CardTitle>
      <CardDescription className="text-base text-muted-foreground">
        {StatisticsCardData.description}
      </CardDescription>
    </CardHeader>
    <CardContent>{StatisticsCardData.children}</CardContent>

    <CardContent className="flex items-center justify-between">
      <span className="font-semibold text-xl">{StatisticsCardData.value}</span>
      <span className="text-base text-primary">
        {StatisticsCardData.changePercentage}
      </span>
    </CardContent>
  </Card>
);

export default StatisticsUserReachCard;
