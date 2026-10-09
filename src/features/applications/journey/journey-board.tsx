"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/browser";
import type { DerivedJourney } from "../journey";
import { JourneyCard } from "./journey-card";

/**
 * Renders the renter's journeys and keeps them live. It subscribes to Postgres
 * changes on the renter's own `applications` rows via Supabase Realtime and
 * refreshes the server data whenever the landlord advances a status — so the
 * journey feels alive without a manual reload. If Realtime isn't enabled for
 * the table, the subscription simply never fires and the page still works.
 */
export function JourneyBoard({
  journeys,
  renterId,
}: {
  journeys: DerivedJourney[];
  renterId: string;
}) {
  const router = useRouter();
  const lastRefresh = useRef(0);

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    let trailing: ReturnType<typeof setTimeout> | undefined;

    // Throttle refreshes so a burst of changes coalesces into one refetch.
    const refresh = () => {
      if (!active) return;
      const remaining = 1200 - (Date.now() - lastRefresh.current);
      if (remaining > 0) {
        if (trailing === undefined) trailing = setTimeout(() => { trailing = undefined; refresh(); }, remaining);
        return;
      }
      lastRefresh.current = Date.now();
      router.refresh();
    };

    const channel = supabase
      .channel(`journey:${renterId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "applications",
          filter: `renter_id=eq.${renterId}`,
        },
        refresh,
      )
      .subscribe();

    return () => {
      active = false;
      clearTimeout(trailing);
      void supabase.removeChannel(channel);
    };
  }, [renterId, router]);

  return (
    <section className="space-y-4 sm:space-y-5">
      {journeys.map((journey) => (
        <JourneyCard key={journey.applicationId} journey={journey} />
      ))}
    </section>
  );
}
