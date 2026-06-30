import { createFileRoute } from "@tanstack/react-router";

import FormValidation from "@/features/form-validation";

export const Route = createFileRoute("/_app/form-validation")({
  component: FormValidationScreen,
});

function FormValidationScreen() {
  return (
    <div>
      <div className="mb-4 md:mb-6 lg:mb-10">
        <h1 className="font-bold text-xl">Form Validation</h1>
        <p className="text-muted-foreground">
          Sample RetailOS forms with React Hook Form and Zod — inline field
          errors, retail validation rules and friendly recovery.
        </p>
      </div>
      <FormValidation />
    </div>
  );
}
