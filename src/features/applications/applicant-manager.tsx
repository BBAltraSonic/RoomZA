"use client";

import { StatusBadge } from "@/components/premium/primitives";
import { applicationStatuses } from "@/features/listings/insights";
import type { Database } from "@/lib/supabase/types";
import { ApplicantCard, type ApplicantApplication } from "./applicant-card";

type ApplicationStatus = Database["public"]["Enums"]["application_status"];

export function ApplicantManager({ grouped }: { grouped: Record<ApplicationStatus, ApplicantApplication[]> }) {
  return (
    <div className="space-y-4">
      {applicationStatuses.map((status) => {
        const applicants = grouped[status] ?? [];
        return (
          <section key={status} className="rounded-lg border border-border bg-panel p-4 shadow-[var(--elevation-1)]">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase text-muted-foreground">{status.replace("_", " ")}</h2>
              <StatusBadge>{applicants.length}</StatusBadge>
            </div>
            {applicants.length === 0 ? (
              <p className="text-sm text-muted-foreground">No applicants in this stage.</p>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {applicants.map((applicant) => (
                  <ApplicantCard key={applicant.id} application={applicant} />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
