// Component Imports
import { Avatar, AvatarFallback } from "@RetailOS/ui/components/avatar";
import { Button } from "@RetailOS/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@RetailOS/ui/components/dialog";
import { Input } from "@RetailOS/ui/components/input";
import { Label } from "@RetailOS/ui/components/label";
// Util Imports
import { cn } from "@RetailOS/ui/lib/utils";
import { CreditCardIcon } from "lucide-react";
import { type ReactElement, useState } from "react";

interface Props {
  className?: string;
  defaultOpen?: boolean;
  trigger: ReactElement;
}

// NOTE: AdminCN's original used `react-19-credit-card` + `react-payment-inputs`,
// which pull `styled-components` (a CSS-in-JS runtime RetailOS does not use and
// rolldown cannot resolve). Adapted to a Tailwind-only card preview + plain
// controlled inputs to keep the build clean.
const AddPaymentMethodDialog = ({
  defaultOpen = false,
  trigger,
  className,
}: Props) => {
  const [open, setOpen] = useState(defaultOpen);

  const [state, setState] = useState({
    number: "",
    expiry: "",
    cvc: "",
    name: "",
  });

  const handleInputChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = evt.target;

    setState((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger onClick={() => setOpen(true)} render={trigger} />
      <DialogContent
        className={cn(
          "sm:max-w-155 [&>[data-slot=dialog-close]>svg]:size-5",
          className
        )}
      >
        <DialogHeader className="flex-row items-center gap-4 text-left">
          <Avatar className="size-11 shrink-0 rounded-md after:rounded-md">
            <AvatarFallback className="rounded-md border bg-transparent text-foreground">
              <CreditCardIcon className="size-6" />
            </AvatarFallback>
          </Avatar>
          <div className="space-y-2">
            <DialogTitle className="m-0 text-lg">
              Add Payment Method
            </DialogTitle>
            <DialogDescription className="text-sm">
              Add a payment method to active plan
            </DialogDescription>
          </div>
        </DialogHeader>

        {/* Credit card preview */}
        <div className="flex items-center justify-center rounded-lg bg-muted p-6">
          <div className="flex aspect-[1.6/1] w-full max-w-80 flex-col justify-between rounded-xl bg-gradient-to-br from-primary to-primary/70 p-5 text-primary-foreground shadow-sm">
            <div className="flex items-center justify-between">
              <span className="h-7 w-10 rounded-md bg-primary-foreground/30" />
              <CreditCardIcon className="size-6 opacity-80" />
            </div>
            <p className="font-mono text-lg tracking-widest">
              {state.number || "•••• •••• •••• ••••"}
            </p>
            <div className="flex items-center justify-between font-mono text-sm">
              <span className="truncate uppercase">
                {state.name || "FULL NAME"}
              </span>
              <span>{state.expiry || "MM/YY"}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <div className="col-span-3 space-y-2 max-sm:col-span-4">
            <Label htmlFor="username">Name on card</Label>
            <Input
              id="username"
              name="name"
              onChange={handleInputChange}
              placeholder="John Doe"
              type="text"
              value={state.name}
            />
          </div>

          <div className="space-y-2 max-sm:col-span-4">
            <Label htmlFor="expiry-date">Expiry</Label>
            <Input
              id="expiry-date"
              name="expiry"
              onChange={handleInputChange}
              placeholder="MM/YY"
              value={state.expiry}
            />
          </div>

          <div className="col-span-3 space-y-2 max-sm:col-span-4">
            <Label htmlFor="card-number">Card number</Label>
            <Input
              id="card-number"
              name="number"
              onChange={handleInputChange}
              placeholder="1234 5678 9012 3456"
              value={state.number}
            />
          </div>

          <div className="space-y-2 max-sm:col-span-4">
            <Label htmlFor="cvc">CVC</Label>
            <Input
              id="cvc"
              name="cvc"
              onChange={handleInputChange}
              placeholder="CVC"
              value={state.cvc}
            />
          </div>
        </div>

        <div className="flex flex-col-reverse gap-4 sm:flex-row sm:justify-end">
          <DialogClose render={<Button size="lg" variant="outline" />}>
            Cancel
          </DialogClose>
          <Button size="lg">Add card details</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddPaymentMethodDialog;
