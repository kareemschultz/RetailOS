// Component Imports
import { Card, CardContent } from "@RetailOS/ui/components/card";
import NewCustomerForm from "./new-customer-form";
import ValidationTypes from "./validation-types";

const FormValidation = () => (
  <div className="flex flex-col gap-8">
    <div className="space-y-3">
      <h2 className="font-semibold text-lg">Validation Types</h2>
      <Card>
        <CardContent>
          <ValidationTypes />
        </CardContent>
      </Card>
    </div>

    <div className="space-y-3">
      <h2 className="font-semibold text-lg">New Customer Account</h2>
      <Card>
        <CardContent>
          <NewCustomerForm />
        </CardContent>
      </Card>
    </div>
  </div>
);

export default FormValidation;
