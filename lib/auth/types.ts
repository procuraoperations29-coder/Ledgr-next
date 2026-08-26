export type MemberRole = 'owner' | 'admin' | 'accountant' | 'staff' | 'viewer';

export interface OrgSummary {
  id: string;
  name: string;
  currency: string;
  status: string;
  onboardingCompleted: boolean;
}

export interface Membership {
  organizationId: string;
  role: MemberRole;
  canViewReports: boolean;
  organization: OrgSummary;
}

export interface AppSession {
  userId: string;
  email: string | null;
  fullName: string | null;
  org: OrgSummary;
  role: MemberRole;
  canViewReports: boolean;
}
