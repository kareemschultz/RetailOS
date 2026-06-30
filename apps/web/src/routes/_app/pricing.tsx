import { createFileRoute } from "@tanstack/react-router";

import { pricingData } from "@/features/pricing/data";
import PricingDetail from "@/features/pricing/pricing-detail";

export const Route = createFileRoute("/_app/pricing")({
  component: PricingScreen,
});

function PricingScreen() {
  return (
    <PricingDetail features={pricingData.features} plans={pricingData.plans} />
  );
}
