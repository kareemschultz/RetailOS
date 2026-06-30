// Component Imports
import { Card, CardContent } from "@RetailOS/ui/components/card";
import AddProductForm from "./add-product-form";
import CreateStoreForm from "./create-store-form";
import NewSupplierForm from "./new-supplier-form";
import ProductTabsForm from "./product-tabs-form";

const FormLayouts = () => (
  <div className="flex flex-col gap-6">
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-3">
        <h2 className="font-semibold text-lg">Add Product</h2>
        <Card>
          <CardContent>
            <AddProductForm />
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        <h2 className="font-semibold text-lg">New Supplier (with icons)</h2>
        <Card>
          <CardContent>
            <NewSupplierForm />
          </CardContent>
        </Card>
      </div>
    </div>

    <div className="space-y-3">
      <h2 className="font-semibold text-lg">Create Store (multi-section)</h2>
      <Card>
        <CardContent>
          <CreateStoreForm />
        </CardContent>
      </Card>
    </div>

    <div className="space-y-3">
      <h2 className="font-semibold text-lg">Product Configuration (tabs)</h2>
      <ProductTabsForm />
    </div>
  </div>
);

export default FormLayouts;
