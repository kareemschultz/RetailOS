// Third-party Imports

// Component Imports
import { Button } from "@RetailOS/ui/components/button";
import { Card, CardContent } from "@RetailOS/ui/components/card";
import { PlusIcon } from "lucide-react";
// Type Imports
import type { AppRoleWithUsers } from "@/features/roles/role-types";
import { RoleCard } from "./role-card";

// -------------------------------------------------------------------------------------------------

interface RolesGridProps {
  onAddNew: () => void;
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
  roles: AppRoleWithUsers[];
}

export function RolesGrid({
  roles,
  onEdit,
  onDelete,
  onAddNew,
}: RolesGridProps) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {roles.map((role) => (
        <RoleCard
          key={role.id}
          onDelete={onDelete}
          onEdit={onEdit}
          role={role}
        />
      ))}

      <Card className="items-center justify-center">
        <CardContent className="flex flex-col items-center justify-center gap-4">
          <div className="text-center">
            <p className="font-medium text-lg">Add New Role</p>
            <p className="mt-1 text-muted-foreground text-sm">
              Add a role, if it does not exist.
            </p>
          </div>
          <Button onClick={onAddNew} variant="outline">
            <PlusIcon className="size-4" />
            Add New Role
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
