// React Imports

// Component Imports
import { Avatar, AvatarFallback } from "@RetailOS/ui/components/avatar";
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

type Props = {
  title: string;
  subTitle: string;
  campaignData: {
    icon: ReactElement;
    title: string;
    value: string;
    percentage: string;
    avatarClassName?: string;
  }[];
  className?: string;
};

const MonthlyCampaignCard = ({
  title,
  subTitle,
  campaignData,
  className,
}: Props) => (
  <Card className={className}>
    <CardHeader className="flex justify-between">
      <div className="flex flex-col gap-1">
        <span className="font-semibold text-lg">{title}</span>
        <span className="text-muted-foreground text-sm">{subTitle}</span>
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
    <CardContent className="flex flex-1 flex-col justify-between gap-4">
      {campaignData.map((campaign, index) => (
        <div className="flex items-center justify-between gap-2" key={index}>
          <div className="flex items-center justify-between gap-2">
            <Avatar className="rounded-sm after:border-0">
              <AvatarFallback
                className={cn(
                  "shrink-0 rounded-sm bg-primary/10 text-primary *:size-4",
                  campaign.avatarClassName
                )}
              >
                {campaign.icon}
              </AvatarFallback>
            </Avatar>
            <span className="font-medium text-base">{campaign.title}</span>
          </div>
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground">{campaign.value}</span>
            <span>{campaign.percentage}</span>
          </div>
        </div>
      ))}
    </CardContent>
  </Card>
);

export default MonthlyCampaignCard;
