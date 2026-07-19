import Link from "next/link";
import { Compass, Map } from "lucide-react";

import { EmptyState, MetricStrip } from "@/components/premium/primitives";
import { deriveJourney, sortJourneys } from "@/features/applications/journey";

import { JourneyBoard } from "./journey-board";

type Applications = Parameters<typeof deriveJourney>[0][];

export function ApplicationsProgress({ applications, renterId }: { applications: Applications; renterId: string }) {
  const journeys = (applications ?? [])
    .filter((application) => Boolean(application.listing))
    .map(deriveJourney)
    .sort(sortJourneys);
  const activeJourneys = journeys.filter((journey) => journey.outcome === "active");
  const approvedCount = journeys.filter((journey) => journey.outcome === "approved").length;
  const bestPercent = activeJourneys.reduce((maximum, journey) => Math.max(maximum, journey.percent), 0);

  return (
    <>
      {journeys.length > 0 ? (
        <MetricStrip
          className="mb-5 sm:grid-cols-3"
          metrics={[
            { label: "Active", value: activeJourneys.length, tone: "forest" },
            { label: "Approved", value: approvedCount, tone: approvedCount > 0 ? "forest" : "default" },
            { label: "Furthest", value: `${bestPercent}%`, tone: "clay" },
          ]}
        />
      ) : null}

      {journeys.length === 0 ? (
        <EmptyState
          icon={Compass}
          title="Your progress starts with the right home"
          description="Save a shortlist, compare the details, then apply. Each next step will appear here."
          action={
            <Link href="/" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-forest px-4 text-sm font-medium text-primary-foreground hover:bg-forest/90">
              <Map className="size-4" aria-hidden="true" />
              Browse the map
            </Link>
          }
        />
      ) : (
        <JourneyBoard journeys={journeys} renterId={renterId} />
      )}
    </>
  );
}
