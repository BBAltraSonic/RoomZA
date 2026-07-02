import { applicationStatuses } from "@/features/listings/insights";
import type { ApplicationStatus } from "./transitions";

export type GroupableApplicant = {
  status: ApplicationStatus;
  created_at: string;
};

export function groupApplicantsByStatus<T extends GroupableApplicant>(applications: T[]) {
  const grouped = applicationStatuses.reduce(
    (accumulator, status) => {
      accumulator[status] = [];
      return accumulator;
    },
    {} as Record<ApplicationStatus, T[]>,
  );

  for (const application of applications) {
    grouped[application.status].push(application);
  }

  for (const status of applicationStatuses) {
    grouped[status].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  return grouped;
}

export function bucketApplicantsForReview<T extends GroupableApplicant>(applications: T[]) {
  const grouped = groupApplicantsByStatus(applications);

  return {
    activeApplicants: [...grouped.shortlisted, ...grouped.submitted, ...grouped.under_review],
    approvedApplicants: grouped.approved,
    inactiveApplicants: [...grouped.rejected, ...grouped.withdrawn],
  };
}
