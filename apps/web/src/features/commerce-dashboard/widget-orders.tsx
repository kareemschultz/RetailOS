// Third-party Imports

// Component Imports
import { Button } from "@RetailOS/ui/components/button";
import { Card, CardHeader } from "@RetailOS/ui/components/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@RetailOS/ui/components/dropdown-menu";
import { Separator } from "@RetailOS/ui/components/separator";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@RetailOS/ui/components/tabs";
import {
  Timeline,
  TimelineContent,
  TimelineDot,
  TimelineHeading,
  TimelineItem,
  TimelineLine,
} from "@RetailOS/ui/components/timeline";
import { EllipsisVerticalIcon, MapPinIcon, UserCheckIcon } from "lucide-react";

const listItems = ["Share", "Update", "Refresh"];

const tabs = [
  {
    name: "New",
    value: "new",
    content: [
      {
        sender: "Mytrle Ullrich",
        senderContent: "101 Boulder, California(CA), 959595",
        receiver: "Barry Schowalter",
        receiverContent: "939 orange, California(CA), 92118",
      },
      {
        sender: "Lucas Smith",
        senderContent: "203 Riverdale, New York(NY), 10001",
        receiver: "Emma Johnson",
        receiverContent: "305 Maple Avenue, Austin, Texas(TX), 73301",
      },
    ],
  },
  {
    name: "Pending",
    value: "pending",
    content: [
      {
        sender: "Ava Wilson",
        senderContent: "Your package has been dispatched",
        receiver: "Ryan Taylor",
        receiverContent: "The package is out for delivery today",
      },
      {
        sender: "Olivia Brown",
        senderContent: "Your package has been dispatched",
        receiver: "James Davis",
        receiverContent:
          "The package was successfully delivered today at 12:30 PM",
      },
    ],
  },
  {
    name: "Shipping",
    value: "shipping",
    content: [
      {
        sender: "Noah Parker",
        senderContent: "Delivering in 2 days from now (July 13, 2025)",
        receiver: "Grace Kim",
        receiverContent: "939 orange, California(CA), 92118",
      },
      {
        sender: "Lily Wang",
        senderContent: "July 11, 2025 (Delivered at 12:30 PM)",
        receiver: "Maya Singh",
        receiverContent: "July 11, 2025 (Delivered at 12:30 PM)",
      },
    ],
  },
];

const OrdersCard = ({ className }: { className?: string }) => (
  <Card className={className}>
    <CardHeader className="flex justify-between">
      <div className="flex flex-col gap-1">
        <span className="font-semibold text-lg">Orders</span>
        <span className="text-muted-foreground text-sm">
          75 Deliveries in progress
        </span>
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
            {listItems.map((item) => (
              <DropdownMenuItem key={item}>{item}</DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </CardHeader>
    <Tabs className="gap-4" defaultValue="new">
      <TabsList
        className="w-full gap-0 rounded-none border-b p-0"
        variant="line"
      >
        {tabs.map((tab) => (
          <TabsTrigger
            className="border-0 group-data-horizontal/tabs:after:-bottom-[0.5px]"
            key={tab.value}
            value={tab.value}
          >
            {tab.name}
          </TabsTrigger>
        ))}
      </TabsList>

      {tabs.map((tab) => (
        <TabsContent
          className="flex flex-col gap-4"
          key={tab.value}
          value={tab.value}
        >
          {tab.content?.map((item, index) => (
            <div className="flex flex-col gap-4 pr-6 pl-2" key={item.sender}>
              <Timeline>
                <TimelineItem className="gap-x-4" status="done">
                  <TimelineDot className="mb-1.25" status="custom">
                    <UserCheckIcon className="size-4 text-primary" />
                  </TimelineDot>
                  <TimelineLine className="bg-[repeating-linear-gradient(0deg,var(--border),var(--border)_5px,var(--card)_6px,var(--card)_10px)]" />
                  <TimelineHeading className="font-normal text-sm">
                    Sender
                  </TimelineHeading>
                  <TimelineContent className="flex flex-col gap-0.5 pb-2">
                    <span className="font-medium text-base">{item.sender}</span>
                    <span className="text-muted-foreground text-sm">
                      {item.senderContent}
                    </span>
                  </TimelineContent>
                </TimelineItem>
                <TimelineItem className="mt-2 gap-x-4" status="done">
                  <TimelineDot status="custom">
                    <MapPinIcon className="size-4 text-primary" />
                  </TimelineDot>
                  <TimelineHeading className="font-normal text-sm">
                    Receiver
                  </TimelineHeading>
                  <TimelineContent className="mt-0.5 flex flex-col gap-0.5 pb-0">
                    <span className="font-medium text-base">
                      {item.receiver}
                    </span>
                    <span className="text-muted-foreground text-sm">
                      {item.receiverContent}
                    </span>
                  </TimelineContent>
                </TimelineItem>
              </Timeline>
              {index !== tab.content.length - 1 && (
                <div className="pl-4">
                  <Separator />
                </div>
              )}
            </div>
          ))}
        </TabsContent>
      ))}
    </Tabs>
  </Card>
);

export default OrdersCard;
