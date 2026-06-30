// React Imports

// Component Imports
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@RetailOS/ui/components/tabs";
import { useState } from "react";
import BillingUsage from "@/features/settings/billing";
import UserGeneral from "@/features/settings/general";
import Integrations from "@/features/settings/integrations";
import Members from "@/features/settings/members";
import Notifications from "@/features/settings/notifications";
import Security from "@/features/settings/security";
// Type Imports
import type {
  IntegrationsData,
  MembersData,
  Session,
} from "@/features/settings/types";
import Workspace from "@/features/settings/workspace";

interface UserSettingsTabsProps {
  integrationsData: IntegrationsData;
  membersData: MembersData;
  sessionsData: Session[];
}

const UserSettingsTabs = ({
  membersData,
  sessionsData,
  integrationsData,
}: UserSettingsTabsProps) => {
  const [activeSetting, setActiveSetting] = useState("general");

  const tabs = [
    {
      name: "General",
      value: "general",
      content: <UserGeneral />,
    },
    {
      name: "Notifications",
      value: "notifications",
      content: <Notifications />,
    },
    {
      name: "Workspace",
      value: "workspace",
      content: <Workspace />,
    },
    {
      name: "Integrations",
      value: "integrations",
      content: <Integrations integrationsData={integrationsData} />,
    },
    {
      name: "Members",
      value: "members",
      content: <Members membersData={membersData} />,
    },
    {
      name: "Security",
      value: "security",
      content: <Security sessionsData={sessionsData} />,
    },
    {
      name: "Billing & Usage",
      value: "billing",
      content: <BillingUsage />,
    },
  ];

  return (
    <div className="w-full">
      <Tabs
        onValueChange={(value) => {
          setActiveSetting(value);
        }}
        value={activeSetting}
      >
        <div className="overflow-x-auto sm:overflow-visible">
          <TabsList
            className="h-fit! w-max min-w-full flex-nowrap justify-start gap-0 rounded-none border-b p-0 sm:w-full sm:flex-wrap"
            variant="line"
          >
            {tabs.map((tab) => (
              <TabsTrigger
                className="shrink-0 border-0 group-data-horizontal/tabs:after:bottom-[-0.5px] not-data-active:hover:group-data-horizontal/tabs:after:bg-muted-foreground/30 not-data-active:hover:group-data-horizontal/tabs:after:opacity-100 sm:flex-0"
                key={tab.value}
                value={tab.value}
              >
                {tab.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {tabs.map((tab) => (
          <TabsContent key={tab.value} value={tab.value}>
            {tab.content}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default UserSettingsTabs;
