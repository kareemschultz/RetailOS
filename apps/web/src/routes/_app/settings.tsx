import { createFileRoute } from "@tanstack/react-router";

import { db as userSettingsDb } from "@/features/settings/data";
import UserSettingsTabs from "@/features/settings/user-settings-tabs";

export const Route = createFileRoute("/_app/settings")({
  component: UserSettingsScreen,
});

function UserSettingsScreen() {
  // AdminCN sample data wired as local scaffold (no oRPC yet).
  const membersData = {
    members: userSettingsDb.members,
    pending: userSettingsDb.pending,
  };
  const sessionsData = userSettingsDb.sessions;
  const integrationsData = userSettingsDb.integrations;

  return (
    <div>
      <div className="mb-4 md:mb-6 lg:mb-10">
        <h1 className="font-bold text-xl">Account &amp; User Management</h1>
        <p className="text-muted-foreground">
          Manage your account settings and user preferences.
        </p>
      </div>
      <UserSettingsTabs
        integrationsData={integrationsData}
        membersData={membersData}
        sessionsData={sessionsData}
      />
    </div>
  );
}
