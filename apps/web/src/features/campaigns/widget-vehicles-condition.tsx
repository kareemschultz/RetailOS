// Third-party Imports

// Component Imports
import { Badge } from "@RetailOS/ui/components/badge";
import { Button } from "@RetailOS/ui/components/button";
import { Card, CardContent, CardHeader } from "@RetailOS/ui/components/card";
import { CircularProgress } from "@RetailOS/ui/components/circular-progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@RetailOS/ui/components/dropdown-menu";
import { EllipsisVerticalIcon } from "lucide-react";

const listItems = ["Share", "Update", "Refresh"];

export type VehicleCondition = {
  condition: string;
  details: string;
  progressValue: number;
  changePercentage: string;
  progressClassName?: string;
};

type Props = {
  title: string;
  vehicleConditionData: VehicleCondition[];
  className?: string;
};

const VehiclesConditionCard = ({
  title,
  vehicleConditionData,
  className,
}: Props) => (
  <Card className={className}>
    <CardHeader className="flex items-center justify-between">
      <span className="font-semibold text-lg">{title}</span>
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
    <CardContent className="flex flex-1 flex-col justify-between gap-4">
      {vehicleConditionData.map((condition, index) => (
        <div className="flex items-center justify-between gap-2" key={index}>
          <div className="flex items-center justify-between gap-3">
            <CircularProgress
              className="stroke-border"
              labelClassName="text-xs"
              progressClassName={condition.progressClassName}
              showLabel
              size={52}
              strokeWidth={5}
              value={condition.progressValue}
            />
            <div className="flex flex-col gap-0.5">
              <span className="font-medium text-base">
                {condition.condition}
              </span>
              <span className="text-muted-foreground text-sm">
                {condition.details}
              </span>
            </div>
          </div>
          <Badge className="h-6 rounded-sm bg-primary/10 px-3 py-1 text-primary">
            {condition.changePercentage}
          </Badge>
        </div>
      ))}
    </CardContent>
  </Card>
);

export default VehiclesConditionCard;
