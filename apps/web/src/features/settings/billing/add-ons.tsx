import { Badge } from "@RetailOS/ui/components/badge";
import { Card, CardContent } from "@RetailOS/ui/components/card";
import { Separator } from "@RetailOS/ui/components/separator";
import { Switch } from "@RetailOS/ui/components/switch";
import { ArrowUpRightIcon } from "lucide-react";

const AddOns = () => {
  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
      {/* Vertical Tabs List */}
      <div className="flex flex-col space-y-1">
        <h3 className="font-semibold text-base">Add-Ons</h3>
        <p className="text-muted-foreground text-sm">
          Manage your add-ons and subscription options.
        </p>
      </div>

      {/* Content */}
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardContent>
            <p className="mb-4 text-sm">$10 / month per project</p>
            <div className="mb-1 flex items-center gap-2">
              <h3 className="font-medium text-sm">Speed Insights</h3>
              <Badge className="px-1.5 py-px">Pro</Badge>
            </div>
            <p className="text-muted-foreground text-sm">
              Detailed view of your website&apos;s performance metrics,
              facilitating informed decisions for its optimization
            </p>
          </CardContent>
          <CardContent>
            <Separator />
          </CardContent>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Switch aria-label="Small switch" />
                <p className="text-sm">Activate</p>
              </div>
              <a
                className="group flex items-center gap-1 font-medium text-primary text-sm"
                href="#"
              >
                Learn more
                <ArrowUpRightIcon className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              </a>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="mb-4 text-sm">$20 / month </p>
            <div className="mb-1 flex items-center gap-2">
              <h3 className="font-medium text-sm">Observability Plus</h3>
              <Badge className="px-1.5 py-px">Pro</Badge>
            </div>
            <p className="text-muted-foreground text-sm">
              Gain comprehensive visibility into your application&apos;s health
              and performance.
            </p>
          </CardContent>
          <CardContent>
            <Separator />
          </CardContent>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Switch aria-label="Small switch" />
                <p className="text-sm">Activate</p>
              </div>
              <a
                className="group flex items-center gap-1 font-medium text-primary text-sm"
                href="#"
              >
                Learn more
                <ArrowUpRightIcon className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AddOns;
