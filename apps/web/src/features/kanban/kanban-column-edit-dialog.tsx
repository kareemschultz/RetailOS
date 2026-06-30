import { Button } from "@RetailOS/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@RetailOS/ui/components/dialog";
import { Input } from "@RetailOS/ui/components/input";
import { Label } from "@RetailOS/ui/components/label";
import { useState } from "react";

import { isDuplicateColumnTitle } from "./kanban-utils";

interface ColumnEditDialogProps {
  columnId: string;
  columnTitles: Record<string, string>;
  onOpenChange: (open: boolean) => void;
  onSave: (title: string) => void;
  open: boolean;
  title: string;
}

function ColumnEditDialogContent({
  columnId,
  title,
  columnTitles,
  onOpenChange,
  onSave,
}: {
  columnId: string;
  title: string;
  columnTitles: Record<string, string>;
  onOpenChange: (open: boolean) => void;
  onSave: (title: string) => void;
}) {
  const [name, setName] = useState(title);

  const trimmed = name.trim();
  const isDuplicate = trimmed
    ? isDuplicateColumnTitle(trimmed, columnTitles, columnId)
    : false;

  function handleSave() {
    if (!trimmed || isDuplicate) {
      return;
    }

    onSave(trimmed);
    onOpenChange(false);
  }

  return (
    <DialogContent className="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle>Edit column</DialogTitle>
        <DialogDescription>Change the column name.</DialogDescription>
      </DialogHeader>

      <div className="grid gap-2 py-2">
        <Label htmlFor="column-title">Column name</Label>
        <Input
          aria-invalid={isDuplicate}
          id="column-title"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleSave();
            }
          }}
          placeholder="Column title"
          value={name}
        />
        {isDuplicate && (
          <p className="text-destructive text-xs">
            A column with this name already exists.
          </p>
        )}
      </div>

      <DialogFooter>
        <Button onClick={() => onOpenChange(false)} variant="outline">
          Cancel
        </Button>
        <Button disabled={!trimmed || isDuplicate} onClick={handleSave}>
          Save changes
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

export function ColumnEditDialog({
  columnId,
  title,
  columnTitles,
  open,
  onOpenChange,
  onSave,
}: ColumnEditDialogProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      {open && (
        <ColumnEditDialogContent
          columnId={columnId}
          columnTitles={columnTitles}
          key={columnId}
          onOpenChange={onOpenChange}
          onSave={onSave}
          title={title}
        />
      )}
    </Dialog>
  );
}
