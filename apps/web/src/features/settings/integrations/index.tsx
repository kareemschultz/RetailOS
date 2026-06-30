// Component Imports
import { Separator } from "@RetailOS/ui/components/separator";
import Communication from "@/features/settings/integrations/integrations-communication";
import Planning from "@/features/settings/integrations/integrations-planning";
import Tools from "@/features/settings/integrations/integrations-tools";
import type { IntegrationsData } from "@/features/settings/types";

interface IntegrationsProps {
  integrationsData: IntegrationsData;
}

const Integrations = ({ integrationsData }: IntegrationsProps) => (
  <section className="py-3">
    <Communication apps={integrationsData.communication} />
    <Separator className="my-10" />
    <Planning apps={integrationsData.planning} />
    <Separator className="my-10" />
    <Tools apps={integrationsData.tools} />
  </section>
);

export default Integrations;
