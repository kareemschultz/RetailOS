// React Imports

// Component Imports
import { Button } from "@RetailOS/ui/components/button";
import { Card, CardContent, CardHeader } from "@RetailOS/ui/components/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@RetailOS/ui/components/dropdown-menu";
// Util Imports
import { cn } from "@RetailOS/ui/lib/utils";
// Third-party Imports
import { EllipsisVerticalIcon } from "lucide-react";
import type { ReactElement } from "react";

const listItems = ["Share", "Update", "Refresh"];

interface Props {
  className?: string;
  title: string;
  vehicleData: {
    status: string;
    percentage: number;
    time: string;
    icon: ReactElement;
    width: string;
    colors: string;
  }[];
}

const VehicleOverviewCard = ({ title, vehicleData, className }: Props) => (
  <Card className={className}>
    <CardHeader className="flex justify-between border-b">
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
    <CardContent className="flex text-muted-foreground text-sm">
      {vehicleData.map((item, index) => (
        <div className={cn("flex flex-col gap-1", item.width)} key={index}>
          <span>{item.status}</span>
          <div className="h-2.5 w-0.5 rounded-full bg-muted-foreground" />
        </div>
      ))}
    </CardContent>
    <CardContent>
      <div className="flex overflow-hidden rounded-md">
        {vehicleData.map((item, index) => (
          <div
            className={cn("p-3 text-base", item.colors, item.width)}
            key={index}
          >
            <span>{item.percentage}%</span>
          </div>
        ))}
      </div>
    </CardContent>
    <CardContent>
      {vehicleData.map((item, index) => (
        <div
          className={cn(
            "flex items-center justify-between gap-4 px-2 py-3 text-base",
            index !== vehicleData.length - 1 && "border-b"
          )}
          key={index}
        >
          <div className="flex items-center gap-4 text-muted-foreground [&>svg]:size-4">
            {item.icon}
            <span>{item.status}</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="font-medium">{item.time}</span>
            <span className="text-muted-foreground text-sm">
              {item.percentage}%
            </span>
          </div>
        </div>
      ))}
    </CardContent>
  </Card>
);

export default VehicleOverviewCard;
