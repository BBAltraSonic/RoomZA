"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as m from "motion/react-m";
import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, Eye, Heart, MapPin, Video } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { ImageLightbox } from "@/components/premium/image-lightbox";
import { StatusBadge } from "@/components/premium/primitives";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ReportPanel } from "@/features/admin/components/report-panel";
import { ApplicationModal } from "@/features/applications/application-modal";
import { getOrCreateInquiryConversation } from "@/features/chat/actions";
import { propertyPublicContact } from "@/features/guest-contact/schema";
import { AmenitiesSection } from "@/features/listings/detail-cards/amenities-section";
import { BondCalculatorCard } from "@/features/listings/detail-cards/bond-calculator-card";
import { formatListingDate } from "@/features/listings/detail-cards/format";
import { LeaseUtilitiesCard } from "@/features/listings/detail-cards/lease-utilities-card";
import { ListerIdentity } from "@/features/listings/detail-cards/lister-identity";
import { ListingFactsGrid } from "@/features/listings/detail-cards/listing-facts-grid";
import { MoveInCostCard } from "@/features/listings/detail-cards/move-in-cost-card";
import { PurchaseProgressTimeline } from "@/features/listings/detail-cards/purchase-progress-timeline";
import { TrueMonthlyCostCard } from "@/features/listings/detail-cards/true-monthly-cost-card";
import type { ListingDetail, ListingImage } from "@/features/listings/detail-cards/types";
import type { AmenitiesData } from "@/features/listings/schema";
import { formatLiveTourSchedule } from "@/features/live-tours/schedule";
import { AskPikoButton } from "@/features/piko/ask-piko-button";
import { PresenceBadge } from "@/features/presence/presence-badge";
import { contactSellerForPurchase, requestPurchaseViewing } from "@/features/purchase/actions";
import { PURCHASE_STAGES, type PurchaseStage } from "@/features/purchase/progress";
import { usePurchaseProgress } from "@/features/purchase/use-purchase-progress";
import { LandlordTrustSignals } from "@/features/trust/components/landlord-trust-signals";
import { PendingGlyph } from "@/lib/motion/primitives";
import { authPathForRedirect } from "@/lib/redirects";
import { cn, formatPrice } from "@/lib/utils";

import { useFavorites } from "./hooks/use-favorites";
import { buildListingShareUrl, shareListing } from "./lib/listing-share";
import { ListingMoreMenu } from "./listing-more-menu";
import { selectLiveActivitySignals } from "./live-activity";
import { ManualCopyPopover } from "./manual-copy-popover";

// Existing importers read the type from here.
export type { ListingDetail };

// Kept in its own chunk, like the Connect sheet it replaced.
const ContactSheet = dynamic(
  () => import("@/features/showings/contact-sheet").then((module) => module.ContactSheet),
  { loading: () => <span aria-hidden="true" className="block h-11 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" /> },
);

type ListingDetailPanelProps = {
  listing: ListingDetail;
  initialIntent?: "apply" | "message";
  onBack?: () => void;
  onScroll?: (event: React.UIEvent<HTMLElement>) => void;
  /**
   * Renders the panel for a narrow rail (desktop ~30% width): tighter padding,
   * smaller spacing and grids that stay at two columns instead of expanding via
   * the viewport-based `sm:` breakpoints.
   */
  compact?: boolean;
};

function ImageCarousel({ images, title }: { images: ListingImage[]; title: string }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const goNext = useCallback(() => {
    setCurrentIndex((i) => (i + 1) % images.length);
  }, [images.length]);

  const goPrev = useCallback(() => {
    setCurrentIndex((i) => (i - 1 + images.length) % images.length);
  }, [images.length]);

  if (images.length === 0) {
    return (
      <div className="flex aspect-[16/10] items-center justify-center rounded-lg border border-border bg-muted">
        <p className="text-sm text-muted-foreground">No photos uploaded</p>
      </div>
    );
  }

  return (
    <div>
      <div className="group relative aspect-[16/10] overflow-hidden bg-muted sm:mx-0 sm:rounded-lg">
        <button
          type="button"
          className="absolute inset-0 cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          onClick={() => setLightboxOpen(true)}
          aria-label={`Open gallery for ${title}`}
        >
          {images[currentIndex] ? (
            <Image
              src={images[currentIndex].public_url}
              alt={title}
              fill
              sizes="(min-width: 1024px) 540px, 100vw"
              className="object-cover transition-transform duration-[var(--motion-standard)] group-hover:scale-[1.02] motion-reduce:transform-none"
            />
          ) : null}
        </button>

        {images.length > 1 ? (
          <>
            <button
              type="button"
              onClick={goPrev}
              className="mobile-fab absolute left-3 top-1/2 -translate-y-1/2 border border-border/40 opacity-100 transition-opacity sm:!size-9 sm:!rounded-md sm:!bg-panel sm:opacity-0 sm:group-hover:opacity-100"
              aria-label="Previous image"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={goNext}
              className="mobile-fab absolute right-3 top-1/2 -translate-y-1/2 border border-border/40 opacity-100 transition-opacity sm:!size-9 sm:!rounded-md sm:!bg-panel sm:opacity-0 sm:group-hover:opacity-100"
              aria-label="Next image"
            >
              <ChevronRight className="size-4" />
            </button>
            <div className="absolute bottom-3 right-3 rounded-full bg-media-surface/70 px-2.5 py-1 text-xs font-semibold tracking-wide text-media-foreground backdrop-blur-md">
              {currentIndex + 1} / {images.length}
            </div>
          </>
        ) : null}
      </div>

      {/* Thumbnail strip — quick jump between photos, active one highlighted. */}
      {images.length > 1 ? (
        <div className="mt-2 flex gap-2 overflow-x-auto scrollbar-hide px-4 sm:px-0">
          {images.map((image, i) => (
            <button
              key={image.id}
              type="button"
              onClick={() => setCurrentIndex(i)}
              aria-label={`View photo ${i + 1} of ${images.length}`}
              aria-current={i === currentIndex}
              className={cn(
                "relative size-16 shrink-0 overflow-hidden rounded-lg border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest",
                i === currentIndex
                  ? "border-forest ring-2 ring-forest/40"
                  : "border-border/50 opacity-70 hover:opacity-100",
              )}
            >
              <Image
                src={image.public_url}
                alt={`${title} photo ${i + 1}`}
                fill
                sizes="64px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      ) : null}

      <ImageLightbox
        images={images}
        initialIndex={currentIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        title={title}
        imageAction={(image) => (
          <ReportPanel
            listingImageId={image.id}
            label="Report photo"
            popover
            compact
            className="text-primary-foreground [&_button]:text-primary-foreground [&_button]:hover:text-primary-foreground"
          />
        )}
      />
    </div>
  );
}


export function ListingDetailPanel({ listing, initialIntent, onBack, onScroll, compact }: ListingDetailPanelProps) {
  const amenities = (listing.metadata as { amenities?: AmenitiesData } | null)?.amenities;
  const { isFavorite, toggleFavorite, authenticated } = useFavorites();
  const [isMessaging, setIsMessaging] = useState(false);
  const [isRequestingViewing, setIsRequestingViewing] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [hasScrolled, setHasScrolled] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [manualCopyUrl, setManualCopyUrl] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const sharePendingRef = useRef(false);
  const shareTriggerRef = useRef<HTMLElement | null>(null);
  const router = useRouter();
  const favorited = isFavorite(listing.id);
  const isSale = listing.listing_type === "sale";
  const persistedPurchaseStages = usePurchaseProgress(listing.id, Boolean(isSale && authenticated));
  const liveActivitySignals = selectLiveActivitySignals(listing.liveActivity);
  const displayPrice = listing.display_price ?? listing.sale_price ?? listing.price;
  const [recordedProgress, setRecordedProgress] = useState<{ id: string; stages: PurchaseStage[] }>({ id: listing.id, stages: [] });
  const completedPurchaseStages = useMemo(() => {
    const recordedPurchaseStages = recordedProgress.id === listing.id ? recordedProgress.stages : [];
    return [...new Set([
      ...persistedPurchaseStages, ...recordedPurchaseStages,
      ...(isSale && favorited ? ["property_saved" as PurchaseStage] : []),
    ])];
  }, [favorited, isSale, recordedProgress, listing.id, persistedPurchaseStages]);

  const currentPurchaseStage = PURCHASE_STAGES.find((stage) => !completedPurchaseStages.includes(stage)) ?? "purchase_complete";

  function markPurchaseStage(stage: PurchaseStage) {
    setRecordedProgress((current) => {
      const stages = current.id === listing.id ? current.stages : [];
      return { id: listing.id, stages: stages.includes(stage) ? stages : [...stages, stage] };
    });
  }

  async function handleFavoriteToggle() {
    const saved = await toggleFavorite(listing.id, { listingType: listing.listing_type });
    if (saved && isSale && !favorited) {
      markPurchaseStage("property_saved");
    }
  }

  const closeManualCopy = useCallback(() => {
    setManualCopyUrl(null);
    shareTriggerRef.current?.focus();
  }, []);

  async function handleShare(trigger: HTMLElement | null) {
    if (sharePendingRef.current) return;

    sharePendingRef.current = true;
    shareTriggerRef.current = trigger;
    setIsSharing(true);
    setManualCopyUrl(null);
    setShareStatus("Sharing listing");

    const url = buildListingShareUrl(window.location.origin, listing.id);
    try {
      const outcome = await shareListing({ title: listing.title, text: listing.address, url });

      if (outcome === "shared") {
        setShareStatus("Property shared");
        toast.success("Property shared");
      } else if (outcome === "copied") {
        setShareStatus("Listing link copied");
        toast.success("Link copied");
      } else if (outcome === "cancelled") {
        setShareStatus("Sharing cancelled");
      } else {
        setManualCopyUrl(url);
        setShareStatus("Automatic copying is unavailable. Copy the selected listing link manually.");
      }
    } catch {
      setManualCopyUrl(url);
      setShareStatus("Automatic copying is unavailable. Copy the selected listing link manually.");
      toast.error("Could not share this property");
    } finally {
      sharePendingRef.current = false;
      setIsSharing(false);
    }
  }

  async function handleMessage() {
    if (!authenticated) { router.push(authPathForRedirect(`/listing/${listing.id}?intent=message`)); return; }
    setIsMessaging(true);
    setMessageError(null);
    try {
      const res = isSale ? await contactSellerForPurchase(listing.id) : await getOrCreateInquiryConversation(listing.id);
      const conversationId = res.success ? ("data" in res ? res.data.conversationId : res.conversationId) : null;
      if (conversationId) {
        if (isSale) markPurchaseStage("contacted_seller");
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

  function handleDetailScroll(event: React.UIEvent<HTMLDivElement>) {
    const nextHasScrolled = event.currentTarget.scrollTop > 8;
    setHasScrolled((current) => (current === nextHasScrolled ? current : nextHasScrolled));
    onScroll?.(event);
  }

  const liveTourContent = listing.liveTourId ? (
    <Button
      render={<Link href={`/live-tours/${listing.liveTourId}`} />}
      className="h-11 w-full border border-status-info-border bg-status-info-surface text-status-info-text hover:bg-status-info-surface/80"
    >
      <Video className="size-4" aria-hidden="true" />
      Join live video tour
    </Button>
  ) : listing.upcomingLiveTour ? (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-status-info-border bg-status-info-surface px-4 py-3 text-status-info-text">
      <span className="inline-flex items-center gap-2 text-sm font-semibold">
        <CalendarDays className="size-4" aria-hidden="true" />
        Live open house
      </span>
      <time dateTime={listing.upcomingLiveTour.scheduledAt} className="text-right text-xs font-semibold">
        {formatLiveTourSchedule(listing.upcomingLiveTour.scheduledAt, "compact")}
      </time>
    </div>
  ) : null;

  return (
    <m.div
      className="relative flex h-full min-h-0 flex-col bg-panel text-ink"
      layout
      layoutId={`listing-${listing.id}`}
      data-slot="listing-detail-motion"
    >
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {shareStatus}
      </p>
      {manualCopyUrl ? <ManualCopyPopover url={manualCopyUrl} onClose={closeManualCopy} /> : null}

      {/* Keep navigation reachable while the gallery and property details scroll together. */}
      <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2 sm:hidden">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-ink hover:bg-warm-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Back to homes"
          >
            <ArrowLeft className="size-[1.125rem] text-ink" />
            Homes
          </button>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          <ListingMoreMenu
            onShare={handleShare}
            onReport={() => setReportOpen(true)}
            sharing={isSharing}
            className="mobile-fab !size-11 transition-[transform,background-color,color] duration-[var(--motion-fast)] active:scale-95 motion-reduce:transform-none"
            iconClassName="size-[1.125rem] text-ink"
          />
          <button
            type="button"
            onClick={handleFavoriteToggle}
            className={cn(
              "mobile-fab !size-11 group transition-[transform,background-color,color] duration-200 hover:scale-105 active:scale-90 motion-reduce:transform-none motion-reduce:transition-none",
              favorited && "!bg-selection !text-selection-foreground",
            )}
            aria-label={favorited ? "Remove from saved" : "Save listing"}
          >
            <Heart className={cn("size-[1.125rem] transition-transform duration-200 group-active:scale-75 motion-reduce:transition-none", favorited ? "fill-current" : "text-ink")} />
          </button>
        </div>
      </div>

      <div
        data-slot="listing-detail-scroll-region"
        data-scrolled={hasScrolled ? "true" : "false"}
        onScroll={handleDetailScroll}
        className={cn(
          "scroll-contained min-h-0 flex-1 overflow-y-auto scrollbar-hide",
          hasScrolled && "[-webkit-mask-image:linear-gradient(to_bottom,transparent_0,black_1.75rem,black_100%)] [mask-image:linear-gradient(to_bottom,transparent_0,black_1.75rem,black_100%)]",
        )}
      >
        <div className="sm:hidden">
          <ImageCarousel images={listing.images} title={listing.title} />
        </div>
        {liveTourContent ? <div className="px-4 pt-4">{liveTourContent}</div> : null}
        {/* Header scrolls with the listing and fades at the top edge once content moves. */}
        <div className={cn("border-b border-border p-4", compact ? "sm:p-4" : "sm:p-5")}>
        {/* Desktop back button */}
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="mb-4 hidden items-center gap-2 text-sm font-medium text-forest hover:text-forest/80 sm:inline-flex"
          >
            <ArrowLeft className="size-4" />
            Back to homes
          </button>
        ) : null}

        {/* Calm meta line: a single availability badge, with the listed-on
            timestamp demoted to quiet inline text so it doesn't compete. */}
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <StatusBadge tone="forest">{listing.availability_date && Number.isFinite(Date.parse(listing.availability_date)) ? `Available ${formatListingDate(listing.availability_date)}` : "Availability not specified"}</StatusBadge>
          {listing.listing_reviewed_at ? <StatusBadge tone="info">Listing reviewed {formatListingDate(listing.listing_reviewed_at)}</StatusBadge> : null}
          {(() => {
            const daysAgo = Math.floor((new Date().getTime() - new Date(listing.created_at).getTime()) / (1000 * 3600 * 24));
            let label: string | null = null;
            if (daysAgo === 0) label = "Listed today";
            else if (daysAgo === 1) label = "Listed yesterday";
            else if (daysAgo < 30) label = `Listed ${daysAgo} days ago`;
            return label ? <span className="text-xs font-medium text-muted-foreground">{label}</span> : null;
          })()}
        </div>

        {/* Title — the primary focal point */}
        <m.h1 layoutId={`listing-${listing.id}-title`} className="mt-3 line-clamp-2 text-2xl font-bold leading-tight tracking-tight text-ink sm:text-[1.75rem]">
          {listing.title}
        </m.h1>

        {/* Address */}
        <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="size-4 shrink-0 text-clay" />
          <m.span layoutId={`listing-${listing.id}-location`} className="truncate">{listing.address}</m.span>
        </p>

        {/* Price — secondary focal point — with the save action aligned to it
            (desktop only; mobile uses the floating heart on the image hero). */}
        <div className="mt-4 flex items-end justify-between gap-4">
          <m.p layoutId={`listing-${listing.id}-price`} className="text-[1.75rem] font-bold tracking-tight text-ink sm:text-3xl">
            {formatPrice(displayPrice)}
            {!isSale ? <span className="ml-1.5 text-sm font-medium text-muted-foreground">/month</span> : null}
          </m.p>
          <div className="hidden items-center gap-2 sm:flex">
            <ListingMoreMenu
              onShare={handleShare}
              onReport={() => setReportOpen(true)}
              sharing={isSharing}
              className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-panel text-ink shadow-[var(--elevation-1)] transition-colors hover:border-forest hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <button
              type="button"
              onClick={handleFavoriteToggle}
              className={cn(
                "group flex size-10 shrink-0 items-center justify-center rounded-md border shadow-[var(--elevation-1)] transition-[transform,background-color,color] duration-200 hover:scale-105 active:scale-90 motion-reduce:transform-none motion-reduce:transition-none",
                favorited
                  ? "border-forest bg-forest text-primary-foreground"
                  : "border-border bg-panel text-ink hover:border-forest hover:text-forest",
              )}
              aria-label={favorited ? "Remove from saved" : "Save listing"}
            >
              <Heart className={cn("size-4 transition-transform duration-200 group-active:scale-75 motion-reduce:transition-none", favorited && "fill-current")} />
            </button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {!isSale && !compact && listing.landlordPresence?.name ? (
            <ListerIdentity presence={listing.landlordPresence} />
          ) : null}
          <LandlordTrustSignals summary={listing.landlordTrust} />
          {listing.landlordPresence ? (
            <PresenceBadge
              badge={listing.landlordPresence.badge}
              responseSeconds={
                listing.landlordTrust?.predictedResponseSeconds
                ?? listing.landlordTrust?.medianFirstResponseSeconds
              }
              predicted={listing.landlordTrust?.predictedResponseSeconds !== undefined}
            />
          ) : null}
        </div>
        {liveActivitySignals.length ? (
          <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs font-medium text-muted-foreground" aria-label="Recent listing activity">
            {liveActivitySignals.map((signal) => (
              <li key={signal.kind} className="inline-flex items-center gap-1.5">
                <Eye className="size-3.5" aria-hidden="true" />
                {signal.label}
              </li>
            ))}
          </ul>
        ) : null}
        </div>

        <div className={cn(compact ? "space-y-4 p-4" : "space-y-5 p-4 sm:space-y-6 sm:p-5")}>
        {/* Desktop: image carousel inside scroll */}
        <div className="hidden sm:block">
          <ImageCarousel images={listing.images} title={listing.title} />
        </div>

        {isSale ? <BondCalculatorCard listing={listing} compact={compact} /> : (
          <>
            <MoveInCostCard listing={listing} />
            <TrueMonthlyCostCard listing={listing} compact={compact} />
          </>
        )}

        {isSale ? (
          <PurchaseProgressTimeline
            currentStage={currentPurchaseStage}
            completedStages={completedPurchaseStages}
            compact={compact}
          />
        ) : null}

        <ListingFactsGrid listing={listing} compact={compact} />

        <section className="rounded-xl border border-border bg-surface-panel p-4 shadow-[var(--elevation-1)] sm:rounded-lg">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-forest/10 text-forest">
              <MapPin className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-ink">Location and neighbourhood</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{listing.address}</p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Explore this property’s location on the map.
              </p>
            </div>
          </div>
        </section>

        <LeaseUtilitiesCard listing={listing} />

        <AmenitiesSection amenities={amenities} />
        </div>
      </div>

      <div
        className={cn("shrink-0 border-t border-border bg-panel", compact ? "p-3" : "px-3 pt-2 sm:p-4")}
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
        <AskPikoButton className="mb-2" />
        {/* Two actions only. Contact (secondary) holds every way to reach the lister; the
            primary moves the renter or buyer forward. Share and Report sit in the header menu. */}
        <div data-slot="listing-detail-actions" role="group" aria-label="Property actions" className="grid grid-cols-2 gap-2">
          <ContactSheet
            listingId={listing.id}
            title={listing.title}
            kind={isSale ? "sale" : "rent"}
            latitude={listing.latitude}
            longitude={listing.longitude}
            presence={isSale ? null : listing.landlordPresence?.badge ?? "offline"}
            listerName={listing.landlordPresence?.name}
            authenticated={Boolean(authenticated)}
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
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogTitle className="pr-8 text-base font-semibold text-ink">Report this listing</DialogTitle>
          <ReportPanel listingId={listing.id} bare />
        </DialogContent>
      </Dialog>
    </m.div>
  );
}
