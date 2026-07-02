import { MetricStrip } from "@/components/premium/primitives";
import type { ListingInsights } from "@/features/listings/insights";

export function ListingInsightsPanel({ insights }: { insights: ListingInsights }) {
  return (
    <MetricStrip
      className="grid-cols-2 shadow-none sm:grid-cols-4"
      metrics={[
        { label: "Views", value: insights.totalViews },
        { label: "Apps", value: insights.totalApplications, tone: "forest" },
        { label: "Shortlist", value: insights.applicationsByStatus.shortlisted, tone: "clay" },
        { label: "Viewings", value: insights.upcomingViewings },
      ]}
    />
  );
}
