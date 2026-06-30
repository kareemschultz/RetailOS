import { Button } from "@RetailOS/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@RetailOS/ui/components/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@RetailOS/ui/components/tabs";
import { PlusIcon } from "lucide-react";

const tileClass =
  "border-card-foreground/10 h-30 w-full rounded-md border bg-[repeating-linear-gradient(45deg,color-mix(in_oklab,var(--card-foreground)10%,transparent),color-mix(in_oklab,var(--card-foreground)10%,transparent)_1px,var(--card)_2px,var(--card)_15px)]";

function EmptyStateProject() {
  return (
    <Card className="w-full">
      <CardHeader className="gap-0">
        <CardTitle>Project</CardTitle>
        <CardDescription>
          View and analyze current stats about your business
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs className="gap-4" defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
          </TabsList>
          <TabsContent
            className="grid grid-cols-2 gap-4 max-sm:grid-cols-1 md:grid-cols-3"
            value="overview"
          >
            <div
              className={`${tileClass} max-md:col-span-full md:row-span-2 md:h-64`}
            />
            <div className={`${tileClass} md:col-span-2`} />
            <div className={tileClass} />
            <div className={`${tileClass} max-sm:hidden`} />
            <div className={`${tileClass} max-sm:hidden`} />
            <div className={`${tileClass} max-sm:hidden`} />
          </TabsContent>
          <TabsContent
            className="grid grid-cols-2 gap-4 max-sm:grid-cols-1 md:grid-cols-3"
            value="details"
          >
            <div className={tileClass} />
            <div className={tileClass} />
            <div className={`${tileClass} md:row-span-2 md:h-64`} />
            <div className={`${tileClass} max-sm:hidden md:col-span-2`} />
            <div className={`${tileClass} max-sm:hidden`} />
            <div
              className={`${tileClass} max-sm:hidden max-md:col-span-full`}
            />
          </TabsContent>
        </Tabs>
        <div className="relative">
          <div className="relative z-2 flex flex-col items-center justify-center">
            <p className="text-center font-medium">No reports created yet</p>
            <p className="text-center text-muted-foreground">
              Create a new report to visualize your data
            </p>
            <Button className="mt-4" size="sm">
              <PlusIcon /> New Project
            </Button>
          </div>
          <div className="absolute bottom-9 z-1 h-90 w-full rounded-b-xl bg-linear-to-t from-background to-transparent" />
        </div>
      </CardContent>
    </Card>
  );
}

export default EmptyStateProject;
