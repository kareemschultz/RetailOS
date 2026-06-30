// Component Imports
import { Button } from "@RetailOS/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@RetailOS/ui/components/field";
import { Input } from "@RetailOS/ui/components/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@RetailOS/ui/components/select";

const categories = [
  { value: "beverages", label: "Beverages" },
  { value: "hardware", label: "Hardware" },
  { value: "pharmacy", label: "Pharmacy" },
  { value: "electronics", label: "Electronics" },
  { value: "groceries", label: "Groceries" },
];

const uoms = [
  { value: "each", label: "Each" },
  { value: "carton", label: "Carton" },
  { value: "case", label: "Case" },
  { value: "kg", label: "Kilogram" },
];

const AddProductForm = () => (
  <form>
    <FieldGroup className="grid grid-cols-1 gap-6 sm:grid-cols-2">
      <Field className="gap-2 sm:col-span-2">
        <FieldLabel htmlFor="product-name">Product Name</FieldLabel>
        <Input id="product-name" placeholder="Banks Beer 275ml" />
      </Field>

      <Field className="gap-2">
        <FieldLabel htmlFor="product-sku">SKU</FieldLabel>
        <Input id="product-sku" placeholder="BNK-275-CL" />
      </Field>

      <Field className="gap-2">
        <FieldLabel htmlFor="product-barcode">Barcode</FieldLabel>
        <Input id="product-barcode" placeholder="0712345678901" />
      </Field>

      <Field className="gap-2">
        <FieldLabel htmlFor="product-category">Category</FieldLabel>
        <Select items={categories}>
          <SelectTrigger className="w-full" id="product-category">
            <SelectValue placeholder="Select a category" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {categories.map((category) => (
                <SelectItem key={category.value} value={category.value}>
                  {category.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>

      <Field className="gap-2">
        <FieldLabel htmlFor="product-uom">Stocking Unit</FieldLabel>
        <Select items={uoms}>
          <SelectTrigger className="w-full" id="product-uom">
            <SelectValue placeholder="Select a unit" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {uoms.map((uom) => (
                <SelectItem key={uom.value} value={uom.value}>
                  {uom.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>

      <Field className="gap-2">
        <FieldLabel htmlFor="product-cost">Cost (GYD)</FieldLabel>
        <Input id="product-cost" placeholder="0" type="number" />
      </Field>

      <Field className="gap-2">
        <FieldLabel htmlFor="product-price">Sell Price (GYD)</FieldLabel>
        <Input id="product-price" placeholder="0" type="number" />
      </Field>
    </FieldGroup>

    <div className="mt-8">
      <Button type="submit">Save Product</Button>
    </div>
  </form>
);

export default AddProductForm;
