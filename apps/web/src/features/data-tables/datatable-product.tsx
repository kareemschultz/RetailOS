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
  BeerIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  EllipsisVerticalIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  HammerIcon,
  PillIcon,
  PlusIcon,
  SearchIcon,
  ShirtIcon,
  ShoppingBasketIcon,
  SmartphoneIcon,
  SprayCanIcon,
  UploadIcon,
} from "lucide-react";
import Papa from "papaparse";
import { useId, useMemo, useState } from "react";
import * as XLSX from "xlsx";

import { formatGyd, type ProductItem } from "@/features/data-tables/data";

declare module "@tanstack/react-table" {
  interface ColumnMeta<TData extends RowData, TValue> {
    filterVariant?: "text" | "range" | "select";
  }
}

const categoryIcons: Record<ProductItem["category"], React.ReactNode> = {
  beverages: <BeerIcon className="size-4.5" />,
  grocery: <ShoppingBasketIcon className="size-4.5" />,
  hardware: <HammerIcon className="size-4.5" />,
  electronics: <SmartphoneIcon className="size-4.5" />,
  pharmacy: <PillIcon className="size-4.5" />,
  apparel: <ShirtIcon className="size-4.5" />,
  household: <SprayCanIcon className="size-4.5" />,
};

const statusStyles: Record<ProductItem["status"], string> = {
  published:
    "bg-green-600/10 text-green-600 dark:bg-green-400/10 dark:text-green-400",
  draft:
    "bg-amber-600/10 text-amber-600 dark:bg-amber-400/10 dark:text-amber-400",
  archived: "bg-destructive/10 text-destructive",
};

const columns: ColumnDef<ProductItem>[] = [
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
        <div className="flex size-10 items-center justify-center rounded-sm bg-primary/5 text-primary">
          {categoryIcons[row.original.category]}
        </div>
        <div className="flex flex-col">
          <span className="font-medium">{row.getValue("product")}</span>
          <span className="font-mono text-muted-foreground text-xs">
            {row.original.sku}
          </span>
        </div>
      </div>
    ),
    size: 280,
  },
  {
    header: "Category",
    accessorKey: "category",
    cell: ({ row }) => {
      const category = row.getValue("category") as ProductItem["category"];

      return (
        <div className="flex items-center gap-2">
          <Avatar className="size-7">
            <AvatarFallback className="bg-primary/10 text-primary">
              {categoryIcons[category]}
            </AvatarFallback>
          </Avatar>
          <span className="text-muted-foreground capitalize">{category}</span>
        </div>
      );
    },
    size: 170,
    meta: { filterVariant: "select" },
  },
  {
    header: "Barcode",
    accessorKey: "barcode",
    cell: ({ row }) => (
      <span className="font-mono text-muted-foreground text-sm">
        {row.getValue("barcode")}
      </span>
    ),
    size: 150,
  },
  {
    header: "Cost",
    accessorKey: "costGyd",
    cell: ({ row }) => (
      <span className="font-mono tabular-nums">
        {formatGyd(row.getValue("costGyd"))}
      </span>
    ),
  },
  {
    header: "Stock",
    accessorKey: "stock",
    cell: ({ row }) => {
      const stock = row.getValue("stock") as number;
      const low = stock <= row.original.reorderLevel;

      return (
        <span
          className={cn(
            "font-mono tabular-nums",
            stock === 0 && "text-destructive",
            stock > 0 && low && "text-amber-600 dark:text-amber-400"
          )}
        >
          {stock}
        </span>
      );
    },
  },
  {
    header: "Status",
    accessorKey: "status",
    cell: ({ row }) => {
      const status = row.getValue("status") as ProductItem["status"];

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
    meta: { filterVariant: "select" },
  },
  {
    id: "actions",
    header: () => "Actions",
    cell: () => <RowActions />,
    size: 60,
    enableHiding: false,
  },
];

const pageSizeOptions = [5, 10, 25, 50];

function ProductDatatable({ data }: { data: ProductItem[] }) {
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
    getFacetedMinMaxValues: getFacetedMinMaxValues(),
    enableSortingRemoval: false,
    getPaginationRowModel: getPaginationRowModel(),
    onPaginationChange: setPagination,
  });

  const rowsToExport = () => {
    const selectedRows = table.getSelectedRowModel().rows;

    return selectedRows.length > 0
      ? selectedRows.map((row) => row.original)
      : table.getFilteredRowModel().rows.map((row) => row.original);
  };

  const downloadFile = (blob: Blob, extension: string) => {
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    const stamp = new Date().toISOString().split("T")[0];

    link.setAttribute("href", url);
    link.setAttribute("download", `products-export-${stamp}.${extension}`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportToCSV = () => {
    const csv = Papa.unparse(rowsToExport(), { header: true });

    downloadFile(new Blob([csv], { type: "text/csv;charset=utf-8;" }), "csv");
  };

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(rowsToExport());
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Products");
    XLSX.writeFile(
      workbook,
      `products-export-${new Date().toISOString().split("T")[0]}.xlsx`
    );
  };

  const exportToJSON = () => {
    const json = JSON.stringify(rowsToExport(), null, 2);

    downloadFile(new Blob([json], { type: "application/json" }), "json");
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
            <FacetedFilter
              column={table.getColumn("category") as Column<ProductItem>}
            />
            <FacetedFilter
              column={table.getColumn("status") as Column<ProductItem>}
            />
            <TextFilter
              column={table.getColumn("product") as Column<ProductItem>}
            />
          </div>
        </div>
        <div className="flex gap-4 p-6 max-sm:flex-col sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Label className="sr-only" htmlFor="rowSelect">
              Show
            </Label>
            <Select
              items={pageSizeOptions.map((s) => ({
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
              <SelectTrigger className="w-fit whitespace-nowrap" id="rowSelect">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {pageSizeOptions.map((size) => (
                    <SelectItem key={size} value={size.toString()}>
                      {size} / page
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button className="bg-primary/10 text-primary hover:bg-primary/20" />
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
              Add product
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
                    {renderHeader(header)}
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

      <TablePagination
        pages={pages}
        showLeftEllipsis={showLeftEllipsis}
        showRightEllipsis={showRightEllipsis}
        table={table}
      />
    </div>
  );
}

export default ProductDatatable;

function renderHeader(
  header: ReturnType<
    ReturnType<typeof useReactTable<ProductItem>>["getHeaderGroups"]
  >[number]["headers"][number]
) {
  if (header.isPlaceholder) {
    return null;
  }

  if (!header.column.getCanSort()) {
    return flexRender(header.column.columnDef.header, header.getContext());
  }

  const sorted = header.column.getIsSorted();

  return (
    <button
      className="flex h-full cursor-pointer select-none items-center justify-between gap-2"
      onClick={header.column.getToggleSortingHandler()}
      type="button"
    >
      {flexRender(header.column.columnDef.header, header.getContext())}
      {sorted === "asc" && (
        <ChevronUpIcon
          aria-hidden="true"
          className="size-4 shrink-0 opacity-60"
        />
      )}
      {sorted === "desc" && (
        <ChevronDownIcon
          aria-hidden="true"
          className="size-4 shrink-0 opacity-60"
        />
      )}
    </button>
  );
}

function useSortedUniqueValues(column: Column<ProductItem>) {
  const facetedUniqueValues = column.getFacetedUniqueValues();

  return useMemo(() => {
    const values = Array.from(facetedUniqueValues.keys());

    return Array.from(new Set(values)).sort();
  }, [facetedUniqueValues]);
}

function FacetedFilter({ column }: { column: Column<ProductItem> }) {
  const id = useId();
  const columnFilterValue = column.getFilterValue();
  const columnHeader =
    typeof column.columnDef.header === "string" ? column.columnDef.header : "";
  const sortedUniqueValues = useSortedUniqueValues(column);

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

function TextFilter({ column }: { column: Column<ProductItem> }) {
  const id = useId();
  const columnFilterValue = column.getFilterValue();
  const columnHeader =
    typeof column.columnDef.header === "string" ? column.columnDef.header : "";

  return (
    <div className="flex w-full flex-col gap-2">
      <Label htmlFor={`${id}-input`}>Search {columnHeader}</Label>
      <InputGroup>
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput
          id={`${id}-input`}
          onChange={(e) => column.setFilterValue(e.target.value)}
          placeholder="Search by product name"
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
        render={<Button aria-label="Row actions" size="icon" variant="ghost" />}
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
            <span>Archive</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TablePagination({
  table,
  pages,
  showLeftEllipsis,
  showRightEllipsis,
}: {
  table: ReturnType<typeof useReactTable<ProductItem>>;
  pages: number[];
  showLeftEllipsis: boolean;
  showRightEllipsis: boolean;
}) {
  const { pageIndex, pageSize } = table.getState().pagination;
  const start = pageIndex * pageSize + 1;
  const end = Math.min(
    Math.max(pageIndex * pageSize + pageSize, 0),
    table.getRowCount()
  );

  return (
    <div className="flex items-center justify-between gap-3 px-6 py-4 max-sm:flex-col">
      <p
        aria-live="polite"
        className="whitespace-nowrap text-muted-foreground text-sm"
      >
        Showing{" "}
        <span>
          {start} to {end}
        </span>{" "}
        of <span>{table.getRowCount().toString()} entries</span>
      </p>
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
            const isActive = page === pageIndex + 1;

            return (
              <PaginationItem key={page}>
                <Button
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    !isActive &&
                      "bg-primary/10 text-primary hover:bg-primary/20"
                  )}
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
  );
}
