// Component Imports
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@RetailOS/ui/components/card";
// Hook Imports
import { useRolesApp } from "@/features/roles/use-roles-app";
import { AddEditUserSheet } from "@/features/users/add-edit-user-sheet";
import { useUserApp } from "@/features/users/use-user-app";
import { UserPagination } from "@/features/users/user-pagination";
import { UserTable } from "@/features/users/user-table";
import { UserTableFilters } from "@/features/users/user-table-filters";
import { UserTableToolbar } from "@/features/users/user-table-toolbar";

// Component Imports
import { RolePermissionDialog } from "./role-permission-dialog";
import { RolesGrid } from "./roles-grid";

// -------------------------------------------------------------------------------------------------

export function RolesApp() {
  // Hooks
  const {
    rolesWithUsers,
    dialogMode,
    editingRole,
    permissionResources,
    handleAddRole,
    handleUpdateRole,
    handleDeleteRole,
    handleOpenAdd,
    handleOpenEdit,
    handleCloseDialog,
  } = useRolesApp();

  const {
    filters,
    paginatedUsers,
    totalPages,
    totalFilteredCount,
    showingFrom,
    showingTo,
    rowsPerPage,
    currentPage,
    rowSelection,
    sorting,
    sheetMode,
    editingUser,
    handleFilterChange,
    handleSearchChange,
    handleRowsPerPageChange,
    handlePageChange,
    handleSortingChange,
    handleSelectUser,
    handleAddUser,
    handleUpdateUser,
    handleDeleteUser,
    handleUpdateStatus,
    handleOpenEditSheet,
    handleCloseSheet,
    handleExportCsv,
    handleExportExcel,
    handleExportJson,
    handleOpenAddSheet,
    handleOpenImportDialog,
  } = useUserApp();

  return (
    <div className="flex flex-col gap-6">
      <RolesGrid
        onAddNew={handleOpenAdd}
        onDelete={handleDeleteRole}
        onEdit={handleOpenEdit}
        roles={rolesWithUsers}
      />

      <RolePermissionDialog
        dialogMode={dialogMode}
        editingRole={editingRole}
        onAddRole={handleAddRole}
        onClose={handleCloseDialog}
        onUpdateRole={handleUpdateRole}
        permissionResources={permissionResources}
      />

      <Card className="gap-0 py-0 shadow-none">
        <CardHeader className="border-b px-6 py-5">
          <CardTitle className="font-medium text-lg">
            Total users with their roles
          </CardTitle>
          <CardDescription>
            Find all of your company&apos;s administrator accounts and their
            associate roles.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="w-full">
            <div className="border-b">
              <UserTableFilters
                filters={filters}
                onFilterChange={handleFilterChange}
              />
              <UserTableToolbar
                onExportCsv={handleExportCsv}
                onExportExcel={handleExportExcel}
                onExportJson={handleExportJson}
                onOpenAddSheet={handleOpenAddSheet}
                onOpenImportDialog={handleOpenImportDialog}
                onRowsPerPageChange={handleRowsPerPageChange}
                onSearch={handleSearchChange}
                rowsPerPage={rowsPerPage}
                search={filters.search}
              />
              <UserTable
                onDeleteUser={handleDeleteUser}
                onEditUser={handleOpenEditSheet}
                onSelectUser={handleSelectUser}
                onSortingChange={handleSortingChange}
                onStatusChange={handleUpdateStatus}
                paginatedUsers={paginatedUsers}
                rowSelection={rowSelection}
                sorting={sorting}
                totalPages={totalPages}
              />
            </div>

            <UserPagination
              currentPage={currentPage}
              onPageChange={handlePageChange}
              showingFrom={showingFrom}
              showingTo={showingTo}
              total={totalFilteredCount}
              totalPages={totalPages}
            />
          </div>
        </CardContent>
      </Card>

      <AddEditUserSheet
        mode={sheetMode}
        onAdd={handleAddUser}
        onClose={handleCloseSheet}
        onEdit={handleUpdateUser}
        user={editingUser}
      />
    </div>
  );
}
