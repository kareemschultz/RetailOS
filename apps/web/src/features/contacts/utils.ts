import type {
  Contact,
  Label as ContactLabel,
  ContactNavItem,
} from "@/features/contacts/types";

export const PHONE_NUMBER_LENGTH = 10;

export function sanitizePhoneInput(value: string) {
  return value.replace(/\D/g, "").slice(0, PHONE_NUMBER_LENGTH);
}

const PHONE_PATTERN = /^\d{10}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validatePhoneNumber(phone: string) {
  const digits = phone.trim();

  if (!digits) {
    return "Phone number is required.";
  }

  if (!PHONE_PATTERN.test(digits)) {
    return "Phone number must be exactly 10 digits.";
  }

  return null;
}

export function validateEmail(email: string) {
  const trimmed = email.trim();

  if (!trimmed) {
    return null;
  }

  if (!EMAIL_PATTERN.test(trimmed)) {
    return "Please enter a valid email address.";
  }

  return null;
}

export function parsePhoneNumber(phone: string) {
  const digits = sanitizePhoneInput(phone.trim());

  if (!PHONE_PATTERN.test(digits)) {
    return null;
  }

  return Number(digits);
}

export function getContactInitials(firstName: string, lastName: string) {
  const firstInitial = firstName.trim().charAt(0);
  const lastInitial = lastName.trim().charAt(0);

  if (!(firstInitial || lastInitial)) {
    return "?";
  }

  return `${firstInitial}${lastInitial}`.toUpperCase();
}

export interface ContactDropdownActions {
  showBlockAction: boolean;
  showDeleteAction: boolean;
  showEditAction: boolean;
  showFavouriteAction: boolean;
  showNotSpamAction: boolean;
  showSpamAction: boolean;
}

export function getContactDropdownActions(
  contact: Pick<Contact, "isBlocked" | "isSpam" | "isFavourite">
): ContactDropdownActions {
  if (contact.isBlocked) {
    return {
      showEditAction: false,
      showDeleteAction: false,
      showFavouriteAction: false,
      showSpamAction: false,
      showNotSpamAction: false,
      showBlockAction: true,
    };
  }

  if (contact.isSpam) {
    return {
      showEditAction: true,
      showDeleteAction: true,
      showFavouriteAction: false,
      showSpamAction: false,
      showNotSpamAction: true,
      showBlockAction: true,
    };
  }

  if (contact.isFavourite) {
    return {
      showEditAction: true,
      showDeleteAction: true,
      showFavouriteAction: true,
      showSpamAction: false,
      showNotSpamAction: false,
      showBlockAction: true,
    };
  }

  return {
    showEditAction: true,
    showDeleteAction: true,
    showFavouriteAction: true,
    showSpamAction: true,
    showNotSpamAction: false,
    showBlockAction: true,
  };
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);

        return;
      }

      reject(new Error("Failed to convert file to data URL"));
    };

    reader.onerror = () =>
      reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export type ContactSortOrder = "asc" | "desc";
export type ContactFilter = "all" | Contact["status"];

function getContactName(contact: Contact) {
  return `${contact.firstName} ${contact.lastName}`;
}

function matchesNavFilter(contact: Contact, activeNav: ContactNavItem) {
  switch (activeNav) {
    case "all":
      return !(contact.isBlocked || contact.isSpam);
    case "favourites":
      return contact.isFavourite && !(contact.isBlocked || contact.isSpam);
    case "spam":
      return contact.isSpam;
    case "blocked":
      return contact.isBlocked;
    default:
      return false;
  }
}

function matchesLabelFilter(
  contact: Contact,
  activeLabel: ContactLabel | null
) {
  if (!activeLabel) {
    return true;
  }

  return (
    contact.labels.includes(activeLabel) &&
    !(contact.isBlocked || contact.isSpam)
  );
}

function matchesStatusFilter(contact: Contact, filter: ContactFilter) {
  if (filter === "all") {
    return true;
  }

  return contact.status === filter;
}

function matchesSearchQuery(contact: Contact, query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  const searchableFields = [
    contact.firstName,
    contact.lastName,
    `${contact.firstName} ${contact.lastName}`,
    contact.email,
    contact.company,
    String(contact.phone),
    ...contact.labels,
  ];

  return searchableFields.some((field) =>
    field?.toLowerCase().includes(normalizedQuery)
  );
}

export function sortContacts(contacts: Contact[], sortOrder: ContactSortOrder) {
  return [...contacts].sort((a, b) => {
    const comparison = getContactName(a).localeCompare(getContactName(b));

    return sortOrder === "asc" ? comparison : -comparison;
  });
}

export function getVisibleContacts(
  contacts: Contact[],
  activeNav: ContactNavItem,
  activeLabel: ContactLabel | null,
  statusFilter: ContactFilter,
  searchQuery: string
) {
  return contacts
    .filter((contact) =>
      activeLabel
        ? matchesLabelFilter(contact, activeLabel)
        : matchesNavFilter(contact, activeNav)
    )
    .filter((contact) => matchesStatusFilter(contact, statusFilter))
    .filter((contact) => matchesSearchQuery(contact, searchQuery));
}

export function groupContactsByLetter(
  contacts: Contact[],
  sortOrder: ContactSortOrder
) {
  const sortedContacts = sortContacts(contacts, sortOrder);

  const groups = new Map<string, Contact[]>();

  for (const contact of sortedContacts) {
    const letter = contact.firstName.charAt(0).toUpperCase();
    const letterContacts = groups.get(letter) ?? [];

    groups.set(letter, [...letterContacts, contact]);
  }

  return Array.from(groups.entries()).sort(([letterA], [letterB]) =>
    sortOrder === "asc"
      ? letterA.localeCompare(letterB)
      : letterB.localeCompare(letterA)
  );
}
