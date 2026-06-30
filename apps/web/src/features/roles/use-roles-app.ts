// React Imports
import { useCallback, useMemo } from "react";

// Type Imports
import type {
  AppRoleWithUsers,
  PermissionKey,
  RoleFormData,
} from "@/features/roles/role-types";

// Store Imports
import {
  PERMISSION_RESOURCES,
  useRolesStore,
} from "@/features/roles/use-roles-store";
import { useUserStore } from "@/features/users/store";

export function useRolesApp() {
  // Store subscriptions
  const roles = useRolesStore((state) => state.roles);
  const dialogMode = useRolesStore((state) => state.dialogMode);
  const editingRoleId = useRolesStore((state) => state.editingRoleId);
  const addRole = useRolesStore((state) => state.addRole);
  const updateRole = useRolesStore((state) => state.updateRole);
  const deleteRole = useRolesStore((state) => state.deleteRole);
  const openAddDialog = useRolesStore((state) => state.openAddDialog);
  const openEditDialog = useRolesStore((state) => state.openEditDialog);
  const closeDialog = useRolesStore((state) => state.closeDialog);
  const updatePermission = useRolesStore((state) => state.updatePermission);

  const allUsers = useUserStore((state) => state.users);

  // Hooks
  const rolesWithUsers = useMemo<AppRoleWithUsers[]>(
    () =>
      roles.map((role) => ({
        ...role,
        users: allUsers
          .filter((u) => u.role === role.name)
          .slice(0, 10)
          .map((u) => ({ id: u.id, name: u.name, avatar: u.avatar })),
      })),
    [roles, allUsers]
  );

  const editingRole = useMemo(
    () => rolesWithUsers.find((r) => r.id === editingRoleId) ?? null,
    [editingRoleId, rolesWithUsers]
  );

  const handleAddRole = useCallback(
    (data: RoleFormData) => {
      addRole(data);
    },
    [addRole]
  );

  const handleUpdateRole = useCallback(
    (id: string, data: RoleFormData) => {
      updateRole(id, data);
    },
    [updateRole]
  );

  const handleDeleteRole = useCallback(
    (id: string) => {
      deleteRole(id);
    },
    [deleteRole]
  );

  const handleOpenAdd = useCallback(() => {
    openAddDialog();
  }, [openAddDialog]);

  const handleOpenEdit = useCallback(
    (id: string) => {
      openEditDialog(id);
    },
    [openEditDialog]
  );

  const handleCloseDialog = useCallback(() => {
    closeDialog();
  }, [closeDialog]);

  const handlePermissionChange = useCallback(
    (
      roleId: string,
      resource: string,
      action: PermissionKey,
      value: boolean
    ) => {
      updatePermission(roleId, resource, action, value);
    },
    [updatePermission]
  );

  return {
    rolesWithUsers,
    dialogMode,
    editingRole,
    permissionResources: PERMISSION_RESOURCES,
    handleAddRole,
    handleUpdateRole,
    handleDeleteRole,
    handleOpenAdd,
    handleOpenEdit,
    handleCloseDialog,
    handlePermissionChange,
  };
}
