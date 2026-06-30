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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@RetailOS/ui/components/table";
// Util Imports
import { cn } from "@RetailOS/ui/lib/utils";
import { EllipsisVerticalIcon } from "lucide-react";

const listItems = ["Share", "Update", "Refresh"];

interface Props {
  className?: string;
  paymentData: {
    img: string;
    imgWidth: string;
    cardNumber: string;
    cardType: string;
    date: string;
    spend: string;
    remaining: string;
  }[];
  title: string;
}

const PaymentHistoryCard = ({ title, paymentData, className }: Props) => (
  <Card className={cn("justify-between", className)}>
    <CardHeader className="flex items-center justify-between px-6">
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
            {listItems.map((item) => (
              <DropdownMenuItem key={item}>{item}</DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </CardHeader>
    <CardContent className="px-0">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="pl-6">Card</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="pr-6 text-end">Spend</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paymentData.map((payment) => (
            <TableRow
              className="border-none hover:bg-transparent"
              key={`${payment.cardNumber}-${payment.date}-${payment.spend}`}
            >
              <TableCell className="pl-6 first:pt-4">
                <div className="flex items-center gap-2">
                  <div className="flex size-10.5 items-center justify-center rounded-sm bg-muted">
                    <img
                      alt={payment.cardType}
                      className={payment.imgWidth}
                      height={24}
                      src={payment.img}
                      width={38}
                    />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-base">
                      *{payment.cardNumber}
                    </span>
                    <span className="text-muted-foreground text-sm">
                      {payment.cardType}
                    </span>
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground text-xs">
                {payment.date}
              </TableCell>
              <TableCell className="pr-6">
                <div className="flex flex-col items-end">
                  <span className="text-sm">-${payment.spend}</span>
                  <span className="text-muted-foreground text-xs">
                    ${payment.remaining}
                  </span>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </CardContent>
  </Card>
);

export default PaymentHistoryCard;
