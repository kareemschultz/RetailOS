// Third-party Imports

// Component Imports
import { Button } from "@RetailOS/ui/components/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@RetailOS/ui/components/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@RetailOS/ui/components/tooltip";
// Util Imports
import { cn } from "@RetailOS/ui/lib/utils";
import { EyeIcon, PencilLineIcon, PlusIcon, Trash2Icon } from "lucide-react";
// Type Imports
import type {
  AppRoleWithUsers,
  PermissionKey,
} from "@/features/roles/role-types";

// -------------------------------------------------------------------------------------------------

interface PermissionsTableProps {
  onPermissionChange: (
    roleId: string,
    resource: string,
    action: PermissionKey,
    value: boolean
  ) => void;
  resources: string[];
  roles: AppRoleWithUsers[];
}

const ACTIONS: {
  key: PermissionKey;
  Icon: React.ComponentType<{ className?: string }>;
  label: string;
}[] = [
  { key: "read", Icon: EyeIcon, label: "Read" },
  { key: "write", Icon: PencilLineIcon, label: "Write" },
  { key: "create", Icon: PlusIcon, label: "Create" },
  { key: "delete", Icon: Trash2Icon, label: "Delete" },
];

interface PermissionChipProps {
  allowed: boolean;
  Icon: React.ComponentType<{ className?: string }>;
  label: string;
  onChange: (value: boolean) => void;
}

function PermissionChip({
  Icon,
  label,
  allowed,
  onChange,
}: PermissionChipProps) {
  return (
    <Tooltip>
      <TooltipTrigger render={<span />}>
        <Button
          aria-label={`Toggle ${label}`}
          className={cn(
            "text-muted-foreground hover:text-foreground",
            allowed && "bg-primary/10 text-primary hover:bg-primary/20"
          )}
          onClick={() => onChange(!allowed)}
          size="icon-sm"
          type="button"
          variant={allowed ? "default" : "outline"}
        >
          <Icon className="size-3" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function PermissionsTable({
  roles,
  resources,
  onPermissionChange,
}: PermissionsTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="p-4 font-semibold">Resource</TableHead>
          {roles.map((role) => (
            <TableHead className="p-4" key={role.id}>
              <span className="block font-semibold">{role.name}</span>
              <span className="block font-normal text-muted-foreground text-xs">
                {role.users.length} {role.users.length === 1 ? "user" : "users"}
              </span>
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {resources.map((resource) => (
          <TableRow key={resource}>
            <TableCell className="p-4 font-medium">{resource}</TableCell>
            {roles.map((role) => {
              const perm = role.permissions.find(
                (p) => p.resource === resource
              );

              return (
                <TableCell className="px-4" key={role.id}>
                  <div className="flex gap-1">
                    {ACTIONS.map(({ key, Icon, label }) => (
                      <PermissionChip
                        allowed={perm?.[key] ?? false}
                        Icon={Icon}
                        key={key}
                        label={label}
                        onChange={(val) =>
                          onPermissionChange(role.id, resource, key, val)
                        }
                      />
                    ))}
                  </div>
                </TableCell>
              );
            })}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
