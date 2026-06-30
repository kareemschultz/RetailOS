import { createFileRoute } from "@tanstack/react-router";

import FormWizard from "@/features/form-wizard";

export const Route = createFileRoute("/_app/form-wizard")({
  component: FormWizardScreen,
});

function FormWizardScreen() {
  return (
    <div>
      <div className="mb-4 md:mb-6 lg:mb-10">
        <h1 className="font-bold text-xl">Form Wizard</h1>
        <p className="text-muted-foreground">
          A guided, multi-step New Store Setup wizard — company, location, tax
          and currency, then review and confirm.
        </p>
      </div>
      <FormWizard />
    </div>
  );
}
