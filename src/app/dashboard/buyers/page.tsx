import type { Metadata } from "next";
import { AlertCircle, Users } from "lucide-react";

import { AppShell, EmptyState, MetricStrip, PageHeader } from "@/components/premium/primitives";
import { ApplicantAudienceTabs } from "@/features/dashboard/applicant-audience-tabs";
import { getSellerBuyerInterests } from "@/features/purchase/actions";
import { BUYER_INTEREST_STATUSES, buyerInterestStatusLabels } from "@/features/purchase/pipeline";
import { SellerPipeline } from "@/features/purchase/seller-pipeline";
import { requireRole } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Applicants: Buyers",
  robots: { index: false, follow: false },
};

export default async function BuyerPipelinePage() {
  await requireRole("landlord", { redirectTo: "/dashboard/buyers" });
  const result = await getSellerBuyerInterests();

  if (!result.success) {
    return (
      <AppShell width="xl" className="pt-2 md:pt-10">
        <PageHeader
          eyebrow="Landlord workspace"
          title="Applicants"
          description="Rental applications and purchase interest across your listings."
        />
        <ApplicantAudienceTabs active="buyers" />
        <EmptyState
          icon={AlertCircle}
          title="Unable to load buyers"
          description="The dashboard could not load purchase interest. Refresh the page or try again later."
        />
      </AppShell>
    );
  }

  const interests = result.data;
  const metrics = BUYER_INTEREST_STATUSES.map((status) => ({
    label: buyerInterestStatusLabels[status],
    value: interests.filter((interest) => interest.status === status).length,
    tone: status === "accepted" ? "forest" as const : status === "negotiating" ? "clay" as const : "default" as const,
  }));

  return (
    <AppShell width="xl" className="pt-2 md:pt-10">
      <PageHeader
        eyebrow="Landlord workspace"
        title="Applicants"
        description="Rental applications and purchase interest across your listings."
        meta={<MetricStrip metrics={metrics} className="sm:grid-cols-4" />}
      />
      <ApplicantAudienceTabs active="buyers" />

      {interests.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No buyer interest yet"
          description="Saved sale listings, seller contacts, and viewing requests will appear here once buyers engage."
        />
      ) : (
        <SellerPipeline interests={interests} />
      )}
    </AppShell>
  );
}
