// Third-party Imports
import { create } from "zustand";
// Data Imports
import { db } from "@/features/contacts/fake-db";
// Type Imports
import type {
  Contact,
  ContactNavItem,
  ContactView,
  CreateContactInput,
  Label,
} from "@/features/contacts/types";
// Utils Imports
import { parsePhoneNumber } from "@/features/contacts/utils";

type ContactStatusFilter = "all" | Contact["status"];

interface ContactState {
  activeLabel: Label | null;
  activeNav: ContactNavItem;
  addContact: (input: CreateContactInput) => number | null;
  clearSelectedContact: () => void;
  closeCreateContact: () => void;
  closeEditContact: () => void;
  contacts: Contact[];
  deleteContact: (phone: number) => void;
  isCreatingContact: boolean;
  isEditingContact: boolean;
  openCreateContact: () => void;
  openEditContact: (phone: number) => void;
  selectContact: (phone: number) => void;
  selectedContactPhone: number | null;
  setActiveLabel: (label: Label | null) => void;
  setActiveNav: (nav: ContactNavItem) => void;
  setStatusFilter: (filter: ContactStatusFilter) => void;
  setView: (view: ContactView) => void;
  statusFilter: ContactStatusFilter;
  toggleBlocked: (phone: number) => void;
  toggleFavourite: (phone: number) => void;
  toggleSpam: (phone: number) => void;
  updateContact: (phone: number, input: CreateContactInput) => number | null;
  view: ContactView;
}

export const useContactStore = create<ContactState>()((set) => ({
  contacts: db,
  activeNav: "all",
  activeLabel: null,
  statusFilter: "all",
  view: "list",
  selectedContactPhone: null,
  isCreatingContact: false,
  isEditingContact: false,

  setActiveNav: (nav) =>
    set({ activeNav: nav, activeLabel: null, statusFilter: "all" }),

  setActiveLabel: (label) =>
    set({
      activeLabel: label,
      statusFilter: "all",
      selectedContactPhone: null,
      isCreatingContact: false,
      isEditingContact: false,
    }),

  setStatusFilter: (filter) => set({ statusFilter: filter }),

  setView: (view) => set({ view }),

  selectContact: (phone) =>
    set({
      selectedContactPhone: phone,
      isCreatingContact: false,
      isEditingContact: false,
    }),

  clearSelectedContact: () =>
    set({
      selectedContactPhone: null,
      isCreatingContact: false,
      isEditingContact: false,
    }),

  openCreateContact: () =>
    set({
      isCreatingContact: true,
      selectedContactPhone: null,
      isEditingContact: false,
    }),

  closeCreateContact: () => set({ isCreatingContact: false }),

  openEditContact: (phone) =>
    set({
      selectedContactPhone: phone,
      isCreatingContact: false,
      isEditingContact: true,
    }),

  closeEditContact: () => set({ isEditingContact: false }),

  addContact: (input) => {
    const trimmedFirstName = input.firstName.trim();
    const trimmedLastName = input.lastName.trim();

    if (!(trimmedFirstName && trimmedLastName)) {
      return null;
    }

    const phone = parsePhoneNumber(input.phone);

    if (phone === null) {
      return null;
    }

    const { contacts } = useContactStore.getState();

    if (contacts.some((contact) => contact.phone === phone)) {
      return null;
    }

    const newContact: Contact = {
      firstName: trimmedFirstName,
      lastName: trimmedLastName,
      email: input.email.trim() || undefined,
      phone,
      city: input.city.trim() || undefined,
      notes: input.notes.trim() || undefined,
      image: input.image,
      addedDate: new Date(),
      labels: input.labels,
      status: "active",
      isFavourite: false,
      isRecent: true,
      isBlocked: false,
      isSpam: false,
    };

    set({
      contacts: [...contacts, newContact],
      isCreatingContact: false,
      selectedContactPhone: phone,
    });

    return phone;
  },

  updateContact: (originalPhone, input) => {
    const trimmedFirstName = input.firstName.trim();
    const trimmedLastName = input.lastName.trim();

    if (!(trimmedFirstName && trimmedLastName)) {
      return null;
    }

    const newPhone = parsePhoneNumber(input.phone);

    if (newPhone === null) {
      return null;
    }

    const { contacts } = useContactStore.getState();
    const contactIndex = contacts.findIndex(
      (contact) => contact.phone === originalPhone
    );

    if (contactIndex === -1) {
      return null;
    }

    if (
      newPhone !== originalPhone &&
      contacts.some((contact) => contact.phone === newPhone)
    ) {
      return null;
    }

    const existingContact = contacts[contactIndex];

    const updatedContact: Contact = {
      ...existingContact,
      firstName: trimmedFirstName,
      lastName: trimmedLastName,
      email: input.email.trim() || undefined,
      phone: newPhone,
      city: input.city.trim() || undefined,
      notes: input.notes.trim() || undefined,
      labels: input.labels,
      image: input.image,
    };

    const newContacts = [...contacts];

    newContacts[contactIndex] = updatedContact;

    set({
      contacts: newContacts,
      isEditingContact: false,
      selectedContactPhone: newPhone,
    });

    return newPhone;
  },

  toggleFavourite: (phone) =>
    set((state) => ({
      contacts: state.contacts.map((contact) =>
        contact.phone === phone && !(contact.isBlocked || contact.isSpam)
          ? { ...contact, isFavourite: !contact.isFavourite }
          : contact
      ),
    })),

  toggleSpam: (phone) =>
    set((state) => ({
      contacts: state.contacts.map((contact) => {
        if (contact.phone !== phone) {
          return contact;
        }

        const isSpam = !contact.isSpam;

        return {
          ...contact,
          isSpam,
          isFavourite: isSpam ? false : contact.isFavourite,
        };
      }),
    })),

  toggleBlocked: (phone) =>
    set((state) => ({
      contacts: state.contacts.map((contact) => {
        if (contact.phone !== phone) {
          return contact;
        }

        const isBlocked = !contact.isBlocked;

        return {
          ...contact,
          isBlocked,
          isFavourite: isBlocked ? false : contact.isFavourite,
          isSpam: isBlocked ? false : contact.isSpam,
        };
      }),
    })),

  deleteContact: (phone) =>
    set((state) => ({
      contacts: state.contacts.filter((contact) => contact.phone !== phone),
      selectedContactPhone:
        state.selectedContactPhone === phone
          ? null
          : state.selectedContactPhone,
    })),
}));
