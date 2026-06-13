import type { Database } from "@/lib/supabase/types";

type ApplicationStatus = Database["public"]["Enums"]["application_status"];
type ViewingStatus = Database["public"]["Enums"]["viewing_status"];

export const applicationStatuses: ApplicationStatus[] = ["submitted", "under_review", "shortlisted", "rejected", "approved", "withdrawn"];

export type ListingInsightApplication = { status: ApplicationStatus };
export type ListingInsightViewing = {
  status: ViewingStatus;
  slot?: { start_time?: string | null } | null;
  meeting_starts_at?: string | null;
};

export type ListingInsights = {
  totalApplications: number;
  applicationsByStatus: Record<ApplicationStatus, number>;
  upcomingViewings: number;
};

export function computeInsights(applications: ListingInsightApplication[], viewings: ListingInsightViewing[], now: Date): ListingInsights {
  const applicationsByStatus = Object.fromEntries(applicationStatuses.map((status) => [status, 0])) as Record<ApplicationStatus, number>;

  for (const application of applications) {
    applicationsByStatus[application.status] += 1;
  }

  const nowMs = now.getTime();
  const upcomingViewings = viewings.filter((viewing) => {
    if (viewing.status === "cancelled") return false;
    const startsAt = viewing.meeting_starts_at ?? viewing.slot?.start_time;
    const startsAtMs = startsAt ? new Date(startsAt).getTime() : Number.NaN;
    return Number.isFinite(startsAtMs) && startsAtMs > nowMs;
  }).length;

  return {
    totalApplications: applications.length,
    applicationsByStatus,
    upcomingViewings,
  };
}
