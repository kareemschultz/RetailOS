// Component Imports
import { Button } from "@RetailOS/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@RetailOS/ui/components/field";
import { Input } from "@RetailOS/ui/components/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@RetailOS/ui/components/input-group";
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

const locationTypes = [
  { value: "store", label: "Retail Store" },
  { value: "warehouse", label: "Warehouse" },
  { value: "bonded", label: "Bonded Warehouse" },
  { value: "fulfillment", label: "Fulfillment Center" },
];

const currencies = [
  { value: "gyd", label: "GYD — Guyanese Dollar" },
  { value: "usd", label: "USD — US Dollar" },
  { value: "ttd", label: "TTD — Trinidad Dollar" },
];

const timezones = [
  { value: "america/guyana", label: "America/Guyana (GYT)" },
  { value: "america/port_of_spain", label: "America/Port_of_Spain (AST)" },
  { value: "america/paramaribo", label: "America/Paramaribo (SRT)" },
];

const CreateStoreForm = () => (
  <form>
    <div className="mb-6">
      <h3 className="font-semibold text-base">1. Store Details</h3>
    </div>

    <FieldGroup className="grid gap-6 sm:grid-cols-2">
      <Field className="gap-2">
        <FieldLabel htmlFor="store-name">Store Name</FieldLabel>
        <Input id="store-name" placeholder="Georgetown Main Branch" />
      </Field>

      <Field className="gap-2">
        <FieldLabel htmlFor="store-code">Location Code</FieldLabel>
        <InputGroup>
          <InputGroupAddon className="font-normal text-foreground">
            GT-
          </InputGroupAddon>
          <InputGroupInput id="store-code" placeholder="001" />
        </InputGroup>
      </Field>

      <Field className="gap-2">
        <FieldLabel htmlFor="store-type">Location Type</FieldLabel>
        <Select items={locationTypes}>
          <SelectTrigger className="w-full" id="store-type">
            <SelectValue placeholder="Select a type" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {locationTypes.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>

      <Field className="gap-2">
        <FieldLabel htmlFor="store-phone">Store Phone</FieldLabel>
        <Input id="store-phone" placeholder="+592 226 0000" type="tel" />
      </Field>

      <Field className="gap-2 sm:col-span-2">
        <FieldLabel htmlFor="store-address">Address</FieldLabel>
        <Input id="store-address" placeholder="45 Robb Street, Georgetown" />
      </Field>
    </FieldGroup>

    <Separator className="my-8" />

    <div className="mb-6">
      <h3 className="font-semibold text-base">2. Operations</h3>
    </div>

    <FieldGroup className="grid gap-6 sm:grid-cols-2">
      <Field className="gap-2">
        <FieldLabel htmlFor="store-currency">Base Currency</FieldLabel>
        <Select items={currencies}>
          <SelectTrigger className="w-full" id="store-currency">
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

      <Field className="gap-2">
        <FieldLabel htmlFor="store-timezone">Timezone</FieldLabel>
        <Select items={timezones}>
          <SelectTrigger className="w-full" id="store-timezone">
            <SelectValue placeholder="Select a timezone" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {timezones.map((timezone) => (
                <SelectItem key={timezone.value} value={timezone.value}>
                  {timezone.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>

      <Field className="gap-2 sm:col-span-2" orientation="horizontal">
        <Switch defaultChecked id="store-pos" />
        <FieldLabel className="font-normal" htmlFor="store-pos">
          Enable point-of-sale at this location
        </FieldLabel>
      </Field>

      <Field className="gap-2 sm:col-span-2" orientation="horizontal">
        <Switch id="store-ecommerce" />
        <FieldLabel className="font-normal" htmlFor="store-ecommerce">
          Allow this location to fulfill online orders
        </FieldLabel>
      </Field>
    </FieldGroup>

    <div className="mt-8 flex gap-3">
      <Button type="submit">Create Store</Button>
      <Button type="reset" variant="outline">
        Cancel
      </Button>
    </div>
  </form>
);

export default CreateStoreForm;
