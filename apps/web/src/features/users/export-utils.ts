// Ported from AdminCN utils/export-users-utils. The Excel (xlsx) path was
// dropped to avoid the heavy SheetJS dependency; Excel export now produces a
// spreadsheet-compatible CSV. CSV and JSON exports are faithful.
import { format } from "date-fns";
import Papa from "papaparse";

import type { AppUser } from "@/features/users/types";

interface UserExportRow {
  Billing: string;
  Email: string;
  "Joined Date": string;
  Name: string;
  Plan: string;
  Role: string;
  Status: string;
}

const toExportRows = (users: AppUser[]): UserExportRow[] =>
  users.map((user) => ({
    Name: user.name,
    Email: user.email,
    Role: user.role,
    Plan: user.plan,
    Billing: user.billing,
    Status: user.status,
    "Joined Date": format(new Date(user.joinedDate), "dd MMM yyyy"),
  }));

const getExportFilename = (extension: string): string =>
  `users-export-${new Date().toISOString().split("T")[0]}.${extension}`;

function download(content: string, type: string, filename: string): void {
  const blob = new Blob([content], { type });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportUsersToCSV(users: AppUser[]): void {
  const csv = Papa.unparse(toExportRows(users), { header: true });
  download(csv, "text/csv;charset=utf-8;", getExportFilename("csv"));
}

export function exportUsersToExcel(users: AppUser[]): void {
  // CSV is spreadsheet-compatible; opens directly in Excel/Sheets.
  const csv = Papa.unparse(toExportRows(users), { header: true });
  download(csv, "text/csv;charset=utf-8;", getExportFilename("csv"));
}

export function exportUsersToJSON(users: AppUser[]): void {
  const json = JSON.stringify(toExportRows(users), null, 2);
  download(json, "application/json", getExportFilename("json"));
}
