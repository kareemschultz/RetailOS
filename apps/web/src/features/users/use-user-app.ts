// React Imports
import { useCallback, useMemo } from "react";
// Util Imports
import {
  exportUsersToCSV,
  exportUsersToExcel,
  exportUsersToJSON,
} from "@/features/users/export-utils";

// Store Imports
import { useUserStore } from "@/features/users/store";
// Type Imports
import type {
  AppUser,
  UserFilters,
  UserFormData,
  UserSortColumn,
  UserSorting,
  UserStatus,
} from "@/features/users/types";

const filterUsers = (users: AppUser[], filters: UserFilters): AppUser[] => {
  const normalizedSearch = filters.search.trim().toLowerCase();

  return users.filter((user) => {
    if (filters.role !== "all" && user.role !== filters.role) {
      return false;
    }

    if (filters.plan !== "all" && user.plan !== filters.plan) {
      return false;
    }

    if (filters.status !== "all" && user.status !== filters.status) {
      return false;
    }

    if (normalizedSearch) {
      const matchesName = user.name.toLowerCase().includes(normalizedSearch);
      const matchesEmail = user.email.toLowerCase().includes(normalizedSearch);

      if (!(matchesName || matchesEmail)) {
        return false;
      }
    }

    return true;
  });
};

const compareUsers = (
  a: AppUser,
  b: AppUser,
  column: UserSortColumn
): number => {
  switch (column) {
    case "user":
      return a.name.localeCompare(b.name);
    case "role":
      return a.role.localeCompare(b.role);
    case "plan":
      return a.plan.localeCompare(b.plan);
    case "billing":
      return a.billing.localeCompare(b.billing);
    case "status":
      return a.status.localeCompare(b.status);
    case "joinedDate":
      return (
        new Date(a.joinedDate).getTime() - new Date(b.joinedDate).getTime()
      );
    default:
      return 0;
  }
};

const sortUsers = (
  users: AppUser[],
  sorting: UserSorting | null
): AppUser[] => {
  if (!sorting) {
    return users;
  }

  return [...users].sort((a, b) => {
    const comparison = compareUsers(a, b, sorting.id);

    return sorting.desc ? -comparison : comparison;
  });
};

export function useUserApp() {
  const users = useUserStore((state) => state.users);
  const filters = useUserStore((state) => state.filters);
  const rowsPerPage = useUserStore((state) => state.rowsPerPage);
  const currentPage = useUserStore((state) => state.currentPage);
  const selectedUserIds = useUserStore((state) => state.selectedUserIds);
  const sorting = useUserStore((state) => state.sorting);
  const sheetMode = useUserStore((state) => state.sheetMode);
  const editingUserId = useUserStore((state) => state.editingUserId);
  const isImportDialogOpen = useUserStore((state) => state.isImportDialogOpen);
  const addUser = useUserStore((state) => state.addUser);
  const updateUser = useUserStore((state) => state.updateUser);
  const deleteUser = useUserStore((state) => state.deleteUser);
  const deleteUsers = useUserStore((state) => state.deleteUsers);
  const updateUserStatus = useUserStore((state) => state.updateUserStatus);
  const updateUsersStatus = useUserStore((state) => state.updateUsersStatus);
  const setFilters = useUserStore((state) => state.setFilters);
  const setRowsPerPage = useUserStore((state) => state.setRowsPerPage);
  const setCurrentPage = useUserStore((state) => state.setCurrentPage);
  const setSorting = useUserStore((state) => state.setSorting);
  const toggleSelectUser = useUserStore((state) => state.toggleSelectUser);
  const toggleSelectAll = useUserStore((state) => state.toggleSelectAll);
  const clearSelection = useUserStore((state) => state.clearSelection);
  const openAddSheet = useUserStore((state) => state.openAddSheet);
  const openEditSheet = useUserStore((state) => state.openEditSheet);
  const closeSheet = useUserStore((state) => state.closeSheet);
  const openImportDialog = useUserStore((state) => state.openImportDialog);
  const closeImportDialog = useUserStore((state) => state.closeImportDialog);
  const importUsers = useUserStore((state) => state.importUsers);

  const stats = useMemo(
    () => ({
      totalUsers: users.length,
      activeUsers: users.filter((user) => user.status === "Active").length,
      pendingUsers: users.filter((user) => user.status === "Pending").length,
      paidUsers: users.filter((user) => user.plan !== "Basic").length,
    }),
    [users]
  );

  const filteredUsers = useMemo(
    () => filterUsers(users, filters),
    [filters, users]
  );

  const sortedUsers = useMemo(
    () => sortUsers(filteredUsers, sorting),
    [filteredUsers, sorting]
  );

  const totalFilteredCount = sortedUsers.length;

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(totalFilteredCount / rowsPerPage)),
    [rowsPerPage, totalFilteredCount]
  );

  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;

    return sortedUsers.slice(startIndex, startIndex + rowsPerPage);
  }, [currentPage, rowsPerPage, sortedUsers]);

  const showingFrom =
    totalFilteredCount === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1;

  const showingTo = Math.min(currentPage * rowsPerPage, totalFilteredCount);

  const editingUser = useMemo(
    () => users.find((user) => user.id === editingUserId) ?? null,
    [editingUserId, users]
  );

  const paginatedUserIds = useMemo(
    () => paginatedUsers.map((user) => user.id),
    [paginatedUsers]
  );

  const isAllSelected =
    paginatedUsers.length > 0 &&
    paginatedUserIds.every((id) => selectedUserIds.includes(id));

  const isIndeterminate =
    paginatedUserIds.some((id) => selectedUserIds.includes(id)) &&
    !isAllSelected;

  // Vars
  // Converts string[] → Record<string, boolean> for TanStack controlled selection
  const rowSelection = Object.fromEntries(
    selectedUserIds.map((id) => [id, true])
  );

  const handleFilterChange = useCallback(
    (nextFilters: Partial<UserFilters>) => {
      setFilters(nextFilters);
    },
    [setFilters]
  );

  const handleSearchChange = useCallback(
    (search: string) => {
      setFilters({ search });
    },
    [setFilters]
  );

  const handleRowsPerPageChange = useCallback(
    (n: number) => {
      setRowsPerPage(n);
    },
    [setRowsPerPage]
  );

  const handlePageChange = useCallback(
    (page: number) => {
      setCurrentPage(page);
    },
    [setCurrentPage]
  );

  const handleSortingChange = useCallback(
    (nextSorting: UserSorting | null) => {
      setSorting(nextSorting);
    },
    [setSorting]
  );

  const handleSelectUser = useCallback(
    (id: string) => {
      toggleSelectUser(id);
    },
    [toggleSelectUser]
  );

  const handleSelectAll = useCallback(
    (userIds: string[]) => {
      toggleSelectAll(userIds);
    },
    [toggleSelectAll]
  );

  const handleClearSelection = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

  const handleAddUser = useCallback(
    (data: UserFormData) => {
      addUser(data);
    },
    [addUser]
  );

  const handleUpdateUser = useCallback(
    (id: string, data: Partial<UserFormData>) => {
      updateUser(id, data);
    },
    [updateUser]
  );

  const handleDeleteUser = useCallback(
    (id: string) => {
      deleteUser(id);
    },
    [deleteUser]
  );

  const handleBulkDelete = useCallback(() => {
    deleteUsers(selectedUserIds);
  }, [deleteUsers, selectedUserIds]);

  const handleUpdateStatus = useCallback(
    (id: string, status: UserStatus) => {
      updateUserStatus(id, status);
    },
    [updateUserStatus]
  );

  const handleBulkUpdateStatus = useCallback(
    (status: UserStatus) => {
      updateUsersStatus(selectedUserIds, status);
    },
    [selectedUserIds, updateUsersStatus]
  );

  const handleOpenAddSheet = useCallback(() => {
    openAddSheet();
  }, [openAddSheet]);

  const handleOpenEditSheet = useCallback(
    (userId: string) => {
      openEditSheet(userId);
    },
    [openEditSheet]
  );

  const handleCloseSheet = useCallback(() => {
    closeSheet();
  }, [closeSheet]);

  const handleOpenImportDialog = useCallback(() => {
    openImportDialog();
  }, [openImportDialog]);

  const handleCloseImportDialog = useCallback(() => {
    closeImportDialog();
  }, [closeImportDialog]);

  const handleImportUsers = useCallback(
    (incoming: Partial<AppUser>[]) => {
      importUsers(incoming);
    },
    [importUsers]
  );

  const getExportUsers = useCallback((): AppUser[] => {
    if (selectedUserIds.length > 0) {
      return filteredUsers.filter((user) => selectedUserIds.includes(user.id));
    }

    return filteredUsers;
  }, [filteredUsers, selectedUserIds]);

  const handleExportCsv = useCallback(() => {
    exportUsersToCSV(getExportUsers());
  }, [getExportUsers]);

  const handleExportExcel = useCallback(() => {
    exportUsersToExcel(getExportUsers());
  }, [getExportUsers]);

  const handleExportJson = useCallback(() => {
    exportUsersToJSON(getExportUsers());
  }, [getExportUsers]);

  return {
    users,
    stats,
    filters,
    paginatedUsers,
    filteredUsers,
    sortedUsers,
    totalPages,
    totalFilteredCount,
    showingFrom,
    showingTo,
    rowsPerPage,
    currentPage,
    selectedUserIds,
    isAllSelected,
    isIndeterminate,
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
    handleSelectAll,
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
  };
}
