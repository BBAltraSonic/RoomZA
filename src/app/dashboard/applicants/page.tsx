import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Users } from "lucide-react";

import { AppShell, EmptyState, MetricStrip, PageHeader } from "@/components/premium/primitives";
import { ApplicantManager } from "@/features/applications/applicant-manager";
import { getAllApplicants } from "@/features/applications/actions";
import { ApplicantAudienceTabs } from "@/features/dashboard/applicant-audience-tabs";
import { applicationStatuses } from "@/features/listings/insights";
import { getMyListings } from "@/features/listings/actions";
import { requireRole } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Applicants",
  robots: { index: false, follow: false },
};

export default async function ApplicantsPage() {
  await requireRole("landlord", { redirectTo: "/dashboard/applicants" });
  const [result, listingsResult] = await Promise.all([getAllApplicants(), getMyListings()]);

  if (!result.success) {
    return (
      <AppShell width="xl" className="pt-2 md:pt-10">
        <PageHeader
          eyebrow="Landlord workspace"
          title="Applicants"
          description="Applications across every listing, grouped by status."
        />
        <ApplicantAudienceTabs active="renters" />
        <EmptyState icon={Users} title="Unable to load applicants" description="The dashboard could not load your applicants. Refresh the page or try again later." />
      </AppShell>
    );
  }

  const grouped = result.data;
  const total = applicationStatuses.reduce((sum, status) => sum + (grouped[status]?.length ?? 0), 0);
  const hasListings = listingsResult.success && (listingsResult.data?.length ?? 0) > 0;

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
      <ApplicantAudienceTabs active="renters" />

      {total === 0 ? (
        <EmptyState
          icon={hasListings ? Users : Building2}
          title={hasListings ? "No applicants yet" : "Publish a listing before applicants can arrive"}
          description={hasListings
            ? "Complete and publish a listing so renters can discover it and submit structured applications."
            : "Create a private draft, add the required details and photos, then publish it to the map."}
          action={
            <Link
              href={hasListings ? "/dashboard" : "/dashboard/listings/new"}
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-forest px-4 text-sm font-semibold text-primary-foreground hover:bg-forest/90"
            >
              {hasListings ? "Review listing readiness" : "Create quick draft"}
            </Link>
          }
        />
      ) : (
        <ApplicantManager grouped={grouped} />
      )}
    </AppShell>
  );
}
