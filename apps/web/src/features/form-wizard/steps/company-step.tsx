// Third-party Imports

// Component Imports
import { Button } from "@RetailOS/ui/components/button";
import { CardContent } from "@RetailOS/ui/components/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@RetailOS/ui/components/field";
import { Input } from "@RetailOS/ui/components/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRightIcon } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import * as z from "zod";

import type { CompanyValues } from "../types";

const schema = z.object({
  companyName: z
    .string()
    .min(1, "Company name is required.")
    .min(2, "Company name must be at least 2 characters."),
  tradeName: z.string(),
  tin: z
    .string()
    .min(1, "Taxpayer ID is required.")
    .min(6, "Enter a valid Taxpayer ID (TIN)."),
});

const CompanyStep = ({
  defaultValues,
  onNext,
}: {
  defaultValues: CompanyValues;
  onNext: (values: CompanyValues) => void;
}) => {
  const form = useForm<CompanyValues>({
    resolver: zodResolver(schema),
    mode: "onBlur",
    defaultValues,
  });

  return (
    <CardContent className="col-span-4 flex flex-col gap-5 p-6 md:col-span-3">
      <div>
        <h3 className="font-semibold">Company</h3>
        <p className="text-muted-foreground text-sm">
          Tell us about the business that owns this store
        </p>
      </div>

      <form id="wizard-company" onSubmit={form.handleSubmit(onNext)}>
        <FieldGroup className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Controller
            control={form.control}
            name="companyName"
            render={({ field, fieldState }) => (
              <Field
                className="gap-2 sm:col-span-2"
                data-invalid={fieldState.invalid}
              >
                <FieldLabel htmlFor={field.name}>Company Name</FieldLabel>
                <Input
                  {...field}
                  aria-invalid={fieldState.invalid}
                  id={field.name}
                  placeholder="Ramotar Trading Ltd."
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <Controller
            control={form.control}
            name="tradeName"
            render={({ field }) => (
              <Field className="gap-2">
                <FieldLabel htmlFor={field.name}>Trading Name</FieldLabel>
                <Input
                  {...field}
                  id={field.name}
                  placeholder="Ramotar Hardware"
                />
                <FieldDescription className="text-xs">
                  Optional — shown on receipts if set
                </FieldDescription>
              </Field>
            )}
          />

          <Controller
            control={form.control}
            name="tin"
            render={({ field, fieldState }) => (
              <Field className="gap-2" data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>Taxpayer ID (TIN)</FieldLabel>
                <Input
                  {...field}
                  aria-invalid={fieldState.invalid}
                  id={field.name}
                  placeholder="GY-123456789"
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
        </FieldGroup>
      </form>

      <div className="flex justify-end">
        <Button form="wizard-company" type="submit">
          Next
          <ArrowRightIcon />
        </Button>
      </div>
    </CardContent>
  );
};

export default CompanyStep;
