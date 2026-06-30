// React Imports

// Component Imports
import { Button } from "@RetailOS/ui/components/button";
import { Checkbox } from "@RetailOS/ui/components/checkbox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@RetailOS/ui/components/field";
import { Input } from "@RetailOS/ui/components/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@RetailOS/ui/components/input-group";
import { Label } from "@RetailOS/ui/components/label";
import {
  RadioGroup,
  RadioGroupItem,
} from "@RetailOS/ui/components/radio-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@RetailOS/ui/components/select";
import { Separator } from "@RetailOS/ui/components/separator";
import { Switch } from "@RetailOS/ui/components/switch";
import { Textarea } from "@RetailOS/ui/components/textarea";
// Third-party Imports
import { zodResolver } from "@hookform/resolvers/zod";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import * as z from "zod";

const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;

const formSchema = z.object({
  customerName: z
    .string()
    .min(1, "Customer name is required.")
    .min(3, "Customer name must be at least 3 characters.")
    .max(80, "Customer name must be at most 80 characters."),
  email: z
    .string()
    .min(1, "Email is required.")
    .email("Please enter a valid email address."),
  portalPassword: z
    .string()
    .min(1, "A storefront password is required.")
    .min(8, "Password must be at least 8 characters.")
    .max(100, "Password must be at most 100 characters.")
    .regex(
      PASSWORD_PATTERN,
      "Password must contain at least one uppercase letter, one lowercase letter, and one number."
    ),
  customerSince: z.string().min(1, "Customer since date is required."),
  country: z.string().min(1, "Please select a country."),
  currency: z.string().optional(),
  notes: z
    .string()
    .min(1, "Notes are required.")
    .min(20, "Notes must be at least 20 characters.")
    .max(500, "Notes must be at most 500 characters."),
  tags: z.array(z.string()).min(1, "Please select at least one customer tag."),
  customerType: z.enum(["retail", "wholesale", "enterprise"], {
    message: "Please select a customer type.",
  }),
  creditLimit: z
    .number({ message: "Please enter a valid amount." })
    .int("Credit limit must be a whole number.")
    .min(0, "Credit limit cannot be negative.")
    .max(100_000_000, "Please enter a realistic credit limit."),
  emailReceipts: z.boolean(),
  marketingOptIn: z.boolean(),
  taxExempt: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

const countries = [
  { value: "gy", label: "Guyana" },
  { value: "tt", label: "Trinidad & Tobago" },
  { value: "sr", label: "Suriname" },
  { value: "bb", label: "Barbados" },
  { value: "us", label: "United States" },
];

const currencies = [
  { value: "gyd", label: "GYD — Guyanese Dollar" },
  { value: "usd", label: "USD — US Dollar" },
  { value: "ttd", label: "TTD — Trinidad Dollar" },
];

const customerTags = [
  { id: "wholesale", label: "Wholesale Account" },
  { id: "vip", label: "VIP / Loyalty" },
  { id: "credit", label: "Credit Customer" },
];

const customerTypes = [
  {
    id: "retail",
    title: "Retail",
    description: "Walk-in and storefront customers",
  },
  {
    id: "wholesale",
    title: "Wholesale",
    description: "Bulk buyers on tiered pricing",
  },
  {
    id: "enterprise",
    title: "Enterprise",
    description: "Contract accounts with terms",
  },
] as const;

const communicationSettings = [
  {
    name: "emailReceipts" as const,
    label: "Email Receipts",
    description: "Send a receipt copy after every sale",
  },
  {
    name: "marketingOptIn" as const,
    label: "Marketing Emails",
    description: "Promotions, price drops and new arrivals",
  },
  {
    name: "taxExempt" as const,
    label: "Tax Exempt",
    description: "Customer holds a valid tax-exemption certificate",
  },
];

const NewCustomerForm = () => {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    mode: "onBlur",
    defaultValues: {
      customerName: "",
      email: "",
      portalPassword: "",
      customerSince: "",
      notes: "",
      currency: "",
      tags: [],
      creditLimit: undefined,
      emailReceipts: true,
      marketingOptIn: false,
      taxExempt: false,
    },
  });

  function onSubmit(_data: FormValues) {
    // Sample form — wiring to oRPC is out of scope.
    form.reset();
  }

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={form.handleSubmit(onSubmit)}
    >
      <div>
        <h3 className="font-semibold text-lg">Customer Information</h3>
        <p className="text-muted-foreground">
          Please provide the customer's basic account details
        </p>
      </div>

      <FieldGroup className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Controller
          control={form.control}
          name="customerName"
          render={({ field, fieldState }) => (
            <Field className="gap-2" data-invalid={fieldState.invalid}>
              <FieldLabel className="leading-none" htmlFor={field.name}>
                Customer Name
              </FieldLabel>
              <Input
                {...field}
                aria-invalid={fieldState.invalid}
                autoComplete="organization"
                id={field.name}
                placeholder="Ramotar Trading Ltd."
              />
              <FieldDescription>
                Business or full name as it appears on invoices
              </FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Controller
          control={form.control}
          name="email"
          render={({ field, fieldState }) => (
            <Field className="gap-2" data-invalid={fieldState.invalid}>
              <FieldLabel className="leading-none" htmlFor={field.name}>
                Email Address
              </FieldLabel>
              <Input
                {...field}
                aria-invalid={fieldState.invalid}
                autoComplete="email"
                id={field.name}
                placeholder="accounts@ramotar.gy"
                type="email"
              />
              <FieldDescription>
                Receipts and statements are sent here
              </FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Controller
          control={form.control}
          name="portalPassword"
          render={({ field, fieldState }) => (
            <Field
              className="gap-2 sm:col-span-2"
              data-invalid={fieldState.invalid}
            >
              <FieldLabel className="leading-none" htmlFor={field.name}>
                Storefront Password
              </FieldLabel>
              <InputGroup className="w-full">
                <InputGroupInput
                  {...field}
                  aria-invalid={fieldState.invalid}
                  autoComplete="new-password"
                  id={field.name}
                  placeholder="••••••••"
                  type={isPasswordVisible ? "text" : "password"}
                />
                <InputGroupAddon align="inline-end">
                  <Button
                    className="rounded-l-none text-muted-foreground hover:bg-transparent focus-visible:ring-ring/50"
                    onClick={() => setIsPasswordVisible((prev) => !prev)}
                    size="icon"
                    type="button"
                    variant="ghost"
                  >
                    {isPasswordVisible ? <EyeOffIcon /> : <EyeIcon />}
                    <span className="sr-only">
                      {isPasswordVisible ? "Hide password" : "Show password"}
                    </span>
                  </Button>
                </InputGroupAddon>
              </InputGroup>
              <FieldDescription>
                Used for the online storefront — at least 8 characters with
                upper, lower and a number
              </FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </FieldGroup>

      <Separator />

      <div>
        <h3 className="font-semibold text-lg">Account Details</h3>
        <p className="text-muted-foreground">Trading terms and preferences</p>
      </div>

      <FieldGroup className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Controller
          control={form.control}
          name="customerSince"
          render={({ field, fieldState }) => (
            <Field className="gap-2" data-invalid={fieldState.invalid}>
              <FieldLabel className="leading-none" htmlFor={field.name}>
                Customer Since
              </FieldLabel>
              <Input
                {...field}
                aria-invalid={fieldState.invalid}
                id={field.name}
                type="date"
              />
              <FieldDescription>Date the account was opened</FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Controller
          control={form.control}
          name="creditLimit"
          render={({ field, fieldState }) => (
            <Field className="gap-2" data-invalid={fieldState.invalid}>
              <FieldLabel className="leading-none" htmlFor={field.name}>
                Credit Limit (GYD)
              </FieldLabel>
              <Input
                aria-invalid={fieldState.invalid}
                id={field.name}
                max={100_000_000}
                min={0}
                name={field.name}
                onBlur={field.onBlur}
                onChange={(e) => {
                  const value = e.target.value;
                  field.onChange(
                    value === "" ? undefined : Number.parseInt(value, 10)
                  );
                }}
                placeholder="0"
                ref={field.ref}
                type="number"
                value={field.value ?? ""}
              />
              <FieldDescription>
                Maximum outstanding balance allowed on account
              </FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Controller
          control={form.control}
          name="country"
          render={({ field, fieldState }) => (
            <Field className="gap-2" data-invalid={fieldState.invalid}>
              <FieldLabel className="leading-none" htmlFor={field.name}>
                Country
              </FieldLabel>
              <Select
                items={countries}
                onValueChange={field.onChange}
                value={field.value}
              >
                <SelectTrigger
                  aria-invalid={fieldState.invalid}
                  className="w-full"
                  id={field.name}
                >
                  <SelectValue placeholder="Select a country" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {countries.map((country) => (
                      <SelectItem key={country.value} value={country.value}>
                        {country.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldDescription>Country of operation</FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Controller
          control={form.control}
          name="currency"
          render={({ field, fieldState }) => (
            <Field className="gap-2" data-invalid={fieldState.invalid}>
              <FieldLabel className="leading-none" htmlFor={field.name}>
                Preferred Currency{" "}
                <span className="font-normal text-muted-foreground">
                  (Optional)
                </span>
              </FieldLabel>
              <Select
                items={currencies}
                onValueChange={field.onChange}
                value={field.value || undefined}
              >
                <SelectTrigger
                  aria-invalid={fieldState.invalid}
                  className="w-full"
                  id={field.name}
                >
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
              <FieldDescription>
                Currency this customer is billed in
              </FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Controller
          control={form.control}
          name="notes"
          render={({ field, fieldState }) => (
            <Field
              className="gap-2 sm:col-span-2"
              data-invalid={fieldState.invalid}
            >
              <FieldLabel className="leading-none" htmlFor={field.name}>
                Notes
              </FieldLabel>
              <Textarea
                {...field}
                aria-invalid={fieldState.invalid}
                className="min-h-15 resize-none"
                id={field.name}
                placeholder="Delivery instructions, payment terms, key contacts..."
              />
              <FieldDescription>
                Internal notes for staff ({field.value.length}/500 characters)
              </FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </FieldGroup>

      <Separator />

      <div className="space-y-6">
        <div>
          <h3 className="font-semibold text-lg">Preferences</h3>
          <p className="text-muted-foreground text-sm">
            Tags, type and communication settings
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Controller
            control={form.control}
            name="tags"
            render={({ field, fieldState }) => (
              <FieldSet className="h-full">
                <FieldLegend variant="label">Customer Tags</FieldLegend>
                <FieldDescription>
                  Choose all tags that apply to this customer
                </FieldDescription>
                <FieldGroup className="gap-3" data-slot="checkbox-group">
                  {customerTags.map((tag) => (
                    <div
                      className="relative rounded-lg border border-input transition-colors hover:bg-accent/50 has-data-checked:border-primary"
                      key={tag.id}
                    >
                      <Label
                        className="flex cursor-pointer items-center gap-3 p-4 font-normal"
                        htmlFor={`tag-${tag.id}`}
                      >
                        <Checkbox
                          aria-invalid={fieldState.invalid}
                          checked={field.value.includes(tag.id)}
                          id={`tag-${tag.id}`}
                          onCheckedChange={(checked) => {
                            const newValue = checked
                              ? [...field.value, tag.id]
                              : field.value.filter((value) => value !== tag.id);
                            field.onChange(newValue);
                          }}
                        />
                        {tag.label}
                      </Label>
                    </div>
                  ))}
                </FieldGroup>
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </FieldSet>
            )}
          />

          <FieldSet>
            <FieldLegend variant="label">Communication Settings</FieldLegend>
            <FieldDescription>
              Manage how this customer is contacted
            </FieldDescription>
            <FieldGroup className="gap-4">
              {communicationSettings.map(({ name, label, description }) => (
                <Controller
                  control={form.control}
                  key={name}
                  name={name}
                  render={({ field, fieldState }) => (
                    <Field
                      data-invalid={fieldState.invalid}
                      orientation="horizontal"
                    >
                      <FieldContent>
                        <FieldLabel htmlFor={name}>{label}</FieldLabel>
                        <FieldDescription>{description}</FieldDescription>
                        {fieldState.invalid && (
                          <FieldError errors={[fieldState.error]} />
                        )}
                      </FieldContent>
                      <Switch
                        aria-invalid={fieldState.invalid}
                        checked={field.value}
                        id={name}
                        onCheckedChange={(checked) =>
                          field.onChange(Boolean(checked))
                        }
                      />
                    </Field>
                  )}
                />
              ))}
            </FieldGroup>
          </FieldSet>
        </div>

        <Controller
          control={form.control}
          name="customerType"
          render={({ field, fieldState }) => (
            <FieldSet className="h-full">
              <FieldLegend variant="label">Customer Type</FieldLegend>
              <FieldDescription>
                Determines pricing tier and credit behaviour
              </FieldDescription>
              <RadioGroup
                className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3"
                onValueChange={field.onChange}
                value={field.value}
              >
                {customerTypes.map((type) => (
                  <div
                    className="relative rounded-lg border border-input transition-colors hover:bg-accent/50 has-data-checked:border-primary"
                    key={type.id}
                  >
                    <div className="flex items-start gap-3 p-4">
                      <RadioGroupItem
                        aria-describedby={`type-${type.id}-description`}
                        aria-invalid={fieldState.invalid}
                        className="mt-0.5"
                        id={`type-${type.id}`}
                        value={type.id}
                      />
                      <div className="space-y-1">
                        <Label
                          className="cursor-pointer font-medium after:absolute after:inset-0"
                          htmlFor={`type-${type.id}`}
                        >
                          {type.title}
                        </Label>
                        <p
                          className="text-muted-foreground text-sm"
                          id={`type-${type.id}-description`}
                        >
                          {type.description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </RadioGroup>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </FieldSet>
          )}
        />
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit">Create Customer</Button>
        <Button onClick={() => form.reset()} type="button" variant="outline">
          Reset
        </Button>
      </div>
    </form>
  );
};

export default NewCustomerForm;
