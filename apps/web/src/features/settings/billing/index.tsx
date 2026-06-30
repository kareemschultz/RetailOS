import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@RetailOS/ui/components/alert";
import { Separator } from "@RetailOS/ui/components/separator";
import { CircleAlertIcon } from "lucide-react";

import AddOns from "@/features/settings/billing/add-ons";
import AiGateway from "@/features/settings/billing/ai-gateway";
import Billing from "@/features/settings/billing/all-billing";
import PaymentMethod from "@/features/settings/billing/payment-method";
import SpendManagement from "@/features/settings/billing/spend-management";

const BillingUsagePage = () => (
  <section className="py-3">
    <Alert className="mb-6 flex justify-between border-accent-foreground/20 bg-gradient-to-b from-accent to-60% to-transparent text-accent-foreground">
      <CircleAlertIcon />
      <div className="flex flex-1 flex-col gap-1">
        <AlertTitle>This workspace is currently on free plan</AlertTitle>
        <AlertDescription className="text-accent-foreground/60">
          Boost your analytics and unlock advanced features with our premium
          plans.
        </AlertDescription>
      </div>
    </Alert>
    <Billing />
    <Separator className="my-10" />
    <SpendManagement />
    <Separator className="my-10" />
    <PaymentMethod />
    <Separator className="my-10" />
    <AiGateway />
    <Separator className="my-10" />
    <AddOns />
  </section>
);

export default BillingUsagePage;
