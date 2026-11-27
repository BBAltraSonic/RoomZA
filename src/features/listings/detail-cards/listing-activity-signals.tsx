import { Eye } from "lucide-react";

import { selectLiveActivitySignals, type ListingLiveActivity } from "@/features/map-discovery/live-activity";
import { cn } from "@/lib/utils";

/** Rounded, anonymised interest in the listing; nothing when it is too weak to mean anything. */
export function ListingActivitySignals({ activity, className }: { activity?: ListingLiveActivity | null; className?: string }) {
  const signals = selectLiveActivitySignals(activity);
  if (!signals.length) return null;
  return (
    <ul className={cn("flex flex-wrap gap-x-3 gap-y-1 text-xs font-medium text-muted-foreground", className)} aria-label="Recent listing activity">
      {signals.map((signal) => (
        <li key={signal.kind} className="inline-flex items-center gap-1.5">
          <Eye className="size-3.5" aria-hidden="true" />
          {signal.label}
        </li>
      ))}
    </ul>
  );
}
