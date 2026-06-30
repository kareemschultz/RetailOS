// Third-party Imports

// Component Imports
import { Button } from "@RetailOS/ui/components/button";
import { CardContent } from "@RetailOS/ui/components/card";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@RetailOS/ui/components/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@RetailOS/ui/components/select";
import { Switch } from "@RetailOS/ui/components/switch";
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import { Controller, useForm } from "react-hook-form";

import type { OperationsValues, StepControls } from "../types";

const currencies = [
  { value: "gyd", label: "GYD — Guyanese Dollar" },
  { value: "usd", label: "USD — US Dollar" },
  { value: "ttd", label: "TTD — Trinidad Dollar" },
];

const taxClasses = [
  { value: "standard", label: "Standard VAT (14%)" },
  { value: "zero", label: "Zero-rated" },
  { value: "exempt", label: "Tax exempt" },
];

const OperationsStep = ({
  defaultValues,
  onNext,
  onBack,
}: {
  defaultValues: OperationsValues;
  onNext: (values: OperationsValues) => void;
} & StepControls) => {
  const form = useForm<OperationsValues>({
    mode: "onBlur",
    defaultValues,
  });

  return (
    <CardContent className="col-span-4 flex flex-col gap-5 p-6 md:col-span-3">
      <div>
        <h3 className="font-semibold">Tax &amp; Currency</h3>
        <p className="text-muted-foreground text-sm">
          How this store prices and taxes its sales
        </p>
      </div>

      <form id="wizard-operations" onSubmit={form.handleSubmit(onNext)}>
        <FieldGroup className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Controller
            control={form.control}
            name="currency"
            render={({ field }) => (
              <Field className="gap-2">
                <FieldLabel htmlFor={field.name}>Base Currency</FieldLabel>
                <Select
                  items={currencies}
                  onValueChange={field.onChange}
                  value={field.value}
                >
                  <SelectTrigger className="w-full" id={field.name}>
                    <SelectValue placeholder="Select a currency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {currencies.map((currency) => (
                        <SelectItem key={currency.value} value={currency.value}>
                          {currency.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            )}
          />

          <Controller
            control={form.control}
            name="taxClass"
            render={({ field }) => (
              <Field className="gap-2">
                <FieldLabel htmlFor={field.name}>Default Tax Class</FieldLabel>
                <Select
                  items={taxClasses}
                  onValueChange={field.onChange}
                  value={field.value}
                >
                  <SelectTrigger className="w-full" id={field.name}>
                    <SelectValue placeholder="Select a tax class" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {taxClasses.map((taxClass) => (
                        <SelectItem key={taxClass.value} value={taxClass.value}>
                          {taxClass.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            )}
          />

          <Controller
            control={form.control}
            name="priceInclusive"
            render={({ field }) => (
              <Field className="sm:col-span-2" orientation="horizontal">
                <FieldContent>
                  <FieldLabel htmlFor={field.name}>
                    Tax-inclusive Pricing
                  </FieldLabel>
                  <FieldDescription>
                    Display prices with tax already included
                  </FieldDescription>
                </FieldContent>
                <Switch
                  checked={field.value}
                  id={field.name}
                  onCheckedChange={(checked) =>
                    field.onChange(Boolean(checked))
                  }
                />
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
        <Button form="wizard-operations" type="submit">
          Next
          <ArrowRightIcon />
        </Button>
      </div>
    </CardContent>
  );
};

export default OperationsStep;
