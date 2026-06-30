// React Imports

// Component Imports
import { Avatar, AvatarFallback } from "@RetailOS/ui/components/avatar";
import { Card, CardContent } from "@RetailOS/ui/components/card";
import { cn } from "@RetailOS/ui/lib/utils";
import { useState } from "react";

import CompanyStep from "./steps/company-step";
import CompleteStep from "./steps/complete-step";
import LocationStep from "./steps/location-step";
import OperationsStep from "./steps/operations-step";
import ReviewStep from "./steps/review-step";
import {
  type CompanyValues,
  defaultWizardData,
  type LocationValues,
  type OperationsValues,
  type WizardData,
} from "./types";

const steps = [
  { id: "company", title: "Company", description: "Business details" },
  { id: "location", title: "Location", description: "Store address" },
  { id: "operations", title: "Tax & Currency", description: "Pricing rules" },
  { id: "review", title: "Review", description: "Confirm setup" },
] as const;

const COMPLETE_INDEX = steps.length;

const StoreSetupWizard = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [data, setData] = useState<WizardData>(defaultWizardData);

  const saveCompany = (company: CompanyValues) => {
    setData((prev) => ({ ...prev, company }));
    setCurrentStep(1);
  };

  const saveLocation = (location: LocationValues) => {
    setData((prev) => ({ ...prev, location }));
    setCurrentStep(2);
  };

  const saveOperations = (operations: OperationsValues) => {
    setData((prev) => ({ ...prev, operations }));
    setCurrentStep(3);
  };

  const confirm = () => setCurrentStep(COMPLETE_INDEX);

  const reset = () => {
    setData(defaultWizardData);
    setCurrentStep(0);
  };

  const isComplete = currentStep === COMPLETE_INDEX;

  return (
    <Card className="gap-0 p-0 md:grid md:max-lg:grid-cols-5 lg:grid-cols-4">
      <CardContent className="col-span-5 p-6 max-md:border-b md:border-r md:max-lg:col-span-2 lg:col-span-1">
        <nav aria-label="Store Setup Steps">
          <ol className="flex flex-col justify-between gap-x-2 gap-y-6">
            {steps.map((step, index) => (
              <li key={step.id}>
                <div className="flex shrink-0 items-center gap-2">
                  <Avatar className="size-10.5">
                    <AvatarFallback
                      className={cn("font-semibold text-sm", {
                        "bg-primary text-primary-foreground shadow-sm":
                          index <= currentStep,
                      })}
                    >
                      {index + 1}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col items-start">
                    <span className="text-base">{step.title}</span>
                    <span className="text-muted-foreground text-sm">
                      {step.description}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </nav>
      </CardContent>

      {currentStep === 0 && (
        <CompanyStep defaultValues={data.company} onNext={saveCompany} />
      )}
      {currentStep === 1 && (
        <LocationStep
          defaultValues={data.location}
          onBack={() => setCurrentStep(0)}
          onNext={saveLocation}
        />
      )}
      {currentStep === 2 && (
        <OperationsStep
          defaultValues={data.operations}
          onBack={() => setCurrentStep(1)}
          onNext={saveOperations}
        />
      )}
      {currentStep === 3 && (
        <ReviewStep
          data={data}
          onBack={() => setCurrentStep(2)}
          onConfirm={confirm}
        />
      )}
      {isComplete && <CompleteStep onReset={reset} />}
    </Card>
  );
};

export default StoreSetupWizard;
