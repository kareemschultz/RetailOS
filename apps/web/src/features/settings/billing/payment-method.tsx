import { Button } from "@RetailOS/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@RetailOS/ui/components/dropdown-menu";
import { Separator } from "@RetailOS/ui/components/separator";
import { EllipsisVerticalIcon } from "lucide-react";
import AddPaymentMethodDialog from "@/features/settings/billing/dialog-add-payment-method";

const PaymentMethod = () => {
  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
      {/* Vertical Tabs List */}
      <div className="flex flex-col space-y-1">
        <h3 className="font-semibold text-base">Payment Method</h3>
        <p className="text-muted-foreground text-sm">
          Manage your payment method and billing information.
        </p>
      </div>

      {/* Content */}
      <div className="space-y-6 lg:col-span-2">
        <div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img
                alt="Visa"
                className="h-6"
                src="https://cdn.shadcnstudio.com/ss-assets/blocks/dashboard-application/dashboard-dialog/image-8.png"
              />
              <p className="font-medium text-sm">Visa Debit **** 1234</p>
            </div>
            <div className="flex items-center gap-2">
              <p className="font-medium text-sm">Valid until 11/2028</p>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      className="rounded-full"
                      size="icon"
                      variant="ghost"
                    />
                  }
                >
                  {" "}
                  <EllipsisVerticalIcon />
                  <span className="sr-only">Edit menu</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-20">
                  <DropdownMenuGroup>
                    <DropdownMenuItem>Make Default</DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive!">
                      Remove
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <Separator className="my-3" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img
                alt="Mastercard"
                className="h-6"
                src="https://cdn.shadcnstudio.com/ss-assets/blocks/dashboard-application/dashboard-dialog/image-9.png"
              />
              <p className="font-medium text-sm">Mastercard **** 5678</p>
            </div>
            <div className="flex items-center gap-2">
              <p className="font-medium text-sm">Valid until 10/2028</p>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      className="rounded-full"
                      size="icon"
                      variant="ghost"
                    />
                  }
                >
                  <EllipsisVerticalIcon />
                  <span className="sr-only">Edit menu</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-20">
                  <DropdownMenuGroup>
                    <DropdownMenuItem>Make Default</DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive">
                      Remove
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
        <div className="flex justify-end">
          <AddPaymentMethodDialog
            trigger={
              <Button className="max-sm:w-full">
                <span>Add</span>
              </Button>
            }
          />
        </div>
      </div>
    </div>
  );
};

export default PaymentMethod;
