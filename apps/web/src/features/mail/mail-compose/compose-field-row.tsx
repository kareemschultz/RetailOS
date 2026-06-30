// React Imports

// Component Imports
import { Input } from "@RetailOS/ui/components/input";
import type { ReactNode } from "react";

export const ComposeFieldRow = ({
  label,
  id,
  value,
  placeholder,
  onChange,
  trailing,
}: {
  label: string;
  id: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  trailing?: ReactNode;
}) => (
  <div className="flex min-h-11 items-center border-border border-b px-5">
    <label className="w-16 shrink-0 text-muted-foreground text-sm" htmlFor={id}>
      {label}
    </label>
    <Input
      className="h-10 flex-1 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 dark:bg-transparent"
      id={id}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      value={value}
    />
    {trailing}
  </div>
);
