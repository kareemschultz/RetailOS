// React Imports

// Component Imports
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@RetailOS/ui/components/tabs";
import { useState } from "react";

import ConnectionsCard from "@/features/profile/connections";
import Profile from "@/features/profile/profile";
import TeamsCard from "@/features/profile/teams";
import ProjectsCard from "./projects";

const UserProfileTabs = () => {
  const [activeView, setActiveView] = useState("profile");

  const tabs = [
    {
      name: "Profile",
      value: "profile",
      content: <Profile />,
    },
    {
      name: "Teams",
      value: "teams",
      content: <TeamsCard />,
    },
    {
      name: "Projects",
      value: "projects",
      content: <ProjectsCard />,
    },
    {
      name: "Connections",
      value: "connections",
      content: <ConnectionsCard />,
    },
  ];

  return (
    <div className="w-full">
      <Tabs
        className="gap-4"
        onValueChange={(value) => {
          setActiveView(value);
        }}
        value={activeView}
      >
        <TabsList className="max-sm:w-full">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.name}
            </TabsTrigger>
          ))}
        </TabsList>
        {tabs.map((tab) => (
          <TabsContent key={tab.value} value={tab.value}>
            {tab.content}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default UserProfileTabs;
