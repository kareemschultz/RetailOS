import { Badge } from "@RetailOS/ui/components/badge";
import { Button } from "@RetailOS/ui/components/button";
import { Card, CardContent } from "@RetailOS/ui/components/card";
import { cn } from "@RetailOS/ui/lib/utils";
import { type ReactNode, useRef } from "react";

const CSV_ESCAPE_REQUIRED_PATTERN = /[,"\n\r]/;

type ExportCellValue = boolean | Date | null | number | string | undefined;

type ExportRow = Record<string, ExportCellValue>;

interface DataTableCardProps {
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  count?: number;
  exportable?: boolean;
  exportDisabled?: boolean;
  exportFilename?: string;
  exportRows?: ExportRow[];
  footer?: ReactNode;
  title: string;
}

function normaliseExportValue(value: ExportCellValue): string {
  if (value == null) {
    return "";
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value);
}

function csvEscape(value: ExportCellValue): string {
  const normalised = normaliseExportValue(value);

  if (CSV_ESCAPE_REQUIRED_PATTERN.test(normalised)) {
    return `"${normalised.replaceAll('"', '""')}"`;
  }

  return normalised;
}

function htmlEscape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeFilename(filename: string): string {
  const trimmed = filename.trim().toLowerCase();
  const safe = trimmed.replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return safe || "retailos-export";
}

function downloadTextFile(
  filename: string,
  mimeType: string,
  content: string
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function buildCsv(rows: ExportRow[]): string {
  const headers = Object.keys(rows[0] ?? {});
  const lines = [
    headers.map(csvEscape).join(","),
    ...rows.map((row) =>
      headers.map((header) => csvEscape(row[header])).join(",")
    ),
  ];

  return lines.join("\n");
}

function buildExcelHtml(rows: ExportRow[], title: string): string {
  const headers = Object.keys(rows[0] ?? {});
  const headerCells = headers
    .map((header) => `<th>${htmlEscape(header)}</th>`)
    .join("");
  const bodyRows = rows
    .map((row) => {
      const cells = headers
        .map(
          (header) =>
            `<td>${htmlEscape(normaliseExportValue(row[header]))}</td>`
        )
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${htmlEscape(title)}</title>
</head>
<body>
  <table>
    <thead><tr>${headerCells}</tr></thead>
    <tbody>${bodyRows}</tbody>
  </table>
</body>
</html>`;
}

function extractRenderedTableRows(
  container: HTMLDivElement | null
): ExportRow[] {
  const table = container?.querySelector("table");

  if (!table) {
    return [];
  }

  const headerCells = Array.from(table.querySelectorAll("thead th"));
  const headers = headerCells.map((cell, index) => {
    const label = cell.textContent?.trim().replace(/\s+/g, " ");
    return label || `Column ${index + 1}`;
  });

  const bodyRows = Array.from(table.querySelectorAll("tbody tr"));

  return bodyRows
    .map((row) => {
      const cells = Array.from(row.querySelectorAll("td"));
      return cells.reduce<ExportRow>((acc, cell, index) => {
        const header = headers[index] ?? `Column ${index + 1}`;
        acc[header] = cell.textContent?.trim().replace(/\s+/g, " ") ?? "";
        return acc;
      }, {});
    })
    .filter((row) =>
      Object.values(row).some((value) => normaliseExportValue(value))
    );
}

// Owned shadcn Studio "datatable" shell: a card with a flush toolbar (title +
// optional count badge on the left, actions/search on the right), a bordered
// content area for the table, and an optional footer. `gap-0` keeps the toolbar
// flush against the content — the Card primitive's default `gap-4` would float
// it off. Use for every dense operational list surface so a header can never be
// cramped by ad-hoc `Card p-0` composition (which inherits no header padding —
// the catalog-card bug). One owned shell = one consistent, re-themed look.
export function DataTableCard({
  title,
  count,
  actions,
  exportable = true,
  exportDisabled,
  exportFilename,
  exportRows,
  footer,
  className,
  children,
}: DataTableCardProps) {
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const filenameBase = safeFilename(exportFilename ?? title);

  const getRowsToExport = () =>
    exportRows?.length
      ? exportRows
      : extractRenderedTableRows(tableContainerRef.current);

  const handleCsvExport = () => {
    const rows = getRowsToExport();

    if (!rows.length) {
      return;
    }

    downloadTextFile(
      `${filenameBase}.csv`,
      "text/csv;charset=utf-8;",
      buildCsv(rows)
    );
  };

  const handleExcelExport = () => {
    const rows = getRowsToExport();

    if (!rows.length) {
      return;
    }

    downloadTextFile(
      `${filenameBase}.xls`,
      "application/vnd.ms-excel;charset=utf-8;",
      buildExcelHtml(rows, title)
    );
  };

  return (
    <Card className={cn("gap-0 overflow-hidden p-0 shadow-sm", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <div className="flex items-center gap-2">
          <h2 className="font-medium text-sm">{title}</h2>
          {count == null ? null : <Badge variant="secondary">{count}</Badge>}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {actions}
          {exportable ? (
            <div className="flex items-center gap-1">
              <Button
                aria-label={`Export ${title} as CSV`}
                disabled={exportDisabled}
                onClick={handleCsvExport}
                size="sm"
                type="button"
                variant="outline"
              >
                CSV
              </Button>
              <Button
                aria-label={`Export ${title} for Excel`}
                disabled={exportDisabled}
                onClick={handleExcelExport}
                size="sm"
                type="button"
                variant="outline"
              >
                Excel
              </Button>
            </div>
          ) : null}
        </div>
      </div>
      <CardContent className="p-0">
        <div className="w-full overflow-x-auto" ref={tableContainerRef}>
          {children}
        </div>
      </CardContent>
      {footer ? (
        <div className="border-t px-5 py-3 text-muted-foreground text-sm">
          {footer}
        </div>
      ) : null}
    </Card>
  );
}
