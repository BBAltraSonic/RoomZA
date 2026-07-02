import { notFound } from "next/navigation";
import { Users } from "lucide-react";

import { AppShell, BackLink, EmptyState, PageHeader, StatusBadge } from "@/components/premium/primitives";
import { getListingApplicants } from "@/features/applications/actions";
import { ApplicantCard } from "@/features/applications/applicant-card";
import { bucketApplicantsForReview } from "@/features/applications/applicant-grouping";
import { getMyListing } from "@/features/listings/actions";
import { requireRole } from "@/lib/auth";

export default async function ListingApplicantsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireRole("landlord", { redirectTo: `/dashboard/listings/${id}/applicants` });

  const listingResult = await getMyListing(id);
  if (!listingResult.success || !listingResult.data) notFound();
  const listing = listingResult.data;

  const applicantsResult = await getListingApplicants(id);

  if (!applicantsResult.success) {
    return (
      <AppShell width="xl" className="pt-2 md:pt-20">
        <BackLink href="/dashboard">Dashboard</BackLink>
        <PageHeader eyebrow="Applicant queue" title={listing.title} description={listing.address} />
        <EmptyState icon={Users} title="Unable to load applicants" description="The dashboard could not load the applicants for this listing. Refresh the page or try again later." />
      </AppShell>
    );
  }

  const applicants = applicantsResult.data;
  const { activeApplicants, approvedApplicants, inactiveApplicants } = bucketApplicantsForReview(applicants);

  return (
    <AppShell width="xl" className="pt-2 md:pt-20">
      <BackLink href="/dashboard">Dashboard</BackLink>

      <PageHeader
        eyebrow="Applicant queue"
        title={listing.title}
        description={listing.address}
        action={
          <div className="flex items-center gap-2 rounded-lg border border-border bg-panel px-4 py-2 text-sm font-medium shadow-[var(--elevation-1)]">
            <Users className="size-4 text-forest" />
            {applicants.length} total
          </div>
        }
      />

      {applicants.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No applicants yet"
          description="Applications, document readiness, and viewing actions will appear here once renters apply."
        />
      ) : (
        <div className="space-y-10">
          {approvedApplicants.length > 0 ? (
            <section>
              <div className="mb-4 flex items-center gap-2">
                <StatusBadge tone="success">{approvedApplicants.length}</StatusBadge>
                <h2 className="text-sm font-semibold uppercase text-forest">Approved</h2>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                {approvedApplicants.map((app) => (
                  <ApplicantCard key={app.id} application={app} />
                ))}
              </div>
            </section>
          ) : null}

          {activeApplicants.length > 0 ? (
            <section>
              <div className="mb-4 flex items-center gap-2">
                <StatusBadge tone="forest">{activeApplicants.length}</StatusBadge>
                <h2 className="text-sm font-semibold uppercase text-ink">In review</h2>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                {activeApplicants.map((app) => (
                  <ApplicantCard key={app.id} application={app} />
                ))}
              </div>
            </section>
          ) : null}

          {inactiveApplicants.length > 0 ? (
            <section>
              <div className="mb-4 flex items-center gap-2">
                <StatusBadge tone="neutral">{inactiveApplicants.length}</StatusBadge>
                <h2 className="text-sm font-semibold uppercase text-muted-foreground">Closed</h2>
              </div>
              <div className="grid gap-4 opacity-85 lg:grid-cols-2">
                {inactiveApplicants.map((app) => (
                  <ApplicantCard key={app.id} application={app} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </AppShell>
  );
}
