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
import {
  BanknoteIcon,
  CreditCardIcon,
  EllipsisVerticalIcon,
  LandmarkIcon,
  SmartphoneIcon,
} from "lucide-react";
import { useState } from "react";

import { formatGyd, type SaleItem } from "@/features/data-tables/data";
import {
  DataTablePagination,
  SortableHeader,
} from "@/features/data-tables/shared-table";

const paymentIcons: Record<SaleItem["payment"], React.ReactNode> = {
  cash: <BanknoteIcon className="size-4" />,
  card: <CreditCardIcon className="size-4" />,
  "bank-transfer": <LandmarkIcon className="size-4" />,
  "mobile-money": <SmartphoneIcon className="size-4" />,
};

const statusStyles: Record<SaleItem["status"], string> = {
  completed:
    "bg-green-600/10 text-green-600 dark:bg-green-400/10 dark:text-green-400",
  refunded:
    "bg-amber-600/10 text-amber-600 dark:bg-amber-400/10 dark:text-amber-400",
  void: "bg-destructive/10 text-destructive",
};

const columns: ColumnDef<SaleItem>[] = [
  {
    header: "Reference",
    accessorKey: "reference",
    cell: ({ row }) => (
      <span className="font-medium font-mono text-sm">
        {row.getValue("reference")}
      </span>
    ),
  },
  {
    header: "Customer",
    accessorKey: "customer",
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <Avatar className="size-9">
          <AvatarFallback className="text-xs">
            {row.original.fallback}
          </AvatarFallback>
        </Avatar>
        <span className="font-medium">{row.getValue("customer")}</span>
      </div>
    ),
    size: 240,
  },
  {
    header: "Store",
    accessorKey: "store",
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.getValue("store")}</span>
    ),
  },
  {
    header: "Payment",
    accessorKey: "payment",
    cell: ({ row }) => {
      const payment = row.getValue("payment") as SaleItem["payment"];

      return (
        <div className="flex items-center gap-2 text-muted-foreground">
          {paymentIcons[payment]}
          <span className="capitalize">{payment.replace("-", " ")}</span>
        </div>
      );
    },
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
    header: "Status",
    accessorKey: "status",
    cell: ({ row }) => {
      const status = row.getValue("status") as SaleItem["status"];

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
    cell: () => <SaleRowActions />,
    size: 60,
    enableHiding: false,
  },
];

function SalesDatatable({ data }: { data: SaleItem[] }) {
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

export default SalesDatatable;

function SaleRowActions() {
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
            <span>View receipt</span>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <span>Reprint</span>
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive">
            <span>Refund</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
