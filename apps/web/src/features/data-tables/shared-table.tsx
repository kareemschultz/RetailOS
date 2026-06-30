import { Button } from "@RetailOS/ui/components/button";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
} from "@RetailOS/ui/components/pagination";
import { usePagination } from "@RetailOS/ui/hooks/use-pagination";
import { cn } from "@RetailOS/ui/lib/utils";
import type { Header, Table as TanstackTable } from "@tanstack/react-table";
import { flexRender } from "@tanstack/react-table";
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
} from "lucide-react";

export function SortableHeader<TData>({
  header,
}: {
  header: Header<TData, unknown>;
}) {
  if (header.isPlaceholder) {
    return null;
  }

  if (!header.column.getCanSort()) {
    return (
      <>{flexRender(header.column.columnDef.header, header.getContext())}</>
    );
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

export function DataTablePagination<TData>({
  table,
}: {
  table: TanstackTable<TData>;
}) {
  const { pageIndex, pageSize } = table.getState().pagination;
  const start = pageIndex * pageSize + 1;
  const end = Math.min(
    Math.max(pageIndex * pageSize + pageSize, 0),
    table.getRowCount()
  );

  const { pages, showLeftEllipsis, showRightEllipsis } = usePagination({
    currentPage: pageIndex + 1,
    totalPages: table.getPageCount(),
    paginationItemsToDisplay: 2,
  });

  return (
    <div className="flex items-center justify-between gap-3 px-6 py-4 max-sm:flex-col md:max-lg:flex-col">
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
