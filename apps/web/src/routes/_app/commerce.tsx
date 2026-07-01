import { createFileRoute } from "@tanstack/react-router";
import { Store } from "lucide-react";
import { ModuleStatusPage } from "@/components/module-status-page";

export const Route = createFileRoute("/_app/commerce")({
  component: CommerceLanding,
});

function CommerceLanding() {
  return (
    <ModuleStatusPage
      actions={[
        {
          description:
            "Back-office catalog and product media are the source for future storefront listings.",
          label: "Products",
          to: "/products",
        },
        {
          description:
            "Operational POS sales are live; online orders will use separate storefront checkout contracts.",
          label: "Sales console",
          to: "/sales",
        },
      ]}
      eyebrow="Commerce"
      icon={Store}
      steps={[
        {
          description:
            "Hostname-to-tenant storefront gateway and public identity endpoint exist.",
          label: "Storefront gateway",
          status: "Available",
        },
        {
          description:
            "Public product/category DTOs, product detail pages, images, and coarse availability.",
          label: "Public catalog",
          status: "Planned",
        },
        {
          description:
            "Cart, quote, tax, checkout intent, payment confirmation, and stock reservation.",
          label: "Cart & checkout",
          status: "Planned",
        },
        {
          description:
            "Pickup/delivery fulfilment, customer identity, guest PII vault, and online returns.",
          label: "Online orders",
          status: "Planned",
        },
      ]}
      summary="Commerce is the Shopix customer-facing storefront. The gateway proof exists; catalog, cart, checkout, payments, and online orders will be built as public-safe APIs and RetailOS-owned UI."
      title="Storefront & Commerce"
    />
  );
}
