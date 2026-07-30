import { PageHeader } from "@/components/premium/primitives";
import { getOrganizationManagementData } from "@/features/organizations/data";
import { OrganizationManagement } from "@/features/organizations/organization-management";

export default async function OrganizationPage() {
  const data = await getOrganizationManagementData();
  return (
    <>
      <PageHeader eyebrow="Organization workspace" title={data.activeOrganization?.organizationName ?? "Create an organization"} description="Manage offices, agents, administrators, and seven-day invitations." />
      <div className="mt-6">
        <OrganizationManagement
          organization={data.activeOrganization}
          offices={data.offices as never}
          members={data.members as never}
          invitations={data.invitations as never}
        />
      </div>
    </>
  );
}
