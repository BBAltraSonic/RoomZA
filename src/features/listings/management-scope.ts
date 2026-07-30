import "server-only";

import { getOrganizationContext } from "@/features/organizations/data";

export async function getListingManagementScope() {
  const context = await getOrganizationContext();
  const active = context.activeOrganization;
  return {
    managedOrganizationId: active && (active.role === "owner" || active.role === "admin")
      ? active.organizationId
      : null,
  };
}
