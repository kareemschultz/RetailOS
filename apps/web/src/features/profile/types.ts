// Activity Timeline - Profile Section Types
export type ActivityFileType = "pdf" | "image" | "doc" | "excel";

export interface ActivityAttachment {
  fileType: ActivityFileType;
  name: string;
}

export interface ActivityPerson {
  avatar?: string;
  initials: string;
  name: string;
  role?: string;
}

export interface ActivityTeamMember {
  avatar?: string;
  initials: string;
  name: string;
}

export interface UserActivityItem {
  attachment?: ActivityAttachment;
  description: string;
  detail?: string;
  id: string | number;
  person?: ActivityPerson;
  teamExtraCount?: number;
  teamMembers?: ActivityTeamMember[];
  timestamp: string;
}

// About Section - Profile Section Types
export type UserProfileInfoIconKey =
  | "UserIcon"
  | "CheckCheckIcon"
  | "StarIcon"
  | "FlagIcon"
  | "LanguagesIcon"
  | "PhoneIcon"
  | "MessagesSquareIcon"
  | "MailIcon";

export type UserProfileOverviewIconKey =
  | "CheckIcon"
  | "UserIcon"
  | "LayoutGridIcon";

export interface UserProfileSectionItem {
  iconKey?: UserProfileInfoIconKey | UserProfileOverviewIconKey;
  label: string;
  value: string;
}

export interface UserProfileSection {
  items: UserProfileSectionItem[];
  title: string;
}

// Connections - Profile Section Types
export interface UserConnectionItem {
  avatar?: string;
  id: string | number;
  initials: string;
  isConnected: boolean;
  name: string;
  totalConnections: string;
}

// Connections Card - Connection Section Types
export interface ConnectionCardTag {
  label: string;
}

export interface ConnectionCardStats {
  connections: string;
  projects: string;
  tasks: string;
}

export type ConnectionCardItem = UserConnectionItem & {
  role: string;
  tags: ConnectionCardTag[];
  stats: ConnectionCardStats;
};

// Team - Profile Section Types
export interface UserTeamItem {
  avatar?: string;
  id: string | number;
  initials: string;
  teamBadge: {
    label: string;
  };
  teams: string;
  totalMembers: string;
}

// Project - Profile Section
export interface UserProjectTeamMember {
  avatar?: string;
  initials: string;
}

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

export interface ProfileProjectDatatableProps {
  className?: string;
}

export interface ProjectDatatableTeamMember {
  avatar?: string;
  initials: string;
}

export interface ProjectDatatable {
  id: string;
  leader: string;
  logo?: string;
  logoDark?: string;
  name: string;
  progress: number;
  team: ProjectDatatableTeamMember[];
  teamExtraCount?: number;
  type: string;
  updatedAt?: string;
}

// Team Card - Team Section Types
export interface UserTeamCardMember {
  avatar?: string;
  initials: string;
  name: string;
}

export interface UserTeamCardTag {
  label: string;
}

export interface UserTeamGridCard {
  avatar?: string;
  avatarDark?: string;
  description: string;
  extraMembersCount?: number;
  id: string | number;
  initials: string;
  members: UserTeamCardMember[];
  tags: UserTeamCardTag[];
  title: string;
}

// Projects Card - Projects Section Types
export interface UserProjectCardMember {
  avatar?: string;
  initials: string;
  name: string;
}

export interface UserProjectCard {
  allHours: string;
  budgetSpent: string;
  budgetTotal: string;
  client: string;
  commentsCount: string;
  completion: number;
  daysLeftLabel: string;
  daysLeftTone: "success" | "warning" | "danger";
  deadline: string;
  description: string;
  id: string | number;
  initials: string;
  logo?: string;
  logoDark?: string;
  members: UserProjectCardMember[];
  membersLabel: string;
  startDate: string;
  tasks: string;
  title: string;
}

// All User Profile Page Data Types
export interface UserProfilePageData {
  activityLog: UserActivityItem[];
  connectionActions: string[];
  connectionCardActions: string[];
  connectionCards: ConnectionCardItem[];
  connections: UserConnectionItem[];
  overviewSections: UserProfileSection[];
  profileSections: UserProfileSection[];
  projectCardActions: string[];
  projectCards: UserProjectCard[];
  projectDatatable: ProjectDatatable[];
  teamActions: string[];
  teamCardActions: string[];
  teamCards: UserTeamGridCard[];
  teams: UserTeamItem[];
}
