import type { Database } from "@/lib/supabase/types";

export type ApplicationStatus = Database["public"]["Enums"]["application_status"];

const terminalStatuses = new Set<ApplicationStatus>(["rejected", "withdrawn", "approved"]);
const transitions: Record<ApplicationStatus, ApplicationStatus[]> = {
  submitted: ["under_review", "shortlisted", "rejected"],
  under_review: ["shortlisted", "rejected"],
  shortlisted: ["approved", "rejected"],
  rejected: [],
  withdrawn: [],
  approved: [],
};

export function permittedTransitions(current: ApplicationStatus) {
  return transitions[current] ?? [];
}

export function isPermittedTransition(from: ApplicationStatus, to: ApplicationStatus) {
  if (from === to) return false;
  if (terminalStatuses.has(from)) return false;
  return permittedTransitions(from).includes(to);
}
