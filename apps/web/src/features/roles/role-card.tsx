// React Imports

// Component Imports
import { Button } from "@RetailOS/ui/components/button";
import { Card, CardContent } from "@RetailOS/ui/components/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@RetailOS/ui/components/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@RetailOS/ui/components/dropdown-menu";
// Third-party Imports
import { MoreVertical, PencilIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
// Type Imports
import type { AppRoleWithUsers } from "@/features/roles/role-types";

// -------------------------------------------------------------------------------------------------

interface RoleCardProps {
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
  role: AppRoleWithUsers;
}

const PERM_KEYS = [
  { label: "Read", key: "read" as const },
  { label: "Write", key: "write" as const },
  { label: "Create", key: "create" as const },
  { label: "Delete", key: "delete" as const },
];

export function RoleCard({ role, onEdit, onDelete }: RoleCardProps) {
  // States
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Vars
  const total = role.permissions.length;

  const permCounts = PERM_KEYS.map(({ label, key }) => ({
    label,
    count: role.permissions.filter((p) => p[key]).length,
  }));

  // Handlers
  const handleConfirmDelete = () => {
    onDelete(role.id);
    setIsDeleteDialogOpen(false);
  };

  return (
    <>
      <Card>
        <CardContent className="flex flex-col gap-3">
          <div className="flex justify-between gap-2">
            <div className="min-w-0">
              <h4 className="font-medium text-base leading-tight">
                {role.name}
              </h4>
              <p className="mt-0.5 text-muted-foreground text-xs">
                {role.users.length} {role.users.length === 1 ? "user" : "users"}
              </p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button size="icon-sm" variant="ghost" />}
              >
                <MoreVertical className="size-4" />
                <span className="sr-only">More</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(role.id)}>
                  <PencilIcon className="size-4" />
                  Edit Role
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setIsDeleteDialogOpen(true)}
                  variant="destructive"
                >
                  <Trash2Icon className="size-4" />
                  Delete Role
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2">
            {permCounts.map(({ label, count }) => (
              <div className="flex flex-col items-center gap-0.5" key={label}>
                <span className="font-semibold text-foreground text-sm">
                  {count}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {label}
                </span>
              </div>
            ))}
            <div className="h-6 w-px bg-border" />
            <div className="flex flex-col items-center gap-0.5">
              <span className="font-semibold text-foreground text-sm">
                {total}
              </span>
              <span className="text-[10px] text-muted-foreground">Total</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog onOpenChange={setIsDeleteDialogOpen} open={isDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Role</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the <strong>{role.name}</strong>{" "}
              role? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={() => setIsDeleteDialogOpen(false)}
              variant="outline"
            >
              Cancel
            </Button>
            <Button onClick={handleConfirmDelete} variant="destructive">
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
