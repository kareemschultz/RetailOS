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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@RetailOS/ui/components/table";
import { cn } from "@RetailOS/ui/lib/utils";
import type { ColumnDef, PaginationState } from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { format } from "date-fns";
import { EllipsisVerticalIcon } from "lucide-react";
import { useState } from "react";

import {
  formatGyd,
  type SupplierInvoiceItem,
} from "@/features/data-tables/data";
import {
  DataTablePagination,
  SortableHeader,
} from "@/features/data-tables/shared-table";

const statusStyles: Record<SupplierInvoiceItem["status"], string> = {
  paid: "bg-green-600/10 text-green-600 dark:bg-green-400/10 dark:text-green-400",
  partial: "bg-sky-600/10 text-sky-600 dark:bg-sky-400/10 dark:text-sky-400",
  draft: "bg-muted text-muted-foreground",
  overdue: "bg-destructive/10 text-destructive",
};

const columns: ColumnDef<SupplierInvoiceItem>[] = [
  {
    header: "Invoice",
    accessorKey: "reference",
    cell: ({ row }) => (
      <span className="font-medium font-mono text-sm">
        {row.getValue("reference")}
      </span>
    ),
  },
  {
    header: "Supplier",
    accessorKey: "supplier",
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <Avatar className="size-9">
          <AvatarFallback className="text-xs">
            {row.original.fallback}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col">
          <span className="font-medium">{row.getValue("supplier")}</span>
          <span className="text-muted-foreground text-sm">
            {row.original.category}
          </span>
        </div>
      </div>
    ),
    size: 280,
  },
  {
    header: "Issued",
    accessorKey: "issuedDate",
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {format(row.getValue("issuedDate"), "dd MMM yyyy")}
      </span>
    ),
  },
  {
    header: "Total",
    accessorKey: "totalGyd",
    cell: ({ row }) => (
      <span className="font-mono tabular-nums">
        {formatGyd(row.getValue("totalGyd"))}
      </span>
    ),
  },
  {
    header: "Balance",
    accessorKey: "balanceGyd",
    cell: ({ row }) => {
      const balance = row.getValue("balanceGyd") as number;

      return (
        <span
          className={cn(
            "font-mono tabular-nums",
            balance > 0 && "text-destructive"
          )}
        >
          {formatGyd(balance)}
        </span>
      );
    },
  },
  {
    header: "Status",
    accessorKey: "status",
    cell: ({ row }) => {
      const status = row.getValue("status") as SupplierInvoiceItem["status"];

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
    cell: () => <InvoiceRowActions />,
    size: 60,
    enableHiding: false,
  },
];

function SupplierInvoiceDatatable({ data }: { data: SupplierInvoiceItem[] }) {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 5,
  });

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    state: { pagination },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    enableSortingRemoval: false,
    onPaginationChange: setPagination,
  });

  return (
    <div className="w-full">
      <div className="border-b">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    className="h-14 text-muted-foreground first:pl-4 last:px-4"
                    key={header.id}
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
                    <TableCell className="first:pl-4 last:px-4" key={cell.id}>
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

export default SupplierInvoiceDatatable;

function InvoiceRowActions() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button aria-label="Row actions" size="icon" variant="ghost" />}
      >
        <EllipsisVerticalIcon aria-hidden="true" className="size-5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuItem>
            <span>View invoice</span>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <span>Record payment</span>
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive">
            <span>Void</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
