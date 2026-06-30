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
import { ArrowDownIcon, ArrowUpIcon, EllipsisVerticalIcon } from "lucide-react";
import type { ReactElement } from "react";

const listItems = ["Share", "Update", "Refresh"];

type Props = {
  title: string;
  transactions: {
    icon: ReactElement;
    paymentMethod: string;
    platform: string;
    amount: string;
    paymentType: string;
    iconClassName?: string;
  }[];
  className?: string;
};

const TransactionsCard = ({ title, transactions, className }: Props) => (
  <Card className={className}>
    <CardHeader className="flex items-center justify-between">
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
            {listItems.map((item, index) => (
              <DropdownMenuItem key={index}>{item}</DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </CardHeader>
    <CardContent className="flex flex-1 flex-col justify-between gap-4">
      {transactions.map((transaction, index) => (
        <div className="flex items-center justify-between gap-2" key={index}>
          <div className="flex items-center justify-between gap-4">
            <Avatar className="rounded-sm after:border-0" size="lg">
              <AvatarFallback
                className={cn(
                  "shrink-0 rounded-sm bg-primary/10 text-primary [&>svg]:size-5",
                  transaction.iconClassName
                )}
              >
                {transaction.icon}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-0.5">
              <span className="font-medium text-base">
                {transaction.paymentMethod}
              </span>
              <span className="text-muted-foreground text-sm">
                {transaction.platform}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="text-sm">
              {transaction.paymentType === "debit" ? "-" : "+"}
              {transaction.amount}
            </span>
            <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-primary">
              {transaction.paymentType === "debit" ? (
                <ArrowDownIcon className="size-4" />
              ) : (
                <ArrowUpIcon className="size-4" />
              )}
            </div>
          </div>
        </div>
      ))}
    </CardContent>
  </Card>
);

export default TransactionsCard;
