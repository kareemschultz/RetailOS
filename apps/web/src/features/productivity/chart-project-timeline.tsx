// Third-party Imports

// Component Imports
import { Avatar, AvatarFallback } from "@RetailOS/ui/components/avatar";
import { Button } from "@RetailOS/ui/components/button";
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
  ChartTooltip,
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
  CreditCardIcon,
  EllipsisVerticalIcon,
  LaptopMinimalIcon,
  PencilRulerIcon,
  SmartphoneIcon,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  XAxis,
  YAxis,
} from "recharts";

const listItems = ["Share", "Update", "Refresh"];

// Helper function to convert date to day number from start of year
const dateToDay = (dateString: string): number => {
  const date = new Date(dateString);
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const diffTime = date.getTime() - startOfYear.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
};

const projectTimelineChartData = [
  {
    name: "Caleb",
    startDate: "2025-01-01",
    endDate: "2025-05-15",
    project: "UI Design",
    fill: "var(--chart-2)",
  },
  {
    name: "Shaw",
    startDate: "2025-03-10",
    endDate: "2025-06-15",
    project: "UX Design",
    fill: "var(--chart-5)",
  },
  {
    name: "Jane",
    startDate: "2025-02-25",
    endDate: "2025-06-17",
    project: "Music",
    fill: "var(--chart-3)",
  },
  {
    name: "Blake",
    startDate: "2025-01-25",
    endDate: "2025-07-03",
    project: "Animation",
    fill: "var(--primary)",
  },
  {
    name: "Quinn",
    startDate: "2025-03-03",
    endDate: "2025-07-26",
    project: "Prototyping",
    fill: "var(--chart-1)",
  },
].map((item) => ({
  ...item,
  range: [dateToDay(item.startDate), dateToDay(item.endDate)],
}));

const projectTimelineChartConfig = {
  range: {
    label: "Timeline",
  },
} satisfies ChartConfig;

const data = [
  {
    icon: <SmartphoneIcon />,
    projectTitle: "IOS Application",
    tasks: "Task 840/2.5K",
    avatarClassName: "bg-chart-2/10 text-chart-2",
  },
  {
    icon: <LaptopMinimalIcon />,
    projectTitle: "Web Application",
    tasks: "Task 99/1.42K",
    avatarClassName: "bg-chart-5/10 text-chart-5",
  },
  {
    icon: <CreditCardIcon />,
    projectTitle: "Brand Dashboard",
    tasks: "Task 58/100",
    avatarClassName: "bg-chart-3/10 text-chart-3",
  },
  {
    icon: <PencilRulerIcon />,
    projectTitle: "UI Kit Design",
    tasks: "Task 120/350",
    avatarClassName: "bg-chart-1/10 text-chart-1",
  },
];

const ProjectTimelineCard = ({ className }: { className?: string }) => (
  <Card className={cn("grid gap-0 py-0 lg:grid-cols-3", className)}>
    <Card className="gap-4 rounded-none shadow-none ring-0 max-lg:border-b lg:col-span-2 lg:border-r">
      <CardHeader>
        <CardTitle className="font-semibold text-lg">
          Project Timeline
        </CardTitle>
        <CardDescription>Total 840 Task Completed</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1">
        <ChartContainer
          className="max-h-80 w-full flex-1 max-[400px]:h-60 max-[400px]:max-w-71"
          config={projectTimelineChartConfig}
        >
          <BarChart
            accessibilityLayer
            barSize={22}
            data={projectTimelineChartData}
            layout="vertical"
            margin={{
              left: -10,
              right: 2,
            }}
          >
            <CartesianGrid
              horizontal={false}
              stroke="var(--border)"
              strokeDasharray="6"
              strokeWidth={1}
            />
            <XAxis
              axisLine={false}
              domain={[0, 210]}
              tick={{ fill: "var(--muted-foreground)" }}
              tickFormatter={(value) => {
                if (value === 0) {
                  return "Jan";
                }
                if (value === 30) {
                  return "Feb";
                }
                if (value === 60) {
                  return "Mar";
                }
                if (value === 90) {
                  return "Apr";
                }
                if (value === 120) {
                  return "May";
                }
                if (value === 150) {
                  return "Jun";
                }
                if (value === 180) {
                  return "Jul";
                }
                if (value === 210) {
                  return "Aug";
                }

                return "";
              }}
              tickLine={false}
              ticks={[0, 30, 60, 90, 120, 150, 180, 210]}
              type="number"
            />
            <YAxis
              axisLine={false}
              dataKey="name"
              tick={{ fill: "var(--muted-foreground)" }}
              tickLine={false}
              tickMargin={10}
              type="category"
            />
            <ChartTooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;

                  return (
                    <div className="rounded-md border bg-background p-3 shadow-lg">
                      <p className="font-medium">{data.project}</p>
                      <p className="text-muted-foreground text-sm">
                        {data.name}
                      </p>
                      <p className="text-sm">
                        {new Date(data.startDate).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}{" "}
                        -{" "}
                        {new Date(data.endDate).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                  );
                }

                return null;
              }}
              cursor={false}
            />
            <Bar dataKey="range" radius={12}>
              <LabelList
                dataKey="project"
                fill="var(--primary-foreground)"
                position="inside"
              />
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
    <Card className="gap-8 rounded-none shadow-none ring-0">
      <CardHeader className="flex justify-between">
        <div className="flex flex-col gap-1">
          <CardTitle className="font-semibold text-lg">Project List</CardTitle>
          <CardDescription className="text-muted-foreground">
            4 ongoing project
          </CardDescription>
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
      <CardContent className="grow">
        <div className="flex h-full flex-col justify-between gap-6">
          {data.map((project, index) => (
            <div className="flex items-center gap-3" key={index}>
              <Avatar className="rounded-sm after:border-0">
                <AvatarFallback
                  className={cn(
                    "shrink-0 rounded-sm bg-primary/10 text-primary [&>svg]:size-4",
                    project.avatarClassName
                  )}
                >
                  {project.icon}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col gap-1">
                <span className="text-sm">{project.projectTitle}</span>
                <span className="text-muted-foreground text-xs">
                  {project.tasks}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  </Card>
);

export default ProjectTimelineCard;
