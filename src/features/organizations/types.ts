export type OrganizationRole = "owner" | "admin" | "agent";

export type OrganizationMembershipView = {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  role: OrganizationRole;
  importsPilotEnabled: boolean;
  active: boolean;
};
