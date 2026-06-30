// Third-party Imports

// Component Imports
import { Button } from "@RetailOS/ui/components/button";
import { CardContent } from "@RetailOS/ui/components/card";
import { Separator } from "@RetailOS/ui/components/separator";
import { ArrowLeftIcon, CheckIcon } from "lucide-react";

import type { StepControls, WizardData } from "../types";

const currencyLabels: Record<string, string> = {
  gyd: "GYD — Guyanese Dollar",
  usd: "USD — US Dollar",
  ttd: "TTD — Trinidad Dollar",
};

const taxLabels: Record<string, string> = {
  standard: "Standard VAT (14%)",
  zero: "Zero-rated",
  exempt: "Tax exempt",
};

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between gap-4 py-1.5">
    <span className="text-muted-foreground text-sm">{label}</span>
    <span className="text-right font-medium text-sm">{value || "—"}</span>
  </div>
);

const ReviewStep = ({
  data,
  onConfirm,
  onBack,
}: {
  data: WizardData;
  onConfirm: () => void;
} & StepControls) => (
  <CardContent className="col-span-4 flex flex-col gap-5 p-6 md:col-span-3">
    <div>
      <h3 className="font-semibold">Review</h3>
      <p className="text-muted-foreground text-sm">
        Confirm the details before creating the store
      </p>
    </div>

    <div className="rounded-lg border p-4">
      <h4 className="mb-2 font-medium text-sm">Company</h4>
      <Row label="Company Name" value={data.company.companyName} />
      <Row label="Trading Name" value={data.company.tradeName} />
      <Row label="Taxpayer ID" value={data.company.tin} />

      <Separator className="my-3" />

      <h4 className="mb-2 font-medium text-sm">Location</h4>
      <Row label="Store Name" value={data.location.storeName} />
      <Row label="Address" value={data.location.address} />
      <Row label="City / Town" value={data.location.city} />

      <Separator className="my-3" />

      <h4 className="mb-2 font-medium text-sm">Tax &amp; Currency</h4>
      <Row
        label="Base Currency"
        value={
          currencyLabels[data.operations.currency] ?? data.operations.currency
        }
      />
      <Row
        label="Default Tax Class"
        value={taxLabels[data.operations.taxClass] ?? data.operations.taxClass}
      />
      <Row
        label="Tax-inclusive Pricing"
        value={data.operations.priceInclusive ? "Yes" : "No"}
      />
    </div>

    <div className="flex justify-between">
      <Button onClick={onBack} type="button" variant="outline">
        <ArrowLeftIcon />
        Back
      </Button>
      <Button onClick={onConfirm} type="button">
        <CheckIcon />
        Create Store
      </Button>
    </div>
  </CardContent>
);

export default ReviewStep;
