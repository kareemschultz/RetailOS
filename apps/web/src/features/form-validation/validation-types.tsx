// Third-party Imports

// Component Imports
import { Button } from "@RetailOS/ui/components/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@RetailOS/ui/components/field";
import { Input } from "@RetailOS/ui/components/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import * as z from "zod";

const SKU_PATTERN = /^[A-Za-z0-9-]+$/;
const BARCODE_PATTERN = /^\d{12,13}$/;
const DIGITS_ONLY = /^\d+$/;

const formSchema = z.object({
  sku: z
    .string()
    .min(1, "SKU is required.")
    .regex(SKU_PATTERN, "Only letters, numbers and dashes are allowed."),
  barcode: z
    .string()
    .min(1, "Barcode is required.")
    .regex(BARCODE_PATTERN, "Barcode must be 12 or 13 digits (UPC/EAN)."),
  quantity: z
    .string()
    .min(1, "Quantity is required.")
    .regex(DIGITS_ONLY, "Quantity must be a whole number."),
  price: z
    .number({ message: "Enter a price between 1 and 1,000,000." })
    .min(1, "Enter a price between 1 and 1,000,000.")
    .max(1_000_000, "Enter a price between 1 and 1,000,000."),
  supplierEmail: z
    .string()
    .min(1, "Supplier email is required.")
    .email("Must be a valid email address."),
  storefrontUrl: z
    .string()
    .min(1, "Storefront URL is required.")
    .url("Must be a valid URL."),
});

type FormValues = z.infer<typeof formSchema>;

const defaultValues: FormValues = {
  sku: "",
  barcode: "",
  quantity: "",
  price: undefined as unknown as number,
  supplierEmail: "",
  storefrontUrl: "",
};

const ValidationTypes = () => {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
    defaultValues,
  });

  function onSubmit(_data: FormValues) {
    form.reset();
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <FieldGroup className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Controller
          control={form.control}
          name="sku"
          render={({ field, fieldState }) => (
            <Field className="gap-2" data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>SKU</FieldLabel>
              <Input
                {...field}
                aria-invalid={fieldState.invalid}
                id={field.name}
                placeholder="BNK-275-CL"
              />
              <FieldDescription>Letters, numbers and dashes</FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Controller
          control={form.control}
          name="barcode"
          render={({ field, fieldState }) => (
            <Field className="gap-2" data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>Barcode (UPC/EAN)</FieldLabel>
              <Input
                {...field}
                aria-invalid={fieldState.invalid}
                id={field.name}
                inputMode="numeric"
                placeholder="0712345678901"
              />
              <FieldDescription>Exactly 12 or 13 digits</FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Controller
          control={form.control}
          name="quantity"
          render={({ field, fieldState }) => (
            <Field className="gap-2" data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>Quantity on Hand</FieldLabel>
              <Input
                {...field}
                aria-invalid={fieldState.invalid}
                id={field.name}
                inputMode="numeric"
                placeholder="120"
              />
              <FieldDescription>Whole numbers only</FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Controller
          control={form.control}
          name="price"
          render={({ field, fieldState }) => (
            <Field className="gap-2" data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>Sell Price (GYD)</FieldLabel>
              <Input
                aria-invalid={fieldState.invalid}
                id={field.name}
                name={field.name}
                onBlur={field.onBlur}
                onChange={(e) => {
                  const value = e.target.value;
                  field.onChange(
                    value === "" ? undefined : Number.parseInt(value, 10)
                  );
                }}
                placeholder="650"
                ref={field.ref}
                type="number"
                value={field.value ?? ""}
              />
              <FieldDescription>Between 1 and 1,000,000</FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Controller
          control={form.control}
          name="supplierEmail"
          render={({ field, fieldState }) => (
            <Field className="gap-2" data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>Supplier Email</FieldLabel>
              <Input
                {...field}
                aria-invalid={fieldState.invalid}
                id={field.name}
                placeholder="sales@caribdist.gy"
                type="email"
              />
              <FieldDescription>Must be a valid email</FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Controller
          control={form.control}
          name="storefrontUrl"
          render={({ field, fieldState }) => (
            <Field className="gap-2" data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>Storefront URL</FieldLabel>
              <Input
                {...field}
                aria-invalid={fieldState.invalid}
                id={field.name}
                placeholder="https://shop.retailos.gy"
              />
              <FieldDescription>Must be a valid URL</FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </FieldGroup>

      <div className="mt-8 flex gap-3">
        <Button type="submit">Validate</Button>
        <Button onClick={() => form.reset()} type="button" variant="outline">
          Reset
        </Button>
      </div>
    </form>
  );
};

export default ValidationTypes;
