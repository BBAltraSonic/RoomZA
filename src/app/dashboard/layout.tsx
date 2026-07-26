import type { ReactNode } from "react";

import { getLatestLandlordShowing } from "@/features/showings/actions";
import { ShowingRequestBanner } from "@/features/showings/showing-request-banner";
import { requireRole } from "@/lib/auth";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const { user } = await requireRole("landlord", { redirectTo: "/dashboard" });
  const initialShowing = await getLatestLandlordShowing();

  return (
    <main className="flex-1">
      <ShowingRequestBanner landlordId={user.id} initialRequest={initialShowing} />
      <div className="mx-auto w-full max-w-5xl p-4 sm:p-6 lg:p-8">
        {children}
      </div>
    </main>
  );
}
