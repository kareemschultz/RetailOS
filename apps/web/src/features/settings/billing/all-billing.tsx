import { Progress } from "@RetailOS/ui/components/progress";
import { Separator } from "@RetailOS/ui/components/separator";

const Billing = () => {
  const progressSections = [
    {
      id: "storage",
      title: "Storage",
      value: 50,
      usedText: "Used 50.1 GB",
      includedText: "100 GB included",
      price: "$70",
    },
    {
      id: "api",
      title: "API Requests",
      value: 30,
      usedText: "Used 30 prompts",
      includedText: "100 prompts included",
      price: "$25",
    },
    {
      id: "webhook",
      title: "Webhook Deliveries",
      value: 71,
      usedText: "Used 14,200 deliveries",
      includedText: "20,000 deliveries included",
      price: "$12",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
      {/* Vertical Tabs List */}
      <div className="flex flex-col space-y-1">
        <h3 className="font-semibold text-base">Billing</h3>
        <p className="text-muted-foreground text-sm">
          Overview of current billing cycle based on fixed and on-demand
          charges.
        </p>
      </div>

      {/* Content */}
      <div className="lg:col-span-2">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h4 className="font-medium text-sm">Starter plan</h4>
            <p className="text-muted-foreground text-sm">
              Discounted plan for start-ups and growing companies
            </p>
          </div>
          <p className="font-medium text-sm">$90</p>
        </div>
        <Separator className="my-3" />
        {progressSections.map((section) => (
          <div key={section.id}>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h4 className="font-medium text-sm">{section.title}</h4>
                <Progress
                  className="w-70 **:data-[slot=progress-track]:h-2 **:data-[slot=progress-track]:bg-primary/20 md:w-100"
                  value={section.value}
                />
                <div className="flex items-center justify-between">
                  <p className="text-muted-foreground text-xs">
                    {section.usedText}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {section.includedText}
                  </p>
                </div>
              </div>
              <p className="font-medium text-sm">{section.price}</p>
            </div>
            <Separator className="my-3" />
          </div>
        ))}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h4 className="font-medium text-sm">
              Query super caching (EU-Central 1)
            </h4>
            <p className="text-muted-foreground text-sm">
              4 GB query cache, $120/mo
            </p>
          </div>
          <p className="font-medium text-sm">$120.00</p>
        </div>
        <Separator className="my-3" />
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-sm">Total for March 24</h4>
          <p className="font-medium text-sm">$317.00</p>
        </div>
      </div>
    </div>
  );
};

export default Billing;
