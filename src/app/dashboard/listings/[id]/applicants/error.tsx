"use client";

import { AlertCircle, RefreshCcw } from "lucide-react";

import { AppShell, BackLink, EmptyState, PageHeader } from "@/components/premium/primitives";
import { Button } from "@/components/ui/button";

export default function ListingApplicantsError({ reset }: { error: Error; reset: () => void }) {
  return (
    <AppShell width="xl" className="pt-2 md:pt-20">
      <BackLink href="/dashboard">Dashboard</BackLink>
      <PageHeader
        eyebrow="Applicant queue"
        title="Applicants unavailable"
        description="The listing applicant queue could not be loaded."
      />
      <EmptyState
        icon={AlertCircle}
        title="Unable to load applicants"
        description="Refresh the queue to try loading the applicants for this listing again."
        action={
          <Button type="button" onClick={reset} className="h-11 bg-forest text-primary-foreground hover:bg-forest/90">
            <RefreshCcw className="size-4" />
            Retry
          </Button>
        }
      />
    </AppShell>
  );
}
