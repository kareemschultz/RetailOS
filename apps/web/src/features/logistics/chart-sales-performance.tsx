// Third-party Imports

// Component Imports
import { Avatar, AvatarFallback } from "@RetailOS/ui/components/avatar";
import { Badge } from "@RetailOS/ui/components/badge";
import { Button } from "@RetailOS/ui/components/button";
import { Card, CardContent, CardHeader } from "@RetailOS/ui/components/card";
import { Progress } from "@RetailOS/ui/components/progress";
import { Separator } from "@RetailOS/ui/components/separator";
// Util Imports
import { cn } from "@RetailOS/ui/lib/utils";
import { SparklesIcon } from "lucide-react";

interface Props {
  changePercentage: number;
  className?: string;
  salesData: {
    title: string;
    value: number;
    color: string;
  }[];
  title: string;
  value: string;
}

const SalesPerformanceCard = ({
  title,
  value,
  changePercentage,
  salesData,
  className,
}: Props) => {
  const getBadgeContent = (value: number): string => {
    if (value >= 90) {
      return "Excellent";
    }
    if (value >= 70) {
      return "Good";
    }
    if (value >= 50) {
      return "Average";
    }
    if (value >= 30) {
      return "Bad";
    }

    return "Poor";
  };

  return (
    <Card className={cn("gap-4", className)}>
      <CardHeader className="flex flex-col gap-2">
        <div className="flex w-full items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-base">
            <Avatar className="rounded-sm after:border-0">
              <AvatarFallback className="shrink-0 rounded-sm bg-primary/10 text-primary">
                <SparklesIcon className="size-4" />
              </AvatarFallback>
            </Avatar>
            <span>{title}</span>
          </div>
          <Button size="xs" variant="outline">
            Details
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-semibold text-2xl">{value}</span>
          <Badge className="rounded-sm bg-primary/10 text-primary focus-visible:outline-none focus-visible:ring-primary/20 dark:focus-visible:ring-primary/40 [a&]:hover:bg-primary/5">
            {changePercentage > 0 && "+"}
            {changePercentage}%
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <Separator />
        <div className="grid flex-1 grid-cols-2">
          {salesData.map((item, index) => {
            const totalBars = 10;
            const filledBars = Math.round((item.value / 100) * totalBars);

            return (
              <div className="flex flex-1 flex-col gap-2.5 p-2" key={index}>
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground text-sm">
                    {item.title}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-2xl">{item.value}</span>
                    <Badge className="h-6 rounded-sm bg-primary/10 px-3 py-1 text-primary focus-visible:outline-none focus-visible:ring-primary/20 dark:focus-visible:ring-primary/40 [a&]:hover:bg-primary/5">
                      {getBadgeContent(item.value)}
                    </Badge>
                  </div>
                </div>
                <div className="flex flex-1 flex-col justify-between gap-1.5">
                  {Array.from({ length: totalBars }, (_, index) => (
                    <Progress
                      className={cn(
                        "*:data-[slot=progress-track]:h-2 *:data-[slot=progress-track]:rounded-xs",
                        item.color
                      )}
                      key={index}
                      value={index >= totalBars - filledBars ? 100 : 0}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default SalesPerformanceCard;
