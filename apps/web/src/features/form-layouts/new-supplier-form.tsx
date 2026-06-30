// Third-party Imports

// Component Imports
import { Button } from "@RetailOS/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@RetailOS/ui/components/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@RetailOS/ui/components/input-group";
import {
  AtSignIcon,
  Building2Icon,
  HashIcon,
  MapPinIcon,
  PhoneIcon,
  UserIcon,
} from "lucide-react";

const NewSupplierForm = () => (
  <form>
    <FieldGroup className="grid grid-cols-1 gap-6 sm:grid-cols-2">
      <Field className="gap-2 sm:col-span-2">
        <FieldLabel htmlFor="supplier-company">Company Name</FieldLabel>
        <InputGroup>
          <InputGroupAddon>
            <Building2Icon className="size-4" />
            <span className="sr-only">Company Name</span>
          </InputGroupAddon>
          <InputGroupInput
            id="supplier-company"
            placeholder="Caribbean Distributors Inc."
          />
        </InputGroup>
      </Field>

      <Field className="gap-2">
        <FieldLabel htmlFor="supplier-contact">Contact Person</FieldLabel>
        <InputGroup>
          <InputGroupAddon>
            <UserIcon className="size-4" />
            <span className="sr-only">Contact Person</span>
          </InputGroupAddon>
          <InputGroupInput id="supplier-contact" placeholder="Marcus Persaud" />
        </InputGroup>
      </Field>

      <Field className="gap-2">
        <FieldLabel htmlFor="supplier-phone">Phone</FieldLabel>
        <InputGroup>
          <InputGroupAddon>
            <PhoneIcon className="size-4" />
            <span className="sr-only">Phone</span>
          </InputGroupAddon>
          <InputGroupInput
            id="supplier-phone"
            placeholder="+592 600 1234"
            type="tel"
          />
        </InputGroup>
      </Field>

      <Field className="gap-2">
        <FieldLabel htmlFor="supplier-email">Email</FieldLabel>
        <InputGroup>
          <InputGroupAddon>
            <AtSignIcon className="size-4" />
            <span className="sr-only">Email</span>
          </InputGroupAddon>
          <InputGroupInput
            id="supplier-email"
            placeholder="sales@caribdist.gy"
            type="email"
          />
        </InputGroup>
      </Field>

      <Field className="gap-2">
        <FieldLabel htmlFor="supplier-tin">Tax ID (TIN)</FieldLabel>
        <InputGroup>
          <InputGroupAddon>
            <HashIcon className="size-4" />
            <span className="sr-only">Tax ID</span>
          </InputGroupAddon>
          <InputGroupInput id="supplier-tin" placeholder="GY-123456789" />
        </InputGroup>
      </Field>

      <Field className="gap-2 sm:col-span-2">
        <FieldLabel htmlFor="supplier-address">Address</FieldLabel>
        <InputGroup>
          <InputGroupAddon>
            <MapPinIcon className="size-4" />
            <span className="sr-only">Address</span>
          </InputGroupAddon>
          <InputGroupInput
            id="supplier-address"
            placeholder="12 Water Street, Georgetown"
          />
        </InputGroup>
      </Field>
    </FieldGroup>

    <div className="mt-8">
      <Button type="submit">Save Supplier</Button>
    </div>
  </form>
);

export default NewSupplierForm;
