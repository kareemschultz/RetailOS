// Ported from AdminCN use-mail-store. Framework change: dropped 'use client';
// in-memory zustand store unchanged. Data source is the local themed fake-db.

import { create } from "zustand";

import { db } from "@/features/mail/fake-db";
import type {
  Email,
  EmailLabel,
  EmailStatus,
  MailFilterTab,
  MailNavType,
  MailSortOrder,
} from "@/features/mail/types";

interface MailStoreData {
  activeLabel: EmailLabel | null;
  activeNavType: MailNavType;
  activeStatus: EmailStatus;
  emails: Email[];
  filterTab: MailFilterTab;
  isComposeOpen: boolean;
  searchQuery: string;
  selectedEmailId: string | null;
  sortOrder: MailSortOrder;
}

interface MailStoreActions {
  addEmail: (email: Email) => void;
  initialize: (options?: { emails?: Email[] }) => void;
  removeEmail: (id: string) => void;
  setActiveLabel: (label: EmailLabel | null) => void;
  setActiveNavType: (type: MailNavType) => void;
  setActiveStatus: (status: EmailStatus) => void;
  setFilterTab: (tab: MailFilterTab) => void;
  setIsComposeOpen: (open: boolean) => void;
  setSearchQuery: (query: string) => void;
  setSelectedEmailId: (id: string | null) => void;
  setSortOrder: (order: MailSortOrder) => void;
  updateEmail: (id: string, updater: (email: Email) => Email) => void;
}

export type MailStore = MailStoreData & MailStoreActions;

export const useMailStore = create<MailStore>((set, get) => ({
  emails: db,
  selectedEmailId: null,
  searchQuery: "",
  activeStatus: "inbox",
  activeLabel: null,
  activeNavType: "status",
  filterTab: "all",
  sortOrder: "default",
  isComposeOpen: false,

  initialize: ({ emails } = {}) => {
    const updates: Partial<MailStoreData> = {};

    if (emails && emails !== get().emails) {
      updates.emails = emails;
    }

    if (Object.keys(updates).length > 0) {
      set(updates);
    }
  },

  updateEmail: (id, updater) =>
    set((state) => ({
      emails: state.emails.map((email) =>
        email.id === id ? updater(email) : email
      ),
    })),

  addEmail: (email) => set((state) => ({ emails: [email, ...state.emails] })),

  removeEmail: (id) =>
    set((state) => ({
      emails: state.emails.filter((email) => email.id !== id),
      selectedEmailId:
        state.selectedEmailId === id ? null : state.selectedEmailId,
    })),

  setSelectedEmailId: (selectedEmailId) => set({ selectedEmailId }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setActiveStatus: (activeStatus) => set({ activeStatus }),
  setActiveLabel: (activeLabel) => set({ activeLabel }),
  setActiveNavType: (activeNavType) => set({ activeNavType }),
  setFilterTab: (filterTab) => set({ filterTab }),
  setSortOrder: (sortOrder) => set({ sortOrder }),
  setIsComposeOpen: (isComposeOpen) => set({ isComposeOpen }),
}));
