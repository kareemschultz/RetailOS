// RetailOS CRM directory types. Ported from the AdminCN contact app and
// reframed for a Caribbean retail CRM (customers, wholesale accounts, suppliers).
export type Label =
  | "lead"
  | "partner"
  | "customer"
  | "vip"
  | "wholesale"
  | "supplier";

export const CONTACT_LABELS: Label[] = [
  "lead",
  "partner",
  "customer",
  "vip",
  "wholesale",
  "supplier",
];

export const CONTACT_LABEL_STYLES: Record<Label, string> = {
  lead: "bg-blue-500",
  partner: "bg-purple-500",
  customer: "bg-emerald-500",
  vip: "bg-amber-500",
  wholesale: "bg-orange-500",
  supplier: "bg-pink-500",
};

export type ContactNavItem = "all" | "favourites" | "spam" | "blocked";

export type ContactView = "grid" | "list";

export interface CreateContactInput {
  city: string;
  email: string;
  firstName: string;
  image?: string;
  labels: Label[];
  lastName: string;
  notes: string;
  phone: string;
}

export interface Contact {
  addedDate: Date;
  city?: string;
  // RetailOS CRM fields (optional — surfaced in the details panel when present).
  company?: string;
  creditLimitGyd?: number;
  email?: string;
  firstName: string;
  image?: string;
  isBlocked: boolean;
  isFavourite: boolean;
  isRecent: boolean;
  isSpam: boolean;
  labels: Label[];
  lastName: string;
  lastPurchase?: string;
  loyaltyTier?: string;
  notes?: string;
  phone: number;
  status?: "active" | "inactive" | "prospect";
}
