// Third-party Imports
import { create } from "zustand";

// Type Imports
import type {
  AppRole,
  PermissionKey,
  ResourcePermissions,
  RoleDialogMode,
  RoleFormData,
} from "@/features/roles/role-types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const PERMISSION_RESOURCES: string[] = [
  "User Management",
  "Content Management",
  "Disputes Management",
  "Database Management",
  "Financial Management",
  "Reporting",
  "API Control",
  "Repository Management",
  "Payroll",
];

// ---------------------------------------------------------------------------
// Initial seed data (replaces fake-db — data is small enough to live here)
// ---------------------------------------------------------------------------

const perm = (
  resource: string,
  read: boolean,
  write: boolean,
  create: boolean,
  del: boolean
): ResourcePermissions => ({
  resource,
  read,
  write,
  create,
  delete: del,
});

const INITIAL_ROLES: AppRole[] = [
  {
    id: "role-001",
    name: "Admin",
    permissions: PERMISSION_RESOURCES.map((r) =>
      perm(r, true, true, true, true)
    ),
  },
  {
    id: "role-002",
    name: "Editor",
    permissions: PERMISSION_RESOURCES.map((r) => {
      const canWrite = [
        "User Management",
        "Content Management",
        "Reporting",
      ].includes(r);
      const canCreate = ["Content Management", "Reporting"].includes(r);

      return perm(r, true, canWrite, canCreate, false);
    }),
  },
  {
    id: "role-003",
    name: "Maintainer",
    permissions: PERMISSION_RESOURCES.map((r) => {
      const technical = [
        "Database Management",
        "Repository Management",
        "API Control",
      ].includes(r);
      const canDelete = [
        "Database Management",
        "Repository Management",
      ].includes(r);

      return perm(r, true, technical, technical, canDelete);
    }),
  },
  {
    id: "role-004",
    name: "Subscriber",
    permissions: PERMISSION_RESOURCES.map((r) => {
      const canRead = ["Content Management", "Reporting"].includes(r);

      return perm(r, canRead, false, false, false);
    }),
  },
  {
    id: "role-005",
    name: "Guest",
    permissions: PERMISSION_RESOURCES.map((r) =>
      perm(r, r === "Reporting", false, false, false)
    ),
  },
];

// ---------------------------------------------------------------------------
// Store types
// ---------------------------------------------------------------------------

interface RolesStoreData {
  dialogMode: RoleDialogMode | null;
  editingRoleId: string | null;
  roles: AppRole[];
}

interface RolesStoreActions {
  addRole: (data: RoleFormData) => void;
  closeDialog: () => void;
  deleteRole: (id: string) => void;
  openAddDialog: () => void;
  openEditDialog: (id: string) => void;
  updatePermission: (
    roleId: string,
    resource: string,
    action: PermissionKey,
    value: boolean
  ) => void;
  updateRole: (id: string, data: RoleFormData) => void;
}

export type RolesStore = RolesStoreData & RolesStoreActions;

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

const buildNewRole = (data: RoleFormData): AppRole => ({
  id: crypto.randomUUID(),
  name: data.name.trim(),
  permissions: data.permissions,
});

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useRolesStore = create<RolesStore>((set) => ({
  roles: INITIAL_ROLES,
  dialogMode: null,
  editingRoleId: null,

  addRole: (data) => {
    const newRole = buildNewRole(data);

    set((state) => ({
      roles: [...state.roles, newRole],
      dialogMode: null,
      editingRoleId: null,
    }));
  },

  updateRole: (id, data) =>
    set((state) => ({
      roles: state.roles.map((role) =>
        role.id === id
          ? { ...role, name: data.name.trim(), permissions: data.permissions }
          : role
      ),
      dialogMode: null,
      editingRoleId: null,
    })),

  deleteRole: (id) =>
    set((state) => ({
      roles: state.roles.filter((role) => role.id !== id),
    })),

  openAddDialog: () => set({ dialogMode: "add", editingRoleId: null }),

  openEditDialog: (id) => set({ dialogMode: "edit", editingRoleId: id }),

  closeDialog: () => set({ dialogMode: null, editingRoleId: null }),

  updatePermission: (roleId, resource, action, value) =>
    set((state) => ({
      roles: state.roles.map((role) =>
        role.id === roleId
          ? {
              ...role,
              permissions: role.permissions.map((perm) =>
                perm.resource === resource ? { ...perm, [action]: value } : perm
              ),
            }
          : role
      ),
    })),
}));
