// Component Imports
import { Card, CardContent } from "@RetailOS/ui/components/card";

// Hook Imports
import { useRolesApp } from "@/features/roles/use-roles-app";

// Component Imports
import { PermissionsTable } from "./permissions-table";

// -------------------------------------------------------------------------------------------------

const PERMISSION_KEYS = ["read", "write", "create", "delete"] as const;

export function PermissionsApp() {
  // Hooks
  const { rolesWithUsers, permissionResources, handlePermissionChange } =
    useRolesApp();

  // Vars
  const activePermissions = rolesWithUsers.reduce(
    (total, role) =>
      total +
      role.permissions.reduce(
        (sum, perm) => sum + PERMISSION_KEYS.filter((k) => perm[k]).length,
        0
      ),
    0
  );

  return (
    <div className="flex flex-col gap-3 md:gap-6">
      <div>
        <h1 className="font-heading font-semibold text-xl">Permissions</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Overview of all roles and their associated resource permissions.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 md:gap-6">
        {[
          { label: "Roles", value: rolesWithUsers.length },
          { label: "Resources", value: permissionResources.length },
          { label: "Active Permissions", value: activePermissions },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex flex-col gap-1">
              <span className="font-semibold text-2xl">{stat.value}</span>
              <span className="text-muted-foreground text-sm">
                {stat.label}
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="gap-0 p-0 shadow-none">
        <CardContent className="p-0">
          <PermissionsTable
            onPermissionChange={handlePermissionChange}
            resources={permissionResources}
            roles={rolesWithUsers}
          />
        </CardContent>
      </Card>
    </div>
  );
}
