import type { ReactNode } from "react";

import { getLatestLandlordShowing } from "@/features/showings/actions";
import { ShowingRequestBannerLoader } from "@/features/showings/showing-request-banner-loader";
import { getOrganizationContext } from "@/features/organizations/data";
import { OrganizationSelector } from "@/features/organizations/organization-selector";
import { requireAnyPersona } from "@/lib/auth";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const { user } = await requireAnyPersona(["landlord", "seller"], { redirectTo: "/dashboard" });
  const [initialShowing, organizationContext] = await Promise.all([
    getLatestLandlordShowing(),
    getOrganizationContext(),
  ]);

  return (
    <main className="flex-1">
      <ShowingRequestBannerLoader landlordId={user.id} initialRequest={initialShowing} />
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
