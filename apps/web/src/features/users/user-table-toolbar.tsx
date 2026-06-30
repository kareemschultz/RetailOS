// Third-party Imports

// Component Imports
import { Button } from "@RetailOS/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
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
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@RetailOS/ui/components/select";
import {
  DownloadIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  PlusIcon,
  SearchIcon,
  UploadIcon,
} from "lucide-react";

const ROWS_PER_PAGE_OPTIONS = [10, 25, 50, 100];

const ROWS_PER_PAGE_ITEMS = ROWS_PER_PAGE_OPTIONS.map((option) => ({
  label: String(option),
  value: String(option),
}));

export interface UserTableToolbarProps {
  onExportCsv: () => void;
  onExportExcel: () => void;
  onExportJson: () => void;
  onOpenAddSheet: () => void;
  onOpenImportDialog: () => void;
  onRowsPerPageChange: (rowsPerPage: number) => void;
  onSearch: (search: string) => void;
  rowsPerPage: number;
  search: string;
}

export function UserTableToolbar({
  search,
  rowsPerPage,
  onSearch,
  onRowsPerPageChange,
  onExportCsv,
  onExportExcel,
  onExportJson,
  onOpenAddSheet,
  onOpenImportDialog,
}: UserTableToolbarProps) {
  return (
    <div className="flex gap-4 p-6 max-sm:flex-col sm:items-center sm:justify-between">
      <div className="w-full max-w-2xs">
        <Label className="sr-only" htmlFor="search-user">
          Search User
        </Label>
        <InputGroup>
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            id="search-user"
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Search user"
            type="text"
            value={search}
          />
        </InputGroup>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:justify-between">
        <div className="flex items-center gap-2">
          <Label className="sr-only" htmlFor="rows-per-page">
            Show
          </Label>
          <Select
            items={ROWS_PER_PAGE_ITEMS}
            onValueChange={(value: string | null) => {
              if (value) {
                onRowsPerPageChange(Number(value));
              }
            }}
            value={String(rowsPerPage)}
          >
            <SelectTrigger
              className="w-fit whitespace-nowrap"
              id="rows-per-page"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {ROWS_PER_PAGE_OPTIONS.map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    {option}
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
            <span className="max-lg:hidden">Export</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-auto">
            <DropdownMenuItem onClick={onExportCsv}>
              <FileTextIcon className="size-4" />
              Export as CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onExportExcel}>
              <FileSpreadsheetIcon className="size-4" />
              Export as Excel
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onExportJson}>
              <FileTextIcon className="size-4" />
              Export as JSON
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button onClick={onOpenImportDialog} variant="outline">
          <DownloadIcon className="size-4" />
          <span className="max-lg:hidden">Import</span>
        </Button>

        <Button onClick={onOpenAddSheet}>
          <PlusIcon />
          <span className="max-lg:hidden">Add New User</span>
        </Button>
      </div>
    </div>
  );
}
