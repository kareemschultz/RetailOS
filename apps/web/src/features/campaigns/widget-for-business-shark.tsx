// Third-party Imports

// Component Imports
import { Badge } from "@RetailOS/ui/components/badge";
import { Button } from "@RetailOS/ui/components/button";
import { Card, CardContent, CardHeader } from "@RetailOS/ui/components/card";
import { Checkbox } from "@RetailOS/ui/components/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@RetailOS/ui/components/dropdown-menu";
import { Label } from "@RetailOS/ui/components/label";
import { EllipsisVerticalIcon } from "lucide-react";

const listItems = ["Share", "Update", "Refresh"];

const plans = [
  {
    name: "Branding",
    price: 60,
    checked: false,
  },
  {
    name: "Marketing",
    price: 120,
    checked: true,
  },
  {
    name: "Web Development",
    price: 250,
    checked: false,
  },
  {
    name: "App Development",
    price: 320,
    checked: false,
  },
];

const ForBusinessSharkCard = ({ className }: { className?: string }) => (
  <Card className={className}>
    <CardHeader>
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-lg">For Business Shark</span>
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
      </div>
      <p className="text-muted-foreground text-sm">
        Here, I focus on a range of items and features that we use in life
        without them
      </p>
    </CardHeader>
    <CardContent className="space-y-2">
      <Label className="font-medium text-base">
        Choose a plan to get started
      </Label>
      {plans.map((plan, index) => (
        <Label
          className="flex cursor-pointer items-center gap-3 rounded-md border px-4 py-2 has-data-checked:border-primary dark:has-data-checked:border-primary"
          key={index}
        >
          <Checkbox defaultChecked={plan.checked} />
          <div className="flex w-full items-center justify-between gap-2">
            <p className="font-medium text-sm leading-none">{plan.name}</p>
            <Badge className="h-6 rounded-sm bg-primary/10 px-3 py-1 text-primary">
              ${plan.price}
            </Badge>
          </div>
        </Label>
      ))}
    </CardContent>
    <CardContent className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-sm">
        <span>Taxes</span>
        <span>$32</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm">Total amount</span>
        <span className="font-medium text-lg">$152</span>
      </div>
    </CardContent>
    <CardContent>
      <Button className="w-full" size="lg">
        Pay now
      </Button>
    </CardContent>
  </Card>
);

export default ForBusinessSharkCard;
