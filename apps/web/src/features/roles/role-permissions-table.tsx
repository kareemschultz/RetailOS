// Third-party Imports

// Component Imports
import { Checkbox } from "@RetailOS/ui/components/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@RetailOS/ui/components/table";
import type { Control, UseFormWatch } from "react-hook-form";
import { useFieldArray } from "react-hook-form";
// Type Imports
import type { RoleFormData } from "@/features/roles/role-types";

// -------------------------------------------------------------------------------------------------

interface RolePermissionsTableProps {
  control: Control<RoleFormData>;
  resources: string[];
  watch: UseFormWatch<RoleFormData>;
}

const ACTIONS = ["read", "write", "create", "delete"] as const;

type PermissionAction = (typeof ACTIONS)[number];

export function RolePermissionsTable({
  control,
  watch,
}: RolePermissionsTableProps) {
  // Hooks
  const { fields, update, replace } = useFieldArray({
    control,
    name: "permissions",
  });
  const currentPermissions = watch("permissions") ?? [];

  // Vars
  const allGlobalSelected =
    currentPermissions.length > 0 &&
    currentPermissions.every((p) => ACTIONS.every((a) => p[a]));

  const someGlobalSelected =
    currentPermissions.some((p) => ACTIONS.some((a) => p[a])) &&
    !allGlobalSelected;

  // Handlers
  const handleGlobalSelectAll = (checked: boolean) => {
    replace(
      currentPermissions.map((p) => ({
        ...p,
        read: checked,
        write: checked,
        create: checked,
        delete: checked,
      }))
    );
  };

  const handleRowSelectAll = (index: number, checked: boolean) => {
    const perm = currentPermissions[index];

    if (!perm) {
      return;
    }
    update(index, {
      ...perm,
      read: checked,
      write: checked,
      create: checked,
      delete: checked,
    });
  };

  const handlePermissionChange = (
    index: number,
    action: PermissionAction,
    checked: boolean
  ) => {
    const perm = currentPermissions[index];

    if (!perm) {
      return;
    }
    update(index, { ...perm, [action]: checked });
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-48 p-3">Resource</TableHead>
          <TableHead className="p-3! text-center">
            <div className="flex flex-col items-center gap-1">
              <Checkbox
                aria-label="Select all permissions"
                checked={allGlobalSelected}
                indeterminate={someGlobalSelected}
                onCheckedChange={(value) => handleGlobalSelectAll(!!value)}
              />
            </div>
          </TableHead>
          {ACTIONS.map((action) => (
            <TableHead className="p-3 text-center capitalize" key={action}>
              {action}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {fields.map((field, index) => {
          const perm = currentPermissions[index];

          if (!perm) {
            return null;
          }

          const allForRow = ACTIONS.every((a) => perm[a]);
          const someForRow = ACTIONS.some((a) => perm[a]) && !allForRow;

          return (
            <TableRow key={field.id}>
              <TableCell className="p-3 font-medium">{perm.resource}</TableCell>
              <TableCell className="p-3! text-center">
                <Checkbox
                  aria-label={`Select all for ${perm.resource}`}
                  checked={allForRow}
                  className="inline-flex"
                  indeterminate={someForRow}
                  onCheckedChange={(value) =>
                    handleRowSelectAll(index, !!value)
                  }
                />
              </TableCell>
              {ACTIONS.map((action) => (
                <TableCell className="p-3 text-center" key={action}>
                  <Checkbox
                    aria-label={`${perm.resource} ${action}`}
                    checked={perm[action]}
                    className="inline-flex"
                    onCheckedChange={(value) =>
                      handlePermissionChange(index, action, !!value)
                    }
                  />
                </TableCell>
              ))}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
