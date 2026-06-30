// Third-party Imports

// Component Imports
import { Button } from "@RetailOS/ui/components/button";
import { CardContent } from "@RetailOS/ui/components/card";
import { CircleCheckIcon } from "lucide-react";

const CompleteStep = ({ onReset }: { onReset: () => void }) => (
  <CardContent className="col-span-4 flex flex-col items-center justify-center gap-4 p-10 text-center md:col-span-3">
    <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
      <CircleCheckIcon className="size-7" />
    </div>
    <div className="space-y-1">
      <h3 className="font-semibold text-lg">Store Created</h3>
      <p className="text-muted-foreground text-sm">
        Your new store is set up and ready. You can now add products and open a
        shift at the point of sale.
      </p>
    </div>
    <Button onClick={onReset} type="button" variant="outline">
      Set Up Another Store
    </Button>
  </CardContent>
);

export default CompleteStep;
