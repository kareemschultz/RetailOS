// Third-party Imports

// Component Imports
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@RetailOS/ui/components/avatar";
import { Button } from "@RetailOS/ui/components/button";
import { Card, CardContent, CardHeader } from "@RetailOS/ui/components/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@RetailOS/ui/components/dropdown-menu";
import { Progress } from "@RetailOS/ui/components/progress";
import { Separator } from "@RetailOS/ui/components/separator";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@RetailOS/ui/components/tabs";
import {
  EllipsisIcon,
  PackageIcon,
  PackageOpenIcon,
  TruckIcon,
} from "lucide-react";

const listItems = ["Share", "Update", "Refresh"];

const tabs = [
  {
    name: "Packed",
    value: "packed",
    icon: <PackageIcon />,
    contentData: [
      {
        label: "Packing Pending",
        value: 4250,
        progress: 80,
      },
      {
        label: "Packing in Progress",
        value: 2150,
        progress: 60,
      },
      {
        label: "Packing Complete",
        value: 1750,
        progress: 40,
      },
    ],
  },
  {
    name: "Shipped",
    value: "shipped",
    icon: <TruckIcon />,
    contentData: [
      {
        label: "Shipping Pending",
        value: 3250,
        progress: 70,
      },
      {
        label: "Shipping in Progress",
        value: 1150,
        progress: 50,
      },
      {
        label: "Shipping Complete",
        value: 950,
        progress: 30,
      },
    ],
  },
  {
    name: "Received",
    value: "received",
    icon: <PackageOpenIcon />,
    contentData: [
      {
        label: "Receiving Pending",
        value: 2250,
        progress: 80,
      },
      {
        label: "Receiving in Progress",
        value: 1150,
        progress: 50,
      },
      {
        label: "Receiving Complete",
        value: 950,
        progress: 30,
      },
    ],
  },
];

const UserOrderCard = ({ className }: { className?: string }) => (
  <Card className={className}>
    <CardHeader className="flex justify-between">
      <div className="flex items-center gap-2">
        <Avatar className="size-9.5 rounded-lg after:rounded-[inherit]">
          <AvatarImage
            alt="Hallie Richards"
            className="rounded-lg"
            src="/images/avatars/avatar-1.webp"
          />
          <AvatarFallback className="text-xs">JW</AvatarFallback>
        </Avatar>
        <div className="flex flex-col gap-1">
          <span className="font-medium text-xl">@jackwilliams</span>
          <span className="text-muted-foreground text-sm">Business</span>
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
          <EllipsisIcon />
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
    </CardHeader>
    <CardContent>
      <Separator />
    </CardContent>
    <CardContent className="flex flex-1 flex-col gap-6">
      <div className="flex flex-1 flex-col gap-2">
        <div className="flex items-baseline gap-1">
          <span className="font-medium text-2xl">4,689</span>
          <span className="text-muted-foreground text-sm">Orders</span>
        </div>
        <Tabs className="flex-1 justify-between gap-6" defaultValue="packed">
          <TabsList className="w-full">
            {tabs.map(({ icon, name, value }) => (
              <TabsTrigger
                className="flex items-center gap-1 px-1.5"
                key={value}
                value={value}
              >
                {icon}
                <span className="max-sm:hidden">{name}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {tabs.map((tab) => (
            <TabsContent
              className="flex flex-col justify-evenly gap-6"
              key={tab.value}
              value={tab.value}
            >
              {tab.contentData?.map((item) => (
                <div className="space-y-2" key={item.label}>
                  <div className="flex items-center justify-between">
                    <span className="text-base">{item.label}</span>
                    <span className="text-muted-foreground text-sm">
                      {item.value}
                    </span>
                  </div>
                  <Progress
                    className="**:data-[slot=progress-track]:h-2"
                    value={item.progress}
                  />
                </div>
              ))}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </CardContent>
  </Card>
);

export default UserOrderCard;
