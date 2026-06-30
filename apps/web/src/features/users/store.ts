// Third-party Imports
import { create } from "zustand";
// Data Imports
import { users as seedUsers } from "@/features/users/fake-db";
// Type Imports
import type {
  AppUser,
  UserFilters,
  UserFormData,
  UserSheetMode,
  UserSorting,
  UserStatus,
} from "@/features/users/types";

const DEFAULT_FILTERS: UserFilters = {
  role: "all",
  plan: "all",
  status: "all",
  search: "",
};

const DEFAULT_ROWS_PER_PAGE = 10;
const DEFAULT_CURRENT_PAGE = 1;

interface UserStoreData {
  currentPage: number;
  editingUserId: string | null;
  filters: UserFilters;
  isImportDialogOpen: boolean;
  rowsPerPage: number;
  selectedUserIds: string[];
  sheetMode: UserSheetMode | null;
  sorting: UserSorting | null;
  users: AppUser[];
}

interface UserStoreActions {
  addUser: (data: UserFormData) => void;
  clearSelection: () => void;
  closeImportDialog: () => void;
  closeSheet: () => void;
  deleteUser: (id: string) => void;
  deleteUsers: (ids: string[]) => void;
  importUsers: (users: Partial<AppUser>[]) => void;
  openAddSheet: () => void;
  openEditSheet: (userId: string) => void;
  openImportDialog: () => void;
  setCurrentPage: (n: number) => void;
  setFilters: (filters: Partial<UserFilters>) => void;
  setRowsPerPage: (n: number) => void;
  setSorting: (sorting: UserSorting | null) => void;
  toggleSelectAll: (userIds: string[]) => void;
  toggleSelectUser: (id: string) => void;
  updateUser: (id: string, data: Partial<UserFormData>) => void;
  updateUserStatus: (id: string, status: UserStatus) => void;
  updateUsersStatus: (ids: string[], status: UserStatus) => void;
}

export type UserStore = UserStoreData & UserStoreActions;

const buildNewUser = (data: UserFormData): AppUser => ({
  id: crypto.randomUUID(),
  name: data.name.trim(),
  email: data.email.trim(),
  role: data.role,
  plan: data.plan,
  status: data.status,
  billing: "Manual",
  company: data.company?.trim() || undefined,
  country: data.country?.trim() || undefined,
  contact: data.contact?.trim() || undefined,
  joinedDate: new Date().toISOString(),
});

const buildImportedUser = (partial: Partial<AppUser>): AppUser | null => {
  const name = partial.name?.trim();
  const email = partial.email?.trim();

  if (!(name && email)) {
    return null;
  }

  return {
    id: partial.id ?? crypto.randomUUID(),
    name,
    email,
    avatar: partial.avatar,
    role: partial.role ?? "Subscriber",
    plan: partial.plan ?? "Basic",
    status: partial.status ?? "Pending",
    billing: partial.billing ?? "Manual",
    company: partial.company,
    country: partial.country,
    contact: partial.contact,
    joinedDate: partial.joinedDate ?? new Date().toISOString(),
    coverImage: partial.coverImage,
    website: partial.website,
    skype: partial.skype,
    socialLinks: partial.socialLinks,
    tasksDone: partial.tasksDone,
    projectsDone: partial.projectsDone,
    username: partial.username,
    billingEmail: partial.billingEmail,
    taxId: partial.taxId,
    language: partial.language,
    projects: partial.projects,
    activityLog: partial.activityLog,
    billingPlan: partial.billingPlan,
    invoices: partial.invoices,
    connections: partial.connections,
    teamMemberships: partial.teamMemberships,
  };
};

const removeIdsFromSelection = (
  selectedUserIds: string[],
  ids: string[]
): string[] => {
  const idSet = new Set(ids);

  return selectedUserIds.filter((id) => !idSet.has(id));
};

export const useUserStore = create<UserStore>((set, get) => ({
  users: seedUsers,
  filters: DEFAULT_FILTERS,
  rowsPerPage: DEFAULT_ROWS_PER_PAGE,
  currentPage: DEFAULT_CURRENT_PAGE,
  selectedUserIds: [],
  sorting: null,
  sheetMode: null,
  editingUserId: null,
  isImportDialogOpen: false,

  addUser: (data) => {
    const newUser = buildNewUser(data);

    set((state) => ({
      users: [...state.users, newUser],
      sheetMode: null,
      editingUserId: null,
    }));
  },

  updateUser: (id, data) =>
    set((state) => ({
      users: state.users.map((user) =>
        user.id === id
          ? {
              ...user,
              ...data,
              name: data.name?.trim() ?? user.name,
              email: data.email?.trim() ?? user.email,
              company: data.company?.trim() ?? user.company,
              country: data.country?.trim() ?? user.country,
              contact: data.contact?.trim() ?? user.contact,
            }
          : user
      ),
      sheetMode: null,
      editingUserId: null,
    })),

  deleteUser: (id) =>
    set((state) => ({
      users: state.users.filter((user) => user.id !== id),
      selectedUserIds: removeIdsFromSelection(state.selectedUserIds, [id]),
    })),

  deleteUsers: (ids) =>
    set((state) => ({
      users: state.users.filter((user) => !ids.includes(user.id)),
      selectedUserIds: removeIdsFromSelection(state.selectedUserIds, ids),
    })),

  updateUserStatus: (id, status) =>
    set((state) => ({
      users: state.users.map((user) =>
        user.id === id ? { ...user, status } : user
      ),
    })),

  updateUsersStatus: (ids, status) =>
    set((state) => ({
      users: state.users.map((user) =>
        ids.includes(user.id) ? { ...user, status } : user
      ),
    })),

  setFilters: (filters) =>
    set((state) => ({
      filters: { ...state.filters, ...filters },
      currentPage: DEFAULT_CURRENT_PAGE,
    })),

  setRowsPerPage: (rowsPerPage) =>
    set({
      rowsPerPage,
      currentPage: DEFAULT_CURRENT_PAGE,
    }),

  setCurrentPage: (currentPage) => set({ currentPage }),

  setSorting: (sorting) =>
    set({
      sorting,
      currentPage: DEFAULT_CURRENT_PAGE,
    }),

  toggleSelectUser: (id) =>
    set((state) => ({
      selectedUserIds: state.selectedUserIds.includes(id)
        ? state.selectedUserIds.filter((selectedId) => selectedId !== id)
        : [...state.selectedUserIds, id],
    })),

  toggleSelectAll: (userIds) => {
    const { selectedUserIds } = get();
    const allSelected =
      userIds.length > 0 && userIds.every((id) => selectedUserIds.includes(id));

    if (allSelected) {
      set({
        selectedUserIds: removeIdsFromSelection(selectedUserIds, userIds),
      });

      return;
    }

    set({ selectedUserIds: [...new Set([...selectedUserIds, ...userIds])] });
  },

  clearSelection: () => set({ selectedUserIds: [] }),

  openAddSheet: () =>
    set({
      sheetMode: "add",
      editingUserId: null,
    }),

  openEditSheet: (userId) =>
    set({
      sheetMode: "edit",
      editingUserId: userId,
    }),

  closeSheet: () =>
    set({
      sheetMode: null,
      editingUserId: null,
    }),

  openImportDialog: () => set({ isImportDialogOpen: true }),

  closeImportDialog: () => set({ isImportDialogOpen: false }),

  importUsers: (incoming) => {
    const importedUsers = incoming
      .map((partial) => buildImportedUser(partial))
      .filter((user): user is AppUser => user !== null);

    if (importedUsers.length === 0) {
      return;
    }

    set((state) => ({
      users: [...state.users, ...importedUsers],
      isImportDialogOpen: false,
      currentPage: DEFAULT_CURRENT_PAGE,
    }));
  },
}));
