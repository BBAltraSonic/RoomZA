"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ApplicationModal } from "@/features/applications/application-modal";
import { getOrCreateInquiryConversation } from "@/features/chat/actions";
import { propertyPublicContact } from "@/features/guest-contact/schema";
import { AskPikoButton } from "@/features/piko/ask-piko-button";
import { contactSellerForPurchase, requestPurchaseViewing } from "@/features/purchase/actions";
import type { PurchaseStage } from "@/features/purchase/progress";
import { PendingGlyph } from "@/lib/motion/primitives";
import { authPathForRedirect } from "@/lib/redirects";
import { cn } from "@/lib/utils";

import type { ListingDetail } from "./types";

// Kept in its own chunk, like the Connect sheet it replaced.
const ContactSheet = dynamic(
  () => import("@/features/showings/contact-sheet").then((module) => module.ContactSheet),
  { loading: () => <span aria-hidden="true" className="block h-11 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" /> },
);

type ListingActionBarProps = {
  listing: ListingDetail;
  authenticated: boolean;
  initialIntent?: "apply" | "message";
  compact?: boolean;
  /** Records a purchase milestone the visitor just reached (sale listings). */
  onPurchaseStage?: (stage: PurchaseStage) => void;
  /** The swipe feed keeps its chrome minimal and leaves Piko to the dock. */
  askPiko?: boolean;
  className?: string;
};

/**
 * Two actions only. Contact (secondary) holds every way to reach the lister; the
 * primary moves the renter or buyer forward. Share and Report sit in a menu elsewhere.
 */
export function ListingActionBar({ listing, authenticated, initialIntent, compact, onPurchaseStage, askPiko = true, className }: ListingActionBarProps) {
  const router = useRouter();
  const isSale = listing.listing_type === "sale";
  const [isMessaging, setIsMessaging] = useState(false);
  const [isRequestingViewing, setIsRequestingViewing] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);

  async function handleMessage() {
    if (!authenticated) { router.push(authPathForRedirect(`/listing/${listing.id}?intent=message`)); return; }
    setIsMessaging(true);
    setMessageError(null);
    try {
      const res = isSale ? await contactSellerForPurchase(listing.id) : await getOrCreateInquiryConversation(listing.id);
      const conversationId = res.success ? ("data" in res ? res.data.conversationId : res.conversationId) : null;
      if (conversationId) {
        if (isSale) onPurchaseStage?.("contacted_seller");
        router.push(`/messages/${conversationId}`);
      } else {
        const errorMessage = ("error" in res ? res.error : undefined) ?? "Failed to start conversation.";
        if (errorMessage === "Unauthenticated") {
          setMessageError(isSale ? "Sign in to contact the seller about this property." : "Sign in to message the landlord about this home.");
        } else {
          setMessageError(errorMessage);
          toast.error(errorMessage);
        }
      }
    } catch {
      setMessageError("An unexpected error occurred. Please try again.");
    } finally {
      setIsMessaging(false);
    }
  }

  async function handleScheduleViewing() {
    setIsRequestingViewing(true);
    setMessageError(null);
    try {
      const result = await requestPurchaseViewing(listing.id);
      if (result.success) {
        toast.success("Viewing interest sent", { description: "The seller can propose available times from their dashboard." });
      } else if (result.error === "Unauthenticated") {
        setMessageError("Sign in to schedule a viewing for this property.");
      } else {
        setMessageError(result.error);
        toast.error(result.error);
      }
    } catch {
      setMessageError("An unexpected error occurred. Please try again.");
    } finally {
      setIsRequestingViewing(false);
    }
  }

  return (
    <div
      className={cn("shrink-0 border-t border-border bg-panel", compact ? "p-3" : "px-3 pt-2 sm:p-4", className)}
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.75rem)" }}
    >
      {messageError ? (
        <div className="mb-3 rounded-lg border border-status-warning-border bg-status-warning-surface px-3 py-2 text-sm text-status-warning-text">
          <p>{messageError}</p>
          {messageError.startsWith("Sign in") ? (
            <Link
              href={authPathForRedirect(`/listing/${listing.id}?intent=message`)}
              className="mt-1 inline-flex font-semibold text-forest hover:underline"
            >
              Sign in to continue
            </Link>
          ) : null}
        </div>
      ) : null}
      {askPiko ? <AskPikoButton className="mb-2" /> : null}
      <div data-slot="listing-detail-actions" role="group" aria-label="Property actions" className="grid grid-cols-2 gap-2">
        <ContactSheet
          listingId={listing.id}
          title={listing.title}
          kind={isSale ? "sale" : "rent"}
          latitude={listing.latitude}
          longitude={listing.longitude}
          presence={isSale ? null : listing.landlordPresence?.badge ?? "offline"}
          listerName={listing.landlordPresence?.name}
          authenticated={authenticated}
          contact={listing.publicContact ?? propertyPublicContact(listing.metadata)}
          onMessage={handleMessage}
          isMessaging={isMessaging}
          initialOpen={initialIntent === "message"}
        />
        {isSale ? (
          <Button
            data-emphasis="primary"
            onClick={handleScheduleViewing}
            disabled={isRequestingViewing}
            className="h-11 min-w-0 rounded-lg bg-forest px-2 text-sm font-semibold text-primary-foreground hover:bg-forest/90 disabled:opacity-50"
          >
            {isRequestingViewing ? <PendingGlyph label="Requesting viewing" className="mr-1" /> : <CalendarDays className="mr-1 size-4" />}
            <span className="truncate">Request a viewing</span>
          </Button>
        ) : (
          <ApplicationModal
            listingId={listing.id}
            initialOpen={initialIntent === "apply"}
            trigger={
              <Button data-emphasis="primary" className="h-11 min-w-0 rounded-lg bg-forest px-2 text-sm font-semibold text-primary-foreground hover:bg-forest/90">
                Apply now
              </Button>
            }
          />
        )}
      </div>
    </div>
  );
}
