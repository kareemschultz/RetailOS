export type UserRole =
  | "Admin"
  | "Editor"
  | "Subscriber"
  | "Maintainer"
  | "Guest";
export type UserPlan = "Basic" | "Team" | "Enterprise";
export type UserStatus = "Active" | "Pending" | "Suspended" | "Inactive";
export type UserBilling = "Auto Debit" | "Manual" | "Credit Card";

export interface UserProject {
  id: string;
  leader: string;
  logo?: string;
  name: string;
  progress: number;
  team: { avatar?: string; initials: string }[];
  teamExtraCount?: number;
  type: string;
  updatedAt?: string;
}

export type ActivityFileType = "pdf" | "image" | "doc" | "excel";

export interface ActivityPerson {
  avatar?: string;
  initials: string;
  name: string;
  role?: string;
}

export interface UserActivityItem {
  attachment?: {
    name: string;
    fileType: ActivityFileType;
  };
  description: string;
  detail?: string;
  id: string;
  person?: ActivityPerson;
  teamExtraCount?: number;
  teamMembers?: ActivityPerson[];
  timestamp: string;
}

export interface UserBillingPlan {
  daysUsed: number;
  features: string[];
  isPopular?: boolean;
  name: string;
  period: "month" | "year";
  price: number;
  totalDays: number;
}

export type InvoiceStatus = "paid" | "pending" | "cancelled" | "draft";

export interface UserInvoice {
  id: string;
  issuedDate: string;
  number: string;
  status: InvoiceStatus;
  total: number;
}

export interface UserConnection {
  avatar?: string;
  connectionCount?: number;
  id: string;
  initials: string;
  isConnected: boolean;
  name: string;
  username: string;
}

export interface UserTeamMembership {
  logo?: string;
  memberCount: number;
  name: string;
  role?: string;
}

export type SocialPlatform =
  | "twitter"
  | "linkedin"
  | "github"
  | "instagram"
  | "dribbble"
  | "behance"
  | "skype"
  | "website"
  | "facebook";

export interface UserSocialLink {
  platform: SocialPlatform;
  url: string;
}

export interface UserRecentDevice {
  browser: string;
  device: string;
  id: string;
  isCurrentDevice?: boolean;
  lastActive: string;
  location: string;
}

export interface UserNotificationSetting {
  app: boolean;
  browser: boolean;
  description: string;
  email: boolean;
  id: string;
  title: string;
}

export interface AppUser {
  activityLog?: UserActivityItem[];
  avatar?: string; // URL string — if absent, show initials
  billing: UserBilling;
  billingEmail?: string;
  billingPlan?: UserBillingPlan;
  company?: string;
  connections?: UserConnection[];
  contact?: string;
  country?: string;
  coverImage?: string;
  email: string;
  id: string;
  invoices?: UserInvoice[];
  joinedDate: string; // ISO 8601
  language?: string;
  name: string;
  notificationSettings?: UserNotificationSetting[];
  plan: UserPlan;
  projects?: UserProject[];
  projectsDone?: number;
  recentDevices?: UserRecentDevice[];
  role: UserRole;
  skype?: string;
  socialLinks?: UserSocialLink[];
  status: UserStatus;
  tasksDone?: number;
  taxId?: string;
  teamMemberships?: UserTeamMembership[];
  twoFactorEnabled?: boolean;
  username?: string;
  website?: string;
}

export interface UserFilters {
  plan: UserPlan | "all";
  role: UserRole | "all";
  search: string;
  status: UserStatus | "all";
}

export type UserFormData = Pick<
  AppUser,
  | "name"
  | "email"
  | "contact"
  | "company"
  | "country"
  | "role"
  | "plan"
  | "status"
>;

// For add/edit sheet
export type UserSheetMode = "add" | "edit";

// For column visibility
export type UserColumnId =
  | "select"
  | "user"
  | "role"
  | "plan"
  | "billing"
  | "status"
  | "joinedDate"
  | "actions";

export type UserSortColumn = Exclude<UserColumnId, "select" | "actions">;

export interface UserSorting {
  desc: boolean;
  id: UserSortColumn;
}
