// Type Imports

// Component Imports
import { Card, CardContent, CardHeader } from "@RetailOS/ui/components/card";
import type { ReactNode } from "react";

// Statistics card data type
interface StatisticsCardProps {
  changePercentage: string;
  className?: string;
  icon: ReactNode;
  title: string;
  value: string;
}

const StatisticsCard = ({
  icon,
  value,
  title,
  changePercentage,
  className,
}: StatisticsCardProps) => (
  <Card className={className}>
    <CardHeader className="flex items-center gap-2">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-primary">
        {icon}
      </div>
      <span className="text-2xl">{value}</span>
    </CardHeader>
    <CardContent className="flex flex-col gap-2">
      <span className="font-semibold text-base">{title}</span>
      <p className="space-x-2">
        <span>{changePercentage}</span>
        <span className="text-muted-foreground">than last week</span>
      </p>
    </CardContent>
  </Card>
);

export default StatisticsCard;
