import type { Metadata } from "next";
import { CalendarDays } from "lucide-react";

import { AppShell, EmptyState, MetricStrip, PageHeader } from "@/components/premium/primitives";
import { getLandlordViewings } from "@/features/viewings/actions/get-landlord-viewings";
import { ViewingScheduler } from "@/features/viewings/components/viewing-scheduler";
import { requireRole } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Viewings",
  robots: { index: false, follow: false },
};

export default async function ViewingsPage() {
  await requireRole("landlord", { redirectTo: "/dashboard/viewings" });
  const result = await getLandlordViewings();

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

      <ViewingScheduler data={data} />
    </AppShell>
  );
}
