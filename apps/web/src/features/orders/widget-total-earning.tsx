// Third-party Imports

// Component Imports
import { Avatar, AvatarFallback } from "@RetailOS/ui/components/avatar";
import { Button } from "@RetailOS/ui/components/button";
import { Card, CardContent } from "@RetailOS/ui/components/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@RetailOS/ui/components/dropdown-menu";
import { Progress } from "@RetailOS/ui/components/progress";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  EllipsisVerticalIcon,
} from "lucide-react";

const listItems = ["Share", "Update", "Refresh"];

interface Props {
  className?: string;
  comparisonText: string;
  earning: number;
  earningData: {
    img: string;
    platform: string;
    technologies: string;
    earnings: string;
    progressPercentage: number;
  }[];
  percentage: number;
  title: string;
  trend: "up" | "down";
}

const TotalEarningCard = ({
  earningData,
  title,
  earning,
  trend,
  percentage,
  comparisonText,
  className,
}: Props) => (
  <Card className={className}>
    <CardContent className="flex flex-col gap-6">
      <span className="flex items-center justify-between">
        <div className="font-semibold text-lg">{title}</div>
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
              {listItems.map((item) => (
                <DropdownMenuItem key={item}>{item}</DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </span>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-2xl">${earning}</span>
          <span className="flex items-center gap-1">
            {trend === "up" ? (
              <ChevronUpIcon className="size-4" />
            ) : (
              <ChevronDownIcon className="size-4" />
            )}
            <span className="text-sm">{percentage}%</span>
          </span>
        </div>
        <span className="text-muted-foreground text-sm">{comparisonText}</span>
      </div>
    </CardContent>
    <CardContent className="flex flex-1 flex-col gap-4">
      <div className="flex flex-1 flex-col justify-evenly gap-4">
        {earningData.map((earning) => (
          <div
            className="flex items-center justify-between gap-2.5"
            key={earning.platform}
          >
            <div className="flex items-center justify-between gap-2.5">
              <Avatar className="size-11 rounded-sm after:rounded-[inherit] after:border-0">
                <AvatarFallback className="shrink-0 rounded-sm bg-primary/10">
                  <img
                    alt={earning.platform}
                    className="size-6"
                    height={24}
                    src={earning.img}
                    width={24}
                  />
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col gap-1">
                <span className="font-medium text-base">
                  {earning.platform}
                </span>
                <span className="text-muted-foreground text-sm">
                  {earning.technologies}
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm">{earning.earnings}</p>
              <Progress
                className="w-36 **:data-[slot=progress-track]:h-1.5"
                value={earning.progressPercentage}
              />
            </div>
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
);

export default TotalEarningCard;
