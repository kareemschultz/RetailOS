// Type Imports
import type { AppUser } from "@/features/users/types";

export interface ResourcePermissions {
  create: boolean;
  delete: boolean;
  read: boolean;
  resource: string;
  write: boolean;
}

export interface AppRole {
  id: string;
  name: string;
  permissions: ResourcePermissions[];
}

export interface AppRoleWithUsers extends AppRole {
  users: Pick<AppUser, "id" | "name" | "avatar">[];
}

export interface RoleFormData {
  name: string;
  permissions: ResourcePermissions[];
}

export type RoleDialogMode = "add" | "edit";

export type PermissionKey = "read" | "write" | "create" | "delete";
