export type CompanyValues = {
  companyName: string;
  tradeName: string;
  tin: string;
};

export type LocationValues = {
  storeName: string;
  address: string;
  city: string;
};

export type OperationsValues = {
  currency: string;
  taxClass: string;
  priceInclusive: boolean;
};

export type WizardData = {
  company: CompanyValues;
  location: LocationValues;
  operations: OperationsValues;
};

export const defaultWizardData: WizardData = {
  company: {
    companyName: "",
    tradeName: "",
    tin: "",
  },
  location: {
    storeName: "",
    address: "",
    city: "",
  },
  operations: {
    currency: "gyd",
    taxClass: "standard",
    priceInclusive: false,
  },
};

export type StepControls = {
  onBack?: () => void;
  onReset?: () => void;
};
