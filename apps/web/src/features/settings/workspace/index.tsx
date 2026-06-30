// Component Import
import { Separator } from "@RetailOS/ui/components/separator";

import DangerZone from "@/features/settings/workspace/danger-zone";
import WorkspaceData from "@/features/settings/workspace/workspace-data";
import WorkspaceDetail from "@/features/settings/workspace/workspace-detail";
import WorkspaceName from "@/features/settings/workspace/workspace-name";
import WorkspaceOrganizations from "@/features/settings/workspace/workspace-organizations";

const Workspace = () => (
  <section className="py-3">
    <WorkspaceName />
    <Separator className="my-10" />
    <WorkspaceDetail />
    <Separator className="my-10" />
    <WorkspaceOrganizations />
    <Separator className="my-10" />
    <WorkspaceData />
    <Separator className="my-10" />
    <DangerZone />
  </section>
);

export default Workspace;
