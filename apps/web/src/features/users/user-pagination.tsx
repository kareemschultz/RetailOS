// Third-party Imports

// Component Imports
import { Button } from "@RetailOS/ui/components/button";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
} from "@RetailOS/ui/components/pagination";
// Hook Imports
import { usePagination } from "@RetailOS/ui/hooks/use-pagination";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

export interface UserPaginationProps {
  currentPage: number;
  onPageChange: (page: number) => void;
  showingFrom: number;
  showingTo: number;
  total: number;
  totalPages: number;
}

export function UserPagination({
  showingFrom,
  showingTo,
  total,
  currentPage,
  totalPages,
  onPageChange,
}: UserPaginationProps) {
  const { pages, showLeftEllipsis, showRightEllipsis } = usePagination({
    currentPage,
    totalPages,
    paginationItemsToDisplay: 2,
  });

  return (
    <div className="flex items-center justify-between gap-3 px-6 py-4 max-sm:flex-col md:max-lg:flex-col">
      <p
        aria-live="polite"
        className="whitespace-nowrap text-muted-foreground text-sm"
      >
        Showing <span>{showingFrom}</span> to <span>{showingTo}</span> of{" "}
        <span>{total}</span> entries
      </p>

      <div>
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <Button
                aria-label="Go to previous page"
                className="disabled:pointer-events-none disabled:opacity-50"
                disabled={currentPage <= 1}
                onClick={() => onPageChange(currentPage - 1)}
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
              const isActive = page === currentPage;

              return (
                <PaginationItem key={page}>
                  <Button
                    aria-current={isActive ? "page" : undefined}
                    className={`${!isActive && "bg-primary/10 text-primary hover:bg-primary/20 focus-visible:ring-primary/20 dark:focus-visible:ring-primary/40"}`}
                    onClick={() => onPageChange(page)}
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
                disabled={currentPage >= totalPages}
                onClick={() => onPageChange(currentPage + 1)}
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
  );
}
