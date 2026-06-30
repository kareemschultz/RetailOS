// React Imports

// Component Imports
import { Avatar, AvatarFallback } from "@RetailOS/ui/components/avatar";
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
import { Separator } from "@RetailOS/ui/components/separator";
// Util Imports
import { cn } from "@RetailOS/ui/lib/utils";
// Third-party Imports
import { EllipsisVerticalIcon } from "lucide-react";
import type { ReactElement } from "react";

const listItems = ["Share", "Update", "Refresh"];

interface Props {
  className?: string;
  productsBySalesData: {
    icon: ReactElement;
    productName: string;
    productBrand: string;
    sales: string;
    iconClassName?: string;
  }[];
  productsByVolumeData: {
    icon: ReactElement;
    productName: string;
    productBrand: string;
    volume: string;
    changePercentage: number;
    iconClassName?: string;
  }[];
  salesTitle: string;
  volumeTitle: string;
}

const TopProductsCard = ({
  salesTitle,
  productsBySalesData,
  volumeTitle,
  productsByVolumeData,
  className,
}: Props) => {
  return (
    <Card className={cn("gap-x-2 gap-y-6 lg:flex-row", className)}>
      {/* Products by sales card */}
      <div className="flex flex-1 flex-col gap-9">
        <CardHeader className="flex items-center justify-between">
          <span className="font-semibold text-lg">{salesTitle}</span>
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
              <span className="sr-only">Edit menu</span>
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
        <CardContent className="flex flex-1 flex-col justify-between gap-4">
          {productsBySalesData.map((product) => (
            <div
              className="flex items-center justify-between gap-2"
              key={product.productName}
            >
              <div className="flex items-center justify-between gap-3">
                <Avatar className="size-9 rounded-sm after:border-0">
                  <AvatarFallback
                    className={cn(
                      "shrink-0 rounded-sm bg-primary/10 text-primary [&>svg]:size-4.5",
                      product.iconClassName
                    )}
                  >
                    {product.icon}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="text-base">{product.productName}</span>
                  <span className="text-muted-foreground text-sm">
                    {product.productBrand}
                  </span>
                </div>
              </div>
              <span className="text-sm">{product.sales}</span>
            </div>
          ))}
        </CardContent>
      </div>
      <div className="flex max-lg:px-6">
        <Separator className="hidden lg:block" orientation="vertical" />
        <Separator className="block lg:hidden" />
      </div>
      {/* Products by volume card */}
      <div className="flex flex-1 flex-col gap-9">
        <CardHeader className="flex items-center justify-between">
          <span className="font-semibold text-lg">{volumeTitle}</span>
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
        <CardContent className="flex flex-1 flex-col justify-between gap-4">
          {productsByVolumeData.map((product) => (
            <div
              className="flex items-center justify-between gap-2"
              key={product.productName}
            >
              <div className="flex items-center justify-between gap-3">
                <Avatar className="size-9 rounded-sm after:border-0">
                  <AvatarFallback
                    className={cn(
                      "shrink-0 rounded-sm bg-primary/10 text-primary [&>svg]:size-4.5",
                      product.iconClassName
                    )}
                  >
                    {product.icon}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="text-base">{product.productName}</span>
                  <span className="text-muted-foreground text-sm">
                    {product.productBrand}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-sm">{product.volume}</span>
                <Badge className="h-6 rounded-sm bg-primary/10 px-3 py-1 text-primary">
                  {product.changePercentage > 0 && "+"}
                  {product.changePercentage}%
                </Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </div>
    </Card>
  );
};

export default TopProductsCard;
