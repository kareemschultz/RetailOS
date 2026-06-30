// Third-party Imports

// Component Imports
import { Button } from "@RetailOS/ui/components/button";
import { CardContent } from "@RetailOS/ui/components/card";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@RetailOS/ui/components/field";
import { Input } from "@RetailOS/ui/components/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import * as z from "zod";

import type { LocationValues, StepControls } from "../types";

const schema = z.object({
  storeName: z
    .string()
    .min(1, "Store name is required.")
    .min(2, "Store name must be at least 2 characters."),
  address: z.string().min(1, "Address is required."),
  city: z.string().min(1, "City is required."),
});

const LocationStep = ({
  defaultValues,
  onNext,
  onBack,
}: {
  defaultValues: LocationValues;
  onNext: (values: LocationValues) => void;
} & StepControls) => {
  const form = useForm<LocationValues>({
    resolver: zodResolver(schema),
    mode: "onBlur",
    defaultValues,
  });

  return (
    <CardContent className="col-span-4 flex flex-col gap-5 p-6 md:col-span-3">
      <div>
        <h3 className="font-semibold">Location</h3>
        <p className="text-muted-foreground text-sm">
          Where is this store physically located?
        </p>
      </div>

      <form id="wizard-location" onSubmit={form.handleSubmit(onNext)}>
        <FieldGroup className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Controller
            control={form.control}
            name="storeName"
            render={({ field, fieldState }) => (
              <Field
                className="gap-2 sm:col-span-2"
                data-invalid={fieldState.invalid}
              >
                <FieldLabel htmlFor={field.name}>Store Name</FieldLabel>
                <Input
                  {...field}
                  aria-invalid={fieldState.invalid}
                  id={field.name}
                  placeholder="Georgetown Main Branch"
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <Controller
            control={form.control}
            name="address"
            render={({ field, fieldState }) => (
              <Field className="gap-2" data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>Address</FieldLabel>
                <Input
                  {...field}
                  aria-invalid={fieldState.invalid}
                  id={field.name}
                  placeholder="45 Robb Street"
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <Controller
            control={form.control}
            name="city"
            render={({ field, fieldState }) => (
              <Field className="gap-2" data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>City / Town</FieldLabel>
                <Input
                  {...field}
                  aria-invalid={fieldState.invalid}
                  id={field.name}
                  placeholder="Georgetown"
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
        </FieldGroup>
      </form>

      <div className="flex justify-between">
        <Button onClick={onBack} type="button" variant="outline">
          <ArrowLeftIcon />
          Back
        </Button>
        <Button form="wizard-location" type="submit">
          Next
          <ArrowRightIcon />
        </Button>
      </div>
    </CardContent>
  );
};

export default LocationStep;
