// Component Imports
import { Button } from "@RetailOS/ui/components/button";
import { Card, CardContent } from "@RetailOS/ui/components/card";
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
import { Switch } from "@RetailOS/ui/components/switch";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@RetailOS/ui/components/tabs";
import { Textarea } from "@RetailOS/ui/components/textarea";

const taxClasses = [
  { value: "standard", label: "Standard VAT (14%)" },
  { value: "zero", label: "Zero-rated" },
  { value: "exempt", label: "Tax exempt" },
];

const costingMethods = [
  { value: "avco", label: "Average Cost (AVCO)" },
  { value: "fifo", label: "First In, First Out (FIFO)" },
];

const ProductTabsForm = () => (
  <Card>
    <CardContent>
      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="pricing">Pricing</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
        </TabsList>

        <TabsContent className="pt-6" value="general">
          <FieldGroup className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <Field className="gap-2">
              <FieldLabel htmlFor="tabs-name">Product Name</FieldLabel>
              <Input id="tabs-name" placeholder="Premium Engine Oil 5L" />
            </Field>
            <Field className="gap-2">
              <FieldLabel htmlFor="tabs-brand">Brand</FieldLabel>
              <Input id="tabs-brand" placeholder="Castrol" />
            </Field>
            <Field className="gap-2 sm:col-span-2">
              <FieldLabel htmlFor="tabs-description">Description</FieldLabel>
              <Textarea
                className="min-h-20 resize-none"
                id="tabs-description"
                placeholder="Short description shown on receipts and the storefront."
              />
            </Field>
          </FieldGroup>
        </TabsContent>

        <TabsContent className="pt-6" value="pricing">
          <FieldGroup className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <Field className="gap-2">
              <FieldLabel htmlFor="tabs-retail">Retail Price (GYD)</FieldLabel>
              <InputGroup>
                <InputGroupAddon className="font-normal text-foreground">
                  $
                </InputGroupAddon>
                <InputGroupInput
                  id="tabs-retail"
                  placeholder="0"
                  type="number"
                />
              </InputGroup>
            </Field>
            <Field className="gap-2">
              <FieldLabel htmlFor="tabs-wholesale">
                Wholesale Price (GYD)
              </FieldLabel>
              <InputGroup>
                <InputGroupAddon className="font-normal text-foreground">
                  $
                </InputGroupAddon>
                <InputGroupInput
                  id="tabs-wholesale"
                  placeholder="0"
                  type="number"
                />
              </InputGroup>
            </Field>
            <Field className="gap-2">
              <FieldLabel htmlFor="tabs-tax">Tax Class</FieldLabel>
              <Select items={taxClasses}>
                <SelectTrigger className="w-full" id="tabs-tax">
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
            <Field className="gap-2 sm:col-span-2" orientation="horizontal">
              <Switch id="tabs-price-inclusive" />
              <FieldLabel
                className="font-normal"
                htmlFor="tabs-price-inclusive"
              >
                Prices include tax
              </FieldLabel>
            </Field>
          </FieldGroup>
        </TabsContent>

        <TabsContent className="pt-6" value="inventory">
          <FieldGroup className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <Field className="gap-2">
              <FieldLabel htmlFor="tabs-reorder">Reorder Level</FieldLabel>
              <Input id="tabs-reorder" placeholder="24" type="number" />
            </Field>
            <Field className="gap-2">
              <FieldLabel htmlFor="tabs-costing">Costing Method</FieldLabel>
              <Select items={costingMethods}>
                <SelectTrigger className="w-full" id="tabs-costing">
                  <SelectValue placeholder="Select a method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {costingMethods.map((method) => (
                      <SelectItem key={method.value} value={method.value}>
                        {method.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field className="gap-2 sm:col-span-2" orientation="horizontal">
              <Switch defaultChecked id="tabs-track" />
              <FieldLabel className="font-normal" htmlFor="tabs-track">
                Track stock for this product
              </FieldLabel>
            </Field>
          </FieldGroup>
        </TabsContent>
      </Tabs>

      <div className="mt-8 flex gap-3">
        <Button type="submit">Save Changes</Button>
        <Button type="reset" variant="outline">
          Discard
        </Button>
      </div>
    </CardContent>
  </Card>
);

export default ProductTabsForm;
