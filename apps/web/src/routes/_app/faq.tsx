import { createFileRoute } from "@tanstack/react-router";

import { faqData } from "@/features/faq/data";
import FAQ from "@/features/faq/faq";

export const Route = createFileRoute("/_app/faq")({
  component: FaqScreen,
});

function FaqScreen() {
  return <FAQ data={faqData} />;
}
