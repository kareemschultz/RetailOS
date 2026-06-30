// Component Imports
import { Card } from "@RetailOS/ui/components/card";
import { AddEditUserSheet } from "@/features/users/add-edit-user-sheet";
import { ImportUsersDialog } from "@/features/users/import-users-dialog";
// Hook Imports
import { useUserApp } from "@/features/users/use-user-app";
import { UserBulkActionBar } from "./user-bulk-action-bar";
import { UserPagination } from "./user-pagination";
import { UserStatsCards } from "./user-stats-cards";
import { UserTable } from "./user-table";
import { UserTableFilters } from "./user-table-filters";
import { UserTableToolbar } from "./user-table-toolbar";

const UserListApp = () => {
  const {
    stats,
    filters,
    paginatedUsers,
    totalPages,
    totalFilteredCount,
    showingFrom,
    showingTo,
    rowsPerPage,
    currentPage,
    selectedUserIds,
    rowSelection,
    sorting,
    sheetMode,
    editingUser,
    isImportDialogOpen,
    handleFilterChange,
    handleSearchChange,
    handleRowsPerPageChange,
    handlePageChange,
    handleSortingChange,
    handleSelectUser,
    handleClearSelection,
    handleAddUser,
    handleUpdateUser,
    handleDeleteUser,
    handleBulkDelete,
    handleUpdateStatus,
    handleBulkUpdateStatus,
    handleOpenAddSheet,
    handleOpenEditSheet,
    handleCloseSheet,
    handleOpenImportDialog,
    handleCloseImportDialog,
    handleImportUsers,
    handleExportCsv,
    handleExportExcel,
    handleExportJson,
  } = useUserApp();

  return (
    <div className="flex flex-col gap-3 lg:gap-6">
      <UserStatsCards stats={stats} />

      <Card className="py-0 shadow-none">
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
            {selectedUserIds.length > 0 ? (
              <UserBulkActionBar
                onBulkDelete={handleBulkDelete}
                onBulkStatusChange={handleBulkUpdateStatus}
                onClearSelection={handleClearSelection}
                selectedCount={selectedUserIds.length}
              />
            ) : null}
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
      </Card>

      <AddEditUserSheet
        mode={sheetMode}
        onAdd={handleAddUser}
        onClose={handleCloseSheet}
        onEdit={handleUpdateUser}
        user={editingUser}
      />
      <ImportUsersDialog
        onClose={handleCloseImportDialog}
        onImport={handleImportUsers}
        open={isImportDialogOpen}
      />
    </div>
  );
};

export default UserListApp;
