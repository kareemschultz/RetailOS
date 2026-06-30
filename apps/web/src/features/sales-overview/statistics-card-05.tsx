// Type Imports

// Component Imports
import { Avatar, AvatarFallback } from "@RetailOS/ui/components/avatar";
import { Badge } from "@RetailOS/ui/components/badge";
import { Card, CardContent, CardHeader } from "@RetailOS/ui/components/card";
// Util Imports
import { cn } from "@RetailOS/ui/lib/utils";
import type { ReactElement } from "react";

// Statistics card data type
type StatisticsCardProps = {
  icon: ReactElement;
  title: string;
  time: string;
  value: string;
  changePercentage: number;
  className?: string;
  iconClassName?: string;
};

const StatisticsCard = ({
  icon,
  title,
  time,
  value,
  changePercentage,
  className,
  iconClassName,
}: StatisticsCardProps) => (
  <Card className={cn("justify-between", className)}>
    <CardHeader>
      <Avatar className="rounded-sm after:border-0" size="lg">
        <AvatarFallback
          className={cn(
            "shrink-0 rounded-sm bg-primary/10 text-primary [&>svg]:size-5",
            iconClassName
          )}
        >
          {icon}
        </AvatarFallback>
      </Avatar>
    </CardHeader>
    <CardContent className="flex flex-1 flex-col justify-around gap-4">
      <p className="flex flex-col gap-1">
        <span className="font-semibold text-base">{title}</span>
        <span className="text-muted-foreground text-sm">{time}</span>
        <span className="font-medium text-base">{value}</span>
      </p>
      <Badge
        className={cn("rounded-sm", {
          "bg-green-600/10 text-green-600 dark:bg-green-400/10 dark:text-green-400":
            changePercentage > 0,
          "bg-destructive/10 text-destructive": changePercentage < 0,
        })}
      >
        {changePercentage > 0 ? "+" : ""}
        {changePercentage}%
      </Badge>
    </CardContent>
  </Card>
);

export default StatisticsCard;
