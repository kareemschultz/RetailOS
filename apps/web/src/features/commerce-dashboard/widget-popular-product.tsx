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
import { EllipsisVerticalIcon } from "lucide-react";

const listItems = ["Share", "Update", "Refresh"];

interface Props {
  className?: string;
  productsData: {
    img: string;
    productName: string;
    price: string;
    visits: string;
  }[];
  subTitle: string;
  title: string;
}

const PopularProductCard = ({
  title,
  subTitle,
  productsData,
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
            {listItems.map((item) => (
              <DropdownMenuItem key={item}>{item}</DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </CardHeader>
    <CardContent className="flex flex-1 flex-col justify-between gap-3">
      {productsData.map((product) => (
        <div
          className="flex items-center justify-between gap-2"
          key={product.productName}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="p-2">
              <img
                alt={product.productName}
                className="size-10.5"
                height={42}
                src={product.img}
                width={42}
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="font-medium text-base">
                {product.productName}
              </span>
              <span className="text-muted-foreground text-xs">
                {product.price}
              </span>
            </div>
          </div>
          <span className="text-muted-foreground text-sm">
            {product.visits}
          </span>
        </div>
      ))}
    </CardContent>
  </Card>
);

export default PopularProductCard;
