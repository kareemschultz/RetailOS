export type UserRole =
  | "Admin"
  | "Contributor"
  | "Viewer"
  | "Member"
  | "No Access";

export interface Member {
  avatar: string;
  email: string;
  id: number;
  name: string;
  role: UserRole;
}

export interface PendingInvite {
  avatar: string;
  email: string;
  id: string;
  name: string;
  role: UserRole;
}

export interface MembersData {
  members: Member[];
  pending: PendingInvite[];
}

export interface Session {
  browser: string;
  date: string;
  id: string;
  ip: string;
  isMobile?: boolean;
  location: string;
  os: string;
  time: string;
}

export interface IntegrationApp {
  bgColor: string;
  description: string;
  image: string;
  link: string;
  name: string;
}

export interface IntegrationsData {
  communication: IntegrationApp[];
  planning: IntegrationApp[];
  tools: IntegrationApp[];
}

export interface UserSettingsData {
  integrations: IntegrationsData;
  members: Member[];
  pending: PendingInvite[];
  sessions: Session[];
}
