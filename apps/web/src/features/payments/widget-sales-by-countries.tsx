// Third-party Imports

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
import {
  ChevronDownIcon,
  ChevronUpIcon,
  EllipsisVerticalIcon,
} from "lucide-react";

const listItems = ["Share", "Update", "Refresh"];

type Props = {
  title: string;
  subTitle: string;
  salesData: {
    img: string;
    sales: string;
    country: string;
    changePercentage: string;
    trend: string;
  }[];
  className?: string;
};

const SalesByCountryCard = ({
  title,
  subTitle,
  salesData,
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
      {salesData.map((sale, index) => (
        <div className="flex items-center justify-between gap-4" key={index}>
          <div className="flex items-center justify-between gap-4">
            <div className="overflow-hidden rounded-full">
              <img
                alt={sale.country}
                className="size-10 object-cover"
                src={sale.img}
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="font-medium text-base">{sale.sales}</span>
              <span className="text-muted-foreground text-sm">
                {sale.country}
              </span>
            </div>
          </div>
          <span className="flex items-center gap-1">
            {sale.trend === "up" ? (
              <ChevronUpIcon className="size-4" />
            ) : (
              <ChevronDownIcon className="size-4" />
            )}
            <span className="text-sm">{sale.changePercentage}</span>
          </span>
        </div>
      ))}
    </CardContent>
  </Card>
);

export default SalesByCountryCard;
