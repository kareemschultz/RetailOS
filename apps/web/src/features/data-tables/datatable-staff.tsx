import { Avatar, AvatarFallback } from "@RetailOS/ui/components/avatar";
import { Badge } from "@RetailOS/ui/components/badge";
import { Button } from "@RetailOS/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@RetailOS/ui/components/dropdown-menu";
import { Label } from "@RetailOS/ui/components/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@RetailOS/ui/components/select";
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
import { cn } from "@RetailOS/ui/lib/utils";
import type {
  Column,
  ColumnDef,
  ColumnFiltersState,
  PaginationState,
} from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  BadgeCheckIcon,
  BoxesIcon,
  CalculatorIcon,
  CrownIcon,
  EllipsisVerticalIcon,
  EyeIcon,
  ShieldIcon,
  Trash2Icon,
  UserRoundIcon,
} from "lucide-react";
import { useId, useMemo, useState } from "react";

import type { StaffItem, StaffRole } from "@/features/data-tables/data";
import {
  DataTablePagination,
  SortableHeader,
} from "@/features/data-tables/shared-table";

const roleIcons: Record<StaffRole, React.ReactNode> = {
  owner: <CrownIcon className="size-4 text-amber-600 dark:text-amber-400" />,
  manager: <ShieldIcon className="size-4 text-chart-1" />,
  cashier: <UserRoundIcon className="size-4 text-chart-2" />,
  "stock-clerk": <BoxesIcon className="size-4 text-chart-3" />,
  accountant: <CalculatorIcon className="size-4 text-chart-5" />,
};

const statusStyles: Record<StaffItem["status"], string> = {
  active:
    "bg-green-600/10 text-green-600 dark:bg-green-400/10 dark:text-green-400",
  inactive: "bg-destructive/10 text-destructive",
  invited:
    "bg-amber-600/10 text-amber-600 dark:bg-amber-400/10 dark:text-amber-400",
};

const columns: ColumnDef<StaffItem>[] = [
  {
    header: "Staff member",
    accessorKey: "staff",
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <Avatar className="size-9">
          <AvatarFallback className="text-xs">
            {row.original.fallback}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col">
          <span className="font-medium">{row.getValue("staff")}</span>
          <span className="text-muted-foreground text-sm">
            {row.original.email}
          </span>
        </div>
      </div>
    ),
    size: 320,
  },
  {
    header: "Role",
    accessorKey: "role",
    cell: ({ row }) => {
      const role = row.getValue("role") as StaffRole;

      return (
        <div className="flex items-center gap-2">
          {roleIcons[role]}
          <span className="capitalize">{role.replace("-", " ")}</span>
        </div>
      );
    },
  },
  {
    header: "Store",
    accessorKey: "store",
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.getValue("store")}</span>
    ),
  },
  {
    header: "Status",
    accessorKey: "status",
    filterFn: "equalsString",
    cell: ({ row }) => {
      const status = row.getValue("status") as StaffItem["status"];

      return (
        <Badge
          className={cn(
            "h-auto rounded-sm border-none capitalize",
            statusStyles[status]
          )}
        >
          {status}
        </Badge>
      );
    },
  },
  {
    id: "actions",
    header: () => "Actions",
    cell: () => (
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger
            render={<Button aria-label="View" size="icon" variant="ghost" />}
          >
            <EyeIcon className="size-4.5" />
          </TooltipTrigger>
          <TooltipContent>
            <p>View</p>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={<Button aria-label="Disable" size="icon" variant="ghost" />}
          >
            <Trash2Icon className="size-4.5" />
          </TooltipTrigger>
          <TooltipContent>
            <p>Disable</p>
          </TooltipContent>
        </Tooltip>
        <StaffRowActions />
      </div>
    ),
    enableHiding: false,
  },
];

function StaffDatatable({ data }: { data: StaffItem[] }) {
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 5,
  });

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    state: { columnFilters, pagination },
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    enableSortingRemoval: false,
    getPaginationRowModel: getPaginationRowModel(),
    onPaginationChange: setPagination,
  });

  return (
    <div className="w-full">
      <div className="border-b">
        <div className="flex flex-col gap-4 p-6">
          <div className="grid grid-cols-1 gap-6 max-md:*:last:col-span-full sm:grid-cols-2 md:grid-cols-3">
            <FacetedFilter
              column={table.getColumn("role") as Column<StaffItem>}
            />
            <FacetedFilter
              column={table.getColumn("store") as Column<StaffItem>}
            />
            <FacetedFilter
              column={table.getColumn("status") as Column<StaffItem>}
            />
          </div>
        </div>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow className="h-14 border-t" key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    className="text-muted-foreground first:pl-4 last:px-4"
                    key={header.id}
                    style={{ width: `${header.getSize()}px` }}
                  >
                    <SortableHeader header={header} />
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      className="h-14 first:pl-4 last:px-4"
                      key={cell.id}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  className="h-24 text-center"
                  colSpan={columns.length}
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} />
    </div>
  );
}

export default StaffDatatable;

function FacetedFilter({ column }: { column: Column<StaffItem> }) {
  const id = useId();
  const columnFilterValue = column.getFilterValue();
  const columnHeader =
    typeof column.columnDef.header === "string" ? column.columnDef.header : "";
  const facetedUniqueValues = column.getFacetedUniqueValues();

  const sortedUniqueValues = useMemo(
    () => Array.from(new Set(Array.from(facetedUniqueValues.keys()))).sort(),
    [facetedUniqueValues]
  );

  return (
    <div className="flex w-full flex-col gap-2">
      <Label htmlFor={`${id}-select`}>Filter by {columnHeader}</Label>
      <Select
        items={[
          { label: "All", value: "all" },
          ...sortedUniqueValues.map((value) => ({
            label: String(value),
            value: String(value),
          })),
        ]}
        onValueChange={(value: string | null) => {
          column.setFilterValue(
            value === "all" || value === null ? undefined : value
          );
        }}
        value={columnFilterValue?.toString() ?? "all"}
      >
        <SelectTrigger className="w-full capitalize" id={`${id}-select`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="all">All</SelectItem>
            {sortedUniqueValues.map((value) => (
              <SelectItem
                className="capitalize"
                key={String(value)}
                value={String(value)}
              >
                {String(value).replace("-", " ")}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}

function StaffRowActions() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button aria-label="Row actions" size="icon" variant="ghost" />}
      >
        <EllipsisVerticalIcon aria-hidden="true" className="size-4.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuGroup>
          <DropdownMenuItem>
            <BadgeCheckIcon className="mr-2 size-4" />
            <span>Edit permissions</span>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <span>Reset PIN</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
