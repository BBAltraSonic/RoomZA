import type { ReactNode } from "react";

import { LandlordShowingInbox } from "@/features/showings/landlord-showing-inbox";
import { getOrganizationContext } from "@/features/organizations/data";
import { OrganizationSelector } from "@/features/organizations/organization-selector";
import { requireAnyPersona } from "@/lib/auth";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  await requireAnyPersona(["landlord", "seller"], { redirectTo: "/dashboard" });
  const organizationContext = await getOrganizationContext();

  return (
    <main className="flex-1">
      <LandlordShowingInbox />
      <div className="mx-auto w-full max-w-5xl p-4 sm:p-6 lg:p-8">
        <OrganizationSelector
          memberships={organizationContext.memberships}
          activeOrganizationId={organizationContext.activeOrganization?.organizationId ?? null}
        />
        {children}
      </div>
    </main>
  );
}
