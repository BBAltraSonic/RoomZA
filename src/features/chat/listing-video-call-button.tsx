"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Video } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

import { requestListingVideoCall } from "./actions";

/**
 * ListingVideoCallButton — the "Video call" CTA surfaced on listing cards
 * (Requirement 5).
 *
 * On click it calls {@link requestListingVideoCall}, which resolves or creates
 * the inquiry conversation for the listing and starts a call on it through the
 * shared start-call path (Req 5.1, 5.2). On success it routes the renter to
 * `/messages/[conversationId]` with the call already active (Req 5.3). Failures
 * — including the own-listing rejection (Req 5.4) — are surfaced via a toast.
 *
 * Rendered as a round icon button so it sits cleanly alongside the existing
 * action-row controls (Map / Heart) on both the desktop `PropertyCard` and the
 * mobile `listing-card`.
 */
export function ListingVideoCallButton({
  listingId,
  className,
}: {
  /** The listing the renter wants to video-call the landlord about. */
  listingId: string;
  className?: string;
}) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
    // The action row sits on top of the card's full-card navigation links;
    // stop the click from also triggering card selection/navigation.
    event.preventDefault();
    event.stopPropagation();

    if (isPending) return;

    setIsPending(true);
    const result = await requestListingVideoCall(listingId);

    if (!result.success) {
      toast.error(result.error);
      setIsPending(false);
      return;
    }

    router.push(`/messages/${result.data.conversationId}`);
    // Intentionally leave `isPending` true while navigating away so the button
    // stays disabled and cannot be double-triggered during the route change.
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      aria-label="Video call"
      aria-busy={isPending}
      title="Video call"
      className={cn(
        "flex size-8 items-center justify-center rounded-full border border-border/50 text-muted-foreground transition-colors hover:border-forest hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
    >
      {isPending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Video className="size-4" />
      )}
      <span className="sr-only">Video call</span>
    </button>
  );
}
