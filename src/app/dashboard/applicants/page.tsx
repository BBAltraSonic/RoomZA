import type { Metadata } from "next";
import { Users } from "lucide-react";

import { AppShell, EmptyState, MetricStrip, PageHeader } from "@/components/premium/primitives";
import { ApplicantManager } from "@/features/applications/applicant-manager";
import { getAllApplicants } from "@/features/applications/actions";
import { applicationStatuses } from "@/features/listings/insights";
import { requireRole } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Applicants",
  robots: { index: false, follow: false },
};

export default async function ApplicantsPage() {
  await requireRole("landlord", { redirectTo: "/dashboard/applicants" });
  const result = await getAllApplicants();

  if (!result.success) {
    return (
      <AppShell width="xl" className="pt-2 md:pt-10">
        <PageHeader
          eyebrow="Landlord workspace"
          title="Applicants"
          description="Applications across every listing, grouped by status."
        />
        <EmptyState icon={Users} title="Unable to load applicants" description="The dashboard could not load your applicants. Refresh the page or try again later." />
      </AppShell>
    );
  }

  const grouped = result.data;
  const total = applicationStatuses.reduce((sum, status) => sum + (grouped[status]?.length ?? 0), 0);

  return (
    <AppShell width="xl" className="pt-2 md:pt-10">
      <PageHeader
        eyebrow="Landlord workspace"
        title="Applicants"
        description="Applications across every listing, grouped by status."
        meta={
          <MetricStrip
            metrics={[
              { label: "Total", value: total, tone: "forest" },
              { label: "Shortlisted", value: grouped.shortlisted.length, tone: "clay" },
              { label: "Approved", value: grouped.approved.length },
            ]}
          />
        }
      />

      {total === 0 ? (
        <EmptyState icon={Users} title="No applicants yet" description="Applications will appear here once renters apply to any of your listings." />
      ) : (
        <ApplicantManager grouped={grouped} />
      )}
    </AppShell>
  );
}
