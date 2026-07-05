import type { Metadata } from "next";
import Link from "next/link";
import { Compass, Map } from "lucide-react";

import { AppShell, EmptyState, MetricStrip, PageHeader } from "@/components/premium/primitives";
import { getMyApplications } from "@/features/applications/actions";
import { deriveJourney, sortJourneys } from "@/features/applications/journey";
import { JourneyBoard } from "@/features/applications/journey/journey-board";
import { requireRole } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Your Journey",
  robots: { index: false, follow: false },
};

export default async function JourneyPage() {
  const { user, profile } = await requireRole("renter", { redirectTo: "/journey" });
  const applicationsResult = await getMyApplications();
  const applications = applicationsResult.success ? applicationsResult.data ?? [] : [];

  const journeys = applications
    .filter((app) => Boolean(app.listing))
    .map(deriveJourney)
    .sort(sortJourneys);

  const activeJourneys = journeys.filter((journey) => journey.outcome === "active");
  const approvedCount = journeys.filter((journey) => journey.outcome === "approved").length;
  const bestPercent = activeJourneys.reduce((max, journey) => Math.max(max, journey.percent), 0);

  return (
    <AppShell width="md" className="pt-2 md:pt-20">
      <PageHeader
        eyebrow="Renter workspace"
        title="Your Journey"
        description="Watch yourself move closer to your new home, one step at a time."
        action={
          journeys.length > 0 ? (
            <MetricStrip
              className="min-w-[260px]"
              metrics={[
                { label: "Active", value: `${activeJourneys.length}`, tone: "forest" },
                { label: "Approved", value: `${approvedCount}`, tone: approvedCount > 0 ? "forest" : "default" },
                { label: "Furthest", value: `${bestPercent}%`, tone: "clay" },
              ]}
            />
          ) : null
        }
      />

      {!applicationsResult.success ? (
        <div className="mb-5 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          {applicationsResult.error}
        </div>
      ) : null}

      {journeys.length === 0 && applicationsResult.success ? (
        <EmptyState
          icon={Compass}
          title="Start your journey"
          description="Find a home you love and apply. Your progress toward moving in will come to life right here."
          action={
            <Link
              href="/"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-forest px-4 text-sm font-medium text-primary-foreground hover:bg-forest/90"
            >
              <Map className="size-4" />
              Browse the map
            </Link>
          }
        />
      ) : (
        <JourneyBoard journeys={journeys} renterId={user.id} />
      )}

      {profile.email ? (
        <p className="mt-6 text-center text-xs text-muted-foreground/70">Signed in as {profile.email}</p>
      ) : null}
    </AppShell>
  );
}
