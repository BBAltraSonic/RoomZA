import type { Metadata } from "next";
import Link from "next/link";
import { Building2, CalendarDays, Users } from "lucide-react";

import { AppShell, EmptyState, MetricStrip, PageHeader } from "@/components/premium/primitives";
import { getLandlordViewings } from "@/features/viewings/actions/get-landlord-viewings";
import { ViewingScheduler } from "@/features/viewings/components/viewing-scheduler";
import { getAllApplicants } from "@/features/applications/actions";
import { getMyListings } from "@/features/listings/actions";
import { applicationStatuses } from "@/features/listings/insights";
import { requireRole } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Viewings",
  robots: { index: false, follow: false },
};

export default async function ViewingsPage() {
  await requireRole("landlord", { redirectTo: "/dashboard/viewings" });
  const [result, applicantsResult, listingsResult] = await Promise.all([
    getLandlordViewings(),
    getAllApplicants(),
    getMyListings(),
  ]);

  if (!result.success) {
    return (
      <AppShell width="xl" className="pt-2 md:pt-10">
        <PageHeader
          eyebrow="Landlord workspace"
          title="Viewings"
          description="Proposed slots and booked appointments across your listings."
          action={<CalendarDays className="size-8 text-forest" />}
        />
        <EmptyState icon={CalendarDays} title="Unable to load viewings" description="The dashboard could not load your viewings. Refresh the page or try again later." />
      </AppShell>
    );
  }

  const data = result.data;
  const hasViewings = data.proposed.length > 0 || data.booked.length > 0;
  const applicantCount = applicantsResult.success
    ? applicationStatuses.reduce((sum, status) => sum + (applicantsResult.data[status]?.length ?? 0), 0)
    : 0;
  const hasListings = listingsResult.success && (listingsResult.data?.length ?? 0) > 0;

  return (
    <AppShell width="xl" className="pt-2 md:pt-10">
      <PageHeader
        eyebrow="Landlord workspace"
        title="Viewings"
        description="Proposed slots and booked appointments across your listings."
        action={<CalendarDays className="size-8 text-forest" />}
        meta={
          <MetricStrip
            metrics={[
              { label: "Proposed", value: data.proposed.length, tone: "forest" },
              { label: "Booked", value: data.booked.length, tone: "clay" },
              { label: "Total", value: data.proposed.length + data.booked.length },
            ]}
          />
        }
      />

      {hasViewings ? (
        <ViewingScheduler data={data} />
      ) : (
        <EmptyState
          icon={!hasListings ? Building2 : applicantCount > 0 ? CalendarDays : Users}
          title={!hasListings
            ? "Create a listing before scheduling viewings"
            : applicantCount > 0
              ? "Propose the first viewing times"
              : "Viewings unlock after applicants arrive"}
          description={!hasListings
            ? "Start a private draft, complete it, and publish it to the map."
            : applicantCount > 0
              ? "Open an applicant record and propose one or more times for the renter to choose from."
              : "Complete and publish a listing first. When renters apply, viewing actions will appear in their applicant records."}
          action={
            <Link
              href={!hasListings ? "/dashboard/listings/new" : applicantCount > 0 ? "/dashboard/applicants" : "/dashboard"}
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-forest px-4 text-sm font-semibold text-primary-foreground hover:bg-forest/90"
            >
              {!hasListings ? "Create quick draft" : applicantCount > 0 ? "Open applicants" : "Review listing readiness"}
            </Link>
          }
        />
      )}
    </AppShell>
  );
}
