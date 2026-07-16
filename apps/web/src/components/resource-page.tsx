import { Button } from "@RetailOS/ui/components/button";
import { DataTableCard } from "@RetailOS/ui/components/data-table-card";
import { Input } from "@RetailOS/ui/components/input";
import {
  PageBody,
  PageHeader,
  PageMetrics,
} from "@RetailOS/ui/components/page-header";
import { Skeleton } from "@RetailOS/ui/components/skeleton";
import { StatCard } from "@RetailOS/ui/components/stat-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@RetailOS/ui/components/table";
import { cn } from "@RetailOS/ui/lib/utils";
import type { LucideIcon } from "lucide-react";
import { Inbox, Plus, Search } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";

import { EmptyState, ErrorState } from "@/components/states";
import type { FeatureKey } from "@/data/feature-status";
import { FeatureStatusBadge } from "@/data/feature-status-badge";

const SKELETON_KEYS = ["a", "b", "c", "d", "e", "f"] as const;

/** A single metric shown in the PageMetrics strip. */
export interface ResourceMetric {
  hint?: string;
  icon: LucideIcon;
  label: string;
  value: ReactNode;
}

/** A column definition for the resource table. */
export interface ResourceColumn<T> {
  /** Right-align (numeric/money) columns per the design language. */
  align?: "left" | "right";
  /** Render the cell. Return a string/number or any node. */
  cell: (row: T) => ReactNode;
  className?: string;
  header: string;
  headerClassName?: string;
  key: string;
}

export interface ResourcePageProps<T> {
  /** Content rendered above the table (filters, tabs). */
  children?: ReactNode;
  columns: ResourceColumn<T>[];
  description: string;
  emptyDescription?: string;
  emptyIcon?: LucideIcon;
  emptyTitle?: string;
  errorMessage?: string;
  feature: FeatureKey;
  /** Extra header actions (kebab, secondary buttons). */
  headerActions?: ReactNode;
  icon?: LucideIcon;
  isError?: boolean;
  isLoading: boolean;
  metrics?: ResourceMetric[];
  onRetry?: () => void;
  /** Row click handler (opens detail/sheet). */
  onRowClick?: (row: T) => void;
  /** Primary create action. */
  primaryAction?: { label: string; icon?: LucideIcon; onClick: () => void };
  rowKey: (row: T) => string;
  rows: T[] | undefined;
  /** Predicate used by the built-in search box. Omit to hide search. */
  searchFilter?: (row: T, query: string) => boolean;
  searchPlaceholder?: string;
  tableTitle?: string;
  title: string;
  /** Extra toolbar actions (right of search). */
  toolbarActions?: ReactNode;
}

/**
 * ResourcePage — the canonical list surface for RetailOS modules. It enforces
 * the design-language flow (Header → Context → Actions → Metrics → work area),
 * wires the honest FeatureStatusBadge for mock/partial surfaces, and renders a
 * column-driven table inside the owned DataTableCard shell with built-in
 * search, loading skeletons, error, and empty states. New modules configure it
 * declaratively instead of re-implementing table plumbing each time.
 */
export function ResourcePage<T>({
  title,
  description,
  feature,
  icon,
  metrics,
  columns,
  rows,
  isLoading,
  isError,
  errorMessage,
  onRetry,
  rowKey,
  searchFilter,
  searchPlaceholder = "Search",
  primaryAction,
  toolbarActions,
  headerActions,
  onRowClick,
  emptyTitle,
  emptyDescription,
  emptyIcon,
  tableTitle,
  children,
}: ResourcePageProps<T>) {
  const [query, setQuery] = useState("");

  const filteredRows = useMemo(() => {
    const data = rows ?? [];
    const q = query.trim();
    if (!(q && searchFilter)) {
      return data;
    }
    return data.filter((row) => searchFilter(row, q.toLowerCase()));
  }, [rows, query, searchFilter]);

  const settled = !(isLoading || isError);
  const PrimaryIcon = primaryAction?.icon ?? Plus;
  const HeaderIcon = icon;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 sm:p-6">
      <PageHeader
        actions={
          <div className="flex items-center gap-2">
            {headerActions}
            {primaryAction ? (
              <Button onClick={primaryAction.onClick}>
                <PrimaryIcon className="size-4" />
                {primaryAction.label}
              </Button>
            ) : null}
          </div>
        }
        description={description}
        title={
          <span className="flex items-center gap-3">
            {HeaderIcon ? (
              <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <HeaderIcon className="size-5" />
              </span>
            ) : null}
            {title}
            <FeatureStatusBadge featureKey={feature} />
          </span>
        }
      />

      {metrics && metrics.length > 0 ? (
        <PageMetrics>
          {metrics.map((metric) => (
            <StatCard
              hint={metric.hint}
              icon={metric.icon}
              key={metric.label}
              label={metric.label}
              value={metric.value}
            />
          ))}
        </PageMetrics>
      ) : null}

      <PageBody>
        {children}
        <DataTableCard
          actions={
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              {searchFilter ? (
                <div className="relative w-full sm:w-64">
                  <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="h-9 rounded-lg pl-9"
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={searchPlaceholder}
                    value={query}
                  />
                </div>
              ) : null}
              {toolbarActions}
            </div>
          }
          count={settled ? filteredRows.length : undefined}
          title={tableTitle ?? title}
        >
          <ResourceTableBody
            columns={columns}
            emptyDescription={emptyDescription}
            emptyIcon={emptyIcon ?? icon}
            emptyTitle={emptyTitle}
            errorMessage={errorMessage}
            isError={Boolean(isError)}
            isLoading={isLoading}
            onRetry={onRetry}
            onRowClick={onRowClick}
            rowKey={rowKey}
            rows={filteredRows}
          />
        </DataTableCard>
      </PageBody>
    </div>
  );
}

function ResourceTableBody<T>({
  columns,
  emptyDescription,
  emptyIcon,
  emptyTitle,
  errorMessage,
  isError,
  isLoading,
  onRetry,
  onRowClick,
  rowKey,
  rows,
}: {
  columns: ResourceColumn<T>[];
  emptyDescription?: string;
  emptyIcon?: LucideIcon;
  emptyTitle?: string;
  errorMessage?: string;
  isError: boolean;
  isLoading: boolean;
  onRetry?: () => void;
  onRowClick?: (row: T) => void;
  rowKey: (row: T) => string;
  rows: T[];
}) {
  if (isError) {
    return (
      <div className="p-4">
        <ErrorState
          message={errorMessage ?? "Could not load this data."}
          onRetry={onRetry}
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-px">
        {SKELETON_KEYS.map((key) => (
          <Skeleton className="h-[56px] rounded-none" key={key} />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        description={
          emptyDescription ?? "Nothing here yet. Create the first record."
        }
        icon={emptyIcon ?? Inbox}
        title={emptyTitle ?? "No records found"}
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((column) => (
            <TableHead
              className={cn(
                column.align === "right" && "text-right",
                column.headerClassName
              )}
              key={column.key}
            >
              {column.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow
            className={onRowClick ? "cursor-pointer" : undefined}
            key={rowKey(row)}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
          >
            {columns.map((column) => (
              <TableCell
                className={cn(
                  column.align === "right" &&
                    "text-right font-mono tabular-nums",
                  column.className
                )}
                key={column.key}
              >
                {column.cell(row)}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
