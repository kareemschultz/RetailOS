// React Imports

// Component Imports
import { Button } from "@RetailOS/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@RetailOS/ui/components/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@RetailOS/ui/components/select";
// Third-party Imports
import { Trash2Icon } from "lucide-react";
import { useState } from "react";
// Type Imports
import type { UserStatus } from "@/features/users/types";

const STATUSES: UserStatus[] = ["Active", "Pending", "Suspended", "Inactive"];

export interface UserBulkActionBarProps {
  onBulkDelete: () => void;
  onBulkStatusChange: (status: UserStatus) => void;
  onClearSelection: () => void;
  selectedCount: number;
}

export function UserBulkActionBar({
  selectedCount,
  onBulkDelete,
  onBulkStatusChange,
  onClearSelection,
}: UserBulkActionBarProps) {
  // States
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const handleConfirmDelete = () => {
    onBulkDelete();
    setIsDeleteDialogOpen(false);
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 border-t px-6 py-3">
        <span className="font-medium text-sm">
          {selectedCount} user{selectedCount === 1 ? "" : "s"} selected
        </span>

        <Button
          onClick={() => setIsDeleteDialogOpen(true)}
          size="sm"
          variant="destructive"
        >
          <Trash2Icon className="size-4" />
          Delete Selected
        </Button>

        <Select
          onValueChange={(value: string | null) => {
            if (value) {
              onBulkStatusChange(value as UserStatus);
            }
          }}
        >
          <SelectTrigger className="w-44" size="sm">
            <SelectValue placeholder="Change Status" />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            <SelectGroup>
              {STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <Button onClick={onClearSelection} size="sm" variant="ghost">
          Clear selection
        </Button>
      </div>

      <Dialog onOpenChange={setIsDeleteDialogOpen} open={isDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete selected users?</DialogTitle>
            <DialogDescription>
              This will permanently remove {selectedCount} user
              {selectedCount === 1 ? "" : "s"}. This action cannot be undone.
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
