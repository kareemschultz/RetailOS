import { Avatar, AvatarFallback } from "@RetailOS/ui/components/avatar";
import { Badge } from "@RetailOS/ui/components/badge";
import { Button } from "@RetailOS/ui/components/button";
import { Checkbox } from "@RetailOS/ui/components/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@RetailOS/ui/components/dropdown-menu";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@RetailOS/ui/components/input-group";
import { Label } from "@RetailOS/ui/components/label";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
} from "@RetailOS/ui/components/pagination";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@RetailOS/ui/components/select";
import { Switch } from "@RetailOS/ui/components/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@RetailOS/ui/components/table";
import { usePagination } from "@RetailOS/ui/hooks/use-pagination";
import { cn } from "@RetailOS/ui/lib/utils";
import type {
  Column,
  ColumnDef,
  ColumnFiltersState,
  PaginationState,
  RowData,
} from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  getFacetedMinMaxValues,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  ArmchairIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  EllipsisVerticalIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  Gamepad2Icon,
  HeadphonesIcon,
  LaptopIcon,
  PlusIcon,
  SearchIcon,
  ShirtIcon,
  SmartphoneIcon,
  UploadIcon,
  WatchIcon,
} from "lucide-react";
import Papa from "papaparse";
import { useId, useMemo, useState } from "react";
import * as XLSX from "xlsx";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    filterVariant?: "text" | "range" | "select";
  }
}

export interface Item {
  amount: number;
  brand: string;
  category:
    | "controller"
    | "fashion"
    | "furniture"
    | "headphone"
    | "laptop"
    | "smartphone"
    | "smartwatch";
  id: string;
  product: string;
  productImage: string;
  quantity: number;
  status: "inactive" | "publish" | "scheduled";
  stock: "available" | "unavailable";
}

const columns: ColumnDef<Item>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        aria-label="Select all"
        checked={table.getIsAllPageRowsSelected()}
        indeterminate={table.getIsSomePageRowsSelected()}
        onCheckedChange={(value) => table.toggleAllRowsSelected(!!value)}
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        aria-label="Select row"
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
      />
    ),
    size: 50,
  },
  {
    header: "Product",
    accessorKey: "product",
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <div className="flex size-10 items-center justify-center rounded-sm bg-primary/5">
          <img
            alt={row.getValue("product")}
            className="w-7.5"
            height={30}
            src={row.original.productImage}
            width={30}
          />
        </div>
        <div className="flex flex-col">
          <span className="font-medium">{row.getValue("product")}</span>
          <span className="text-muted-foreground">{row.original.brand}</span>
        </div>
      </div>
    ),
    size: 246,
  },
  {
    header: "Category",
    accessorKey: "category",
    cell: ({ row }) => {
      const category = row.getValue("category") as string;

      const categories = {
        controller: <Gamepad2Icon className="size-4.5" />,
        fashion: <ShirtIcon className="size-4.5" />,
        furniture: <ArmchairIcon className="size-4.5" />,
        headphone: <HeadphonesIcon className="size-4.5" />,
        laptop: <LaptopIcon className="size-4.5" />,
        smartphone: <SmartphoneIcon className="size-4.5" />,
        smartwatch: <WatchIcon className="size-4.5" />,
      }[category];

      return (
        <div className="flex items-center gap-2">
          <Avatar className="size-7">
            <AvatarFallback className="bg-primary/10 text-primary">
              {categories}
            </AvatarFallback>
          </Avatar>
          <span className="text-muted-foreground capitalize">{category}</span>
        </div>
      );
    },
    size: 180,
    meta: {
      filterVariant: "select",
    },
  },
  {
    header: "Stock",
    accessorKey: "stock",
    filterFn: "equalsString",
    cell: ({ row }) => (
      <Switch
        aria-label="Medium switch"
        defaultChecked={row.getValue("stock") === "available"}
      />
    ),
    size: 110,
    meta: {
      filterVariant: "select",
    },
  },
  {
    header: "Amount",
    accessorKey: "amount",
    cell: ({ row }) => {
      const amount = Number.parseFloat(row.getValue("amount"));

      const formatted = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(amount);

      return <span>{formatted.slice(0, -3)}</span>;
    },
  },
  {
    header: "QTY",
    accessorKey: "quantity",
    cell: ({ row }) => <span>{row.getValue("quantity")}</span>,
  },
  {
    header: "Status",
    accessorKey: "status",
    cell: ({ row }) => {
      const status = row.getValue("status") as string;

      const styles = {
        publish:
          "bg-green-600/10 text-green-600 focus-visible:ring-green-600/20 dark:bg-green-400/10 dark:text-green-400 dark:focus-visible:ring-green-400/40 [a&]:hover:bg-green-600/5 dark:[a&]:hover:bg-green-400/5",
        inactive:
          "bg-destructive/10 [a&]:hover:bg-destructive/5 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 text-destructive",
        scheduled:
          "bg-amber-600/10 text-amber-600 focus-visible:ring-amber-600/20 dark:bg-amber-400/10 dark:text-amber-400 dark:focus-visible:ring-amber-400/40 [a&]:hover:bg-amber-600/5 dark:[a&]:hover:bg-amber-400/5",
      }[status];

      return (
        <Badge
          className={cn(
            "h-auto rounded-sm border-none capitalize focus-visible:outline-none",
            styles
          )}
        >
          {row.getValue("status")}
        </Badge>
      );
    },
    meta: {
      filterVariant: "select",
    },
  },
  {
    id: "actions",
    header: () => "Actions",
    cell: () => (
      <div>
        <RowActions />
      </div>
    ),
    size: 60,
    enableHiding: false,
  },
];

const ProductDatatable = ({ data }: { data: Item[] }) => {
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const pageSize = 5;

  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize,
  });

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    state: {
      columnFilters,
      pagination,
    },
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getFacetedMinMaxValues: getFacetedMinMaxValues(),
    enableSortingRemoval: false,
    getPaginationRowModel: getPaginationRowModel(),
    onPaginationChange: setPagination,
  });

  const exportToCSV = () => {
    const selectedRows = table.getSelectedRowModel().rows;

    const dataToExport =
      selectedRows.length > 0
        ? selectedRows.map((row) => row.original)
        : table.getFilteredRowModel().rows.map((row) => row.original);

    const csv = Papa.unparse(dataToExport, {
      header: true,
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);

    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `payments-export-${new Date().toISOString().split("T")[0]}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToExcel = () => {
    const selectedRows = table.getSelectedRowModel().rows;

    const dataToExport =
      selectedRows.length > 0
        ? selectedRows.map((row) => row.original)
        : table.getFilteredRowModel().rows.map((row) => row.original);

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Payments");

    const cols = [
      { wch: 10 },
      { wch: 20 },
      { wch: 15 },
      { wch: 25 },
      { wch: 15 },
    ];

    worksheet["!cols"] = cols;

    XLSX.writeFile(
      workbook,
      `payments-export-${new Date().toISOString().split("T")[0]}.xlsx`
    );
  };

  const exportToJSON = () => {
    const selectedRows = table.getSelectedRowModel().rows;

    const dataToExport =
      selectedRows.length > 0
        ? selectedRows.map((row) => row.original)
        : table.getFilteredRowModel().rows.map((row) => row.original);

    const json = JSON.stringify(dataToExport, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);

    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `payments-export-${new Date().toISOString().split("T")[0]}.json`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const { pages, showLeftEllipsis, showRightEllipsis } = usePagination({
    currentPage: table.getState().pagination.pageIndex + 1,
    totalPages: table.getPageCount(),
    paginationItemsToDisplay: 2,
  });

  return (
    <div className="w-full">
      <div className="border-b">
        <div className="flex flex-col gap-4 border-b p-6">
          <div className="grid grid-cols-1 gap-6 max-md:*:last:col-span-full sm:grid-cols-2 md:grid-cols-3">
            <Filter column={table.getColumn("category")!} />
            <Filter column={table.getColumn("stock")!} />
            <Filter column={table.getColumn("status")!} />
          </div>
        </div>
        <div className="flex gap-4 p-6 max-sm:flex-col sm:items-center sm:justify-between">
          <Filter column={table.getColumn("product")!} />
          <div className="flex flex-wrap items-center gap-4 sm:justify-between">
            <div className="flex items-center gap-2">
              <Label className="sr-only" htmlFor="#rowSelect">
                Show
              </Label>
              <Select
                items={[5, 10, 25, 50].map((s) => ({
                  label: String(s),
                  value: String(s),
                }))}
                onValueChange={(value: string | null) => {
                  if (value) {
                    table.setPageSize(Number(value));
                  }
                }}
                value={table.getState().pagination.pageSize.toString()}
              >
                <SelectTrigger
                  className="w-fit whitespace-nowrap"
                  id="rowSelect"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {[5, 10, 25, 50].map((pageSize) => (
                      <SelectItem key={pageSize} value={pageSize.toString()}>
                        {pageSize}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button className="bg-primary/10 text-primary hover:bg-primary/20 focus-visible:ring-primary/20 dark:focus-visible:ring-primary/40" />
                }
              >
                <UploadIcon />
                Export
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-auto">
                <DropdownMenuItem onClick={exportToCSV}>
                  <FileTextIcon className="mr-2 size-4" />
                  Export as CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportToExcel}>
                  <FileSpreadsheetIcon className="mr-2 size-4" />
                  Export as Excel
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={exportToJSON}>
                  <FileTextIcon className="mr-2 size-4" />
                  Export as JSON
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button>
              <PlusIcon />
              Add Product
            </Button>
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
                    {header.isPlaceholder ? null : header.column.getCanSort() ? (
                      <div
                        className={cn(
                          header.column.getCanSort() &&
                            "flex h-full cursor-pointer select-none items-center justify-between gap-2"
                        )}
                        onClick={header.column.getToggleSortingHandler()}
                        onKeyDown={(e) => {
                          if (
                            header.column.getCanSort() &&
                            (e.key === "Enter" || e.key === " ")
                          ) {
                            e.preventDefault();
                            header.column.getToggleSortingHandler()?.(e);
                          }
                        }}
                        tabIndex={header.column.getCanSort() ? 0 : undefined}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                        {{
                          asc: (
                            <ChevronUpIcon
                              aria-hidden="true"
                              className="shrink-0 opacity-60"
                              size={16}
                            />
                          ),
                          desc: (
                            <ChevronDownIcon
                              aria-hidden="true"
                              className="shrink-0 opacity-60"
                              size={16}
                            />
                          ),
                        }[header.column.getIsSorted() as string] ?? null}
                      </div>
                    ) : (
                      flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  data-state={row.getIsSelected() && "selected"}
                  key={row.id}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      className="h-14 first:w-12.5 first:pl-4 last:w-29 last:px-4"
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

      <div className="flex items-center justify-between gap-3 px-6 py-4 max-sm:flex-col">
        <p
          aria-live="polite"
          className="whitespace-nowrap text-muted-foreground text-sm"
        >
          Showing{" "}
          <span>
            {table.getState().pagination.pageIndex *
              table.getState().pagination.pageSize +
              1}{" "}
            to{" "}
            {Math.min(
              Math.max(
                table.getState().pagination.pageIndex *
                  table.getState().pagination.pageSize +
                  table.getState().pagination.pageSize,
                0
              ),
              table.getRowCount()
            )}
          </span>{" "}
          of <span>{table.getRowCount().toString()} entries</span>
        </p>

        <div>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <Button
                  aria-label="Go to previous page"
                  className="disabled:pointer-events-none disabled:opacity-50"
                  disabled={!table.getCanPreviousPage()}
                  onClick={() => table.previousPage()}
                  variant="ghost"
                >
                  <ChevronLeftIcon aria-hidden="true" />
                  <span className="max-sm:hidden">Previous</span>
                </Button>
              </PaginationItem>

              {showLeftEllipsis && (
                <PaginationItem>
                  <PaginationEllipsis />
                </PaginationItem>
              )}

              {pages.map((page) => {
                const isActive =
                  page === table.getState().pagination.pageIndex + 1;

                return (
                  <PaginationItem key={page}>
                    <Button
                      aria-current={isActive ? "page" : undefined}
                      className={`${!isActive && "bg-primary/10 text-primary hover:bg-primary/20 focus-visible:ring-primary/20 dark:focus-visible:ring-primary/40"}`}
                      onClick={() => table.setPageIndex(page - 1)}
                      size="icon"
                    >
                      {page}
                    </Button>
                  </PaginationItem>
                );
              })}

              {showRightEllipsis && (
                <PaginationItem>
                  <PaginationEllipsis />
                </PaginationItem>
              )}

              <PaginationItem>
                <Button
                  aria-label="Go to next page"
                  className="disabled:pointer-events-none disabled:opacity-50"
                  disabled={!table.getCanNextPage()}
                  onClick={() => table.nextPage()}
                  variant="ghost"
                >
                  <span className="max-sm:hidden">Next</span>
                  <ChevronRightIcon aria-hidden="true" />
                </Button>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      </div>
    </div>
  );
};

export default ProductDatatable;

function Filter({ column }: { column: Column<any, unknown> }) {
  const id = useId();
  const columnFilterValue = column.getFilterValue();
  const { filterVariant } = column.columnDef.meta ?? {};

  const columnHeader =
    typeof column.columnDef.header === "string" ? column.columnDef.header : "";

  const facetedUniqueValues = column.getFacetedUniqueValues();

  const sortedUniqueValues = useMemo(() => {
    if (filterVariant === "range") {
      return [];
    }

    const values = Array.from(facetedUniqueValues.keys());

    const flattenedValues = values.reduce((acc: string[], curr) => {
      if (Array.isArray(curr)) {
        return [...acc, ...curr];
      }

      return [...acc, curr];
    }, []);

    return Array.from(new Set(flattenedValues)).sort();
  }, [facetedUniqueValues, filterVariant]);

  if (filterVariant === "select") {
    return (
      <div className="flex w-full flex-col gap-2">
        <Label htmlFor={`${id}-select`}>Select {columnHeader}</Label>
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
                  {String(value)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xs">
      <Label className="sr-only" htmlFor={`${id}-input`}>
        {columnHeader}
      </Label>
      <InputGroup>
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput
          id={`${id}-input`}
          onChange={(e) => column.setFilterValue(e.target.value)}
          placeholder={`Search ${columnHeader.toLowerCase()}`}
          type="text"
          value={(columnFilterValue ?? "") as string}
        />
      </InputGroup>
    </div>
  );
}

function RowActions() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button aria-label="Edit item" size="icon" variant="ghost" />}
      >
        <EllipsisVerticalIcon aria-hidden="true" className="size-4.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuGroup>
          <DropdownMenuItem>
            <span>Edit</span>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <span>Duplicate</span>
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive">
            <span>Delete</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
