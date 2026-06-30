import StoreSetupWizard from "./store-setup-wizard";

const FormWizard = () => (
  <div className="flex flex-col gap-8">
    <div className="space-y-4">
      <h2 className="font-semibold text-lg">New Store Setup</h2>
      <StoreSetupWizard />
    </div>
  </div>
);

export default FormWizard;
