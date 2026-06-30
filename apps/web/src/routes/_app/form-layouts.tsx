import { createFileRoute } from "@tanstack/react-router";

import FormLayouts from "@/features/form-layouts";

export const Route = createFileRoute("/_app/form-layouts")({
  component: FormLayoutsScreen,
});

function FormLayoutsScreen() {
  return (
    <div>
      <div className="mb-4 md:mb-6 lg:mb-10">
        <h1 className="font-bold text-xl">Form Layouts</h1>
        <p className="text-muted-foreground">
          Sample RetailOS data-entry layouts — product, supplier, store, and
          tabbed configuration forms.
        </p>
      </div>
      <FormLayouts />
    </div>
  );
}
