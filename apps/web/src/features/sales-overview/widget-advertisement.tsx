// Third-party Imports

// Component Imports
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarImage,
} from "@RetailOS/ui/components/avatar";
import { Badge } from "@RetailOS/ui/components/badge";
import { Button } from "@RetailOS/ui/components/button";
import { Card, CardContent, CardHeader } from "@RetailOS/ui/components/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@RetailOS/ui/components/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@RetailOS/ui/components/tooltip";
// Util Imports
import { cn } from "@RetailOS/ui/lib/utils";
import {
  EllipsisVerticalIcon,
  MessageSquareIcon,
  ThumbsUpIcon,
} from "lucide-react";

const listItems = ["Share", "Update", "Refresh"];

const avatars = [
  {
    src: "/images/avatars/avatar-3.webp",
    fallback: "OS",
    name: "Olivia Sparks",
  },
  {
    src: "/images/avatars/avatar-6.webp",
    fallback: "HL",
    name: "Howard Lloyd",
  },
  {
    src: "/images/avatars/avatar-5.webp",
    fallback: "HR",
    name: "Hallie Richards",
  },
  {
    src: "/images/avatars/avatar-16.webp",
    fallback: "JW",
    name: "Jenny Wilson",
  },
];

const AdvertisementCard = ({ className }: { className?: string }) => (
  <Card className={cn("justify-between", className)}>
    <CardHeader className="flex justify-between">
      <div className="flex items-center gap-4">
        <Avatar className="size-10.5 rounded-full">
          <AvatarImage
            alt="Hallie Richards"
            className="rounded-full"
            src="/images/avatars/avatar-1.webp"
          />
          <AvatarFallback className="text-xs">JW</AvatarFallback>
        </Avatar>
        <div className="flex flex-col gap-1">
          <span className="font-semibold text-lg">
            Design strategy master class
          </span>
          <span className="text-muted-foreground text-sm">
            07 Jun 2025 at 10:00 PM
          </span>
        </div>
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
    <div className="flex flex-col gap-9">
      <div className="relative">
        <img alt="background image" src="/images/widgets/image-6.webp" />
        <div className="absolute -bottom-7 left-5.5 flex flex-col items-center rounded-md bg-card px-4 py-2 shadow-xl">
          <span className="font-medium text-lg">12</span>
          <span className="text-muted-foreground">Dec</span>
        </div>
      </div>
      <CardContent className="space-y-2">
        <p className="text-base">
          How to improve you next design&apos;s strategy that works for user and
          business
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="h-6 rounded-sm bg-primary/10 px-3 py-1 text-primary">
            Technical
          </Badge>
          <Badge className="h-6 rounded-sm bg-primary/10 px-3 py-1 text-primary">
            User research
          </Badge>
          <Badge className="h-6 rounded-sm bg-primary/10 px-3 py-1 text-primary">
            Analytics
          </Badge>
        </div>
      </CardContent>
    </div>
    <CardContent className="flex items-center justify-between gap-2">
      <AvatarGroup className="-space-x-4 hover:space-x-1 **:data-[slot=avatar]:ring-2 **:data-[slot=avatar]:ring-background">
        {avatars.map((avatar, index) => (
          <Tooltip key={index}>
            <TooltipTrigger className="transition-all duration-300 ease-in-out">
              <Avatar className="ring-2 ring-background transition-all duration-300 ease-in-out">
                <AvatarImage alt={avatar.name} src={avatar.src} />
                <AvatarFallback>{avatar.fallback}</AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent>{avatar.name}</TooltipContent>
          </Tooltip>
        ))}
      </AvatarGroup>
      <Button>Join now</Button>
    </CardContent>
    <CardContent className="flex items-center gap-4">
      <div className="flex items-center gap-1">
        <ThumbsUpIcon className="size-4" />
        <span className="text-sm">56k</span>
      </div>
      <div className="flex items-center gap-1">
        <MessageSquareIcon className="size-4" />
        <span className="text-sm">2k</span>
      </div>
    </CardContent>
  </Card>
);

export default AdvertisementCard;
