"use client";

import { ChevronUp, MapPin } from "lucide-react";
import { useCallback, useId, useImperativeHandle, useRef, useState, type Ref } from "react";

import { Button } from "@/components/ui/button";
import { AmenitiesSection } from "@/features/listings/detail-cards/amenities-section";
import { BondCalculatorCard } from "@/features/listings/detail-cards/bond-calculator-card";
import { LeaseUtilitiesCard } from "@/features/listings/detail-cards/lease-utilities-card";
import { ListerIdentity } from "@/features/listings/detail-cards/lister-identity";
import { ListingActionBar } from "@/features/listings/detail-cards/listing-action-bar";
import { ListingFactsGrid } from "@/features/listings/detail-cards/listing-facts-grid";
import { MoveInCostCard } from "@/features/listings/detail-cards/move-in-cost-card";
import { PurchaseProgressTimeline } from "@/features/listings/detail-cards/purchase-progress-timeline";
import { ReportListingDialog } from "@/features/listings/detail-cards/report-listing-dialog";
import { TrueMonthlyCostCard } from "@/features/listings/detail-cards/true-monthly-cost-card";
import type { ListingDetail } from "@/features/listings/detail-cards/types";
import { useListingShare } from "@/features/listings/detail-cards/use-listing-share";
import { usePurchaseStages } from "@/features/listings/detail-cards/use-purchase-stages";
import { ListingMoreMenu } from "@/features/map-discovery/listing-more-menu";
import { ManualCopyPopover } from "@/features/map-discovery/manual-copy-popover";
import { PresenceBadge } from "@/features/presence/presence-badge";
import { LandlordTrustSignals } from "@/features/trust/components/landlord-trust-signals";
import { cn } from "@/lib/utils";

import { DecisionBar } from "./decision-bar";
import { staticMapUrl, stepPhoto } from "./feed-media";
import { summaryFacts, summaryPrice, type FeedSummary } from "./feed-summary";
import { PhotoStage } from "./photo-stage";
import type { SwipeDecision } from "./swipe-physics";
import type { DetailEntry } from "./use-listing-details";
import { useSwipeGesture } from "./use-swipe-gesture";

export type FeedCardHandle = { decide: (decision: SwipeDecision) => void };

/** Leaves room under the photo for the pinned action bar. */
const MEDIA_HEIGHT = "calc(100% - 4.75rem - env(safe-area-inset-bottom, 0px))";

type FeedCardProps = {
  summary: FeedSummary;
  detail: DetailEntry;
  onRetryDetail: () => void;
  /** Only the card on screen takes input; the one behind it is inert. */
  active: boolean;
  saved: boolean;
  canUndo: boolean;
  authenticated: boolean;
  reducedMotion: boolean;
  /** Called after the card has left the screen. */
  onDecision: (decision: SwipeDecision) => void;
  onUndo: () => void;
  onOpenOnMap: () => void;
  initialIntent?: "apply" | "message";
  mapApiKey?: string;
  ref?: Ref<FeedCardHandle>;
};

/**
 * One listing in the swipe feed: the photo fills the card, and scrolling up
 * reveals structured details with the actions pinned below (requirement 4).
 */
export function FeedCard({
  summary, detail, onRetryDetail, active, saved, canUndo, authenticated, reducedMotion,
  onDecision, onUndo, onOpenOnMap, initialIntent, mapApiKey, ref,
}: FeedCardProps) {
  const titleId = useId();
  const detailsId = useId();
  const scrollRef = useRef<HTMLElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [reportOpen, setReportOpen] = useState(false);
  const share = useListingShare({ id: summary.id, title: summary.title, address: detail.detail?.address ?? summary.area ?? "" });
  const price = summaryPrice(summary);

  const onTap = useCallback((xRatio: number) => {
    setPhotoIndex((index) => stepPhoto({ index, count: summary.imageUrls.length, xRatio }));
  }, [summary.imageUrls.length]);

  const getTarget = useCallback(() => scrollRef.current, []);
  const gesture = useSwipeGesture({ enabled: active && !scrolled, reducedMotion, onDecision, onTap, getTarget });
  useImperativeHandle(ref, () => ({ decide: gesture.flyOut }), [gesture.flyOut]);

  return (
    <article
      ref={scrollRef}
      aria-labelledby={titleId}
      aria-hidden={active ? undefined : true}
      inert={!active}
      data-slot="feed-card"
      data-listing-id={summary.id}
      onScroll={(event) => {
        const next = event.currentTarget.scrollTop > 4;
        setScrolled((current) => (current === next ? current : next));
      }}
      className="scroll-contained absolute inset-0 overflow-y-auto overscroll-contain bg-panel text-ink scrollbar-hide"
    >
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{share.shareStatus}</p>
      {share.manualCopyUrl ? <ManualCopyPopover url={share.manualCopyUrl} onClose={share.closeManualCopy} /> : null}

      <div
        {...gesture.bind}
        data-slot="feed-media-stage"
        className="relative min-h-[22rem] select-none overflow-hidden bg-media-surface text-media-foreground will-change-transform"
        style={{ ...gesture.bind.style, height: MEDIA_HEIGHT }}
      >
        <PhotoStage imageUrls={summary.imageUrls} title={summary.title} index={photoIndex} eager={active} />

        <span aria-hidden="true" className="pointer-events-none absolute left-5 top-12 z-10 -rotate-12 rounded-lg border-4 border-selection bg-media-surface/40 px-3 py-1 text-2xl font-black uppercase tracking-wide text-selection"
          style={{ opacity: "var(--swipe-save-opacity, 0)" }}>Save</span>
        <span aria-hidden="true" className="pointer-events-none absolute right-5 top-12 z-10 rotate-12 rounded-lg border-4 border-media-foreground bg-media-surface/40 px-3 py-1 text-2xl font-black uppercase tracking-wide text-media-foreground"
          style={{ opacity: "var(--swipe-pass-opacity, 0)" }}>Pass</span>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-media-surface via-media-surface/80 to-transparent px-4 pb-4 pt-20">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <h2 id={titleId} className="line-clamp-2 text-2xl font-bold leading-tight tracking-tight">{summary.title}</h2>
              <p className="mt-1 text-xl font-bold">
                {price.amount}
                {price.suffix ? <span className="ml-1 text-sm font-medium text-media-muted">{price.suffix}</span> : null}
              </p>
              <p className="mt-1 flex items-center gap-1.5 truncate text-sm text-media-muted">
                <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{summary.area ?? "Location to confirm"}</span>
              </p>
              <p className="mt-0.5 text-sm text-media-muted">{summaryFacts(summary)}</p>
            </div>
            <div className="pointer-events-auto">
              <ListingMoreMenu
                onShare={share.handleShare}
                onReport={() => setReportOpen(true)}
                sharing={share.isSharing}
                className="flex size-11 items-center justify-center rounded-full border border-media-foreground/25 bg-media-surface/60 text-media-foreground backdrop-blur-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>
          <DecisionBar
            className="pointer-events-auto mt-4"
            onPass={() => gesture.flyOut("pass")}
            onSave={() => gesture.flyOut("save")}
            onUndo={onUndo}
            saved={saved}
            canUndo={canUndo}
            disabled={!active}
          />
          <button
            type="button"
            aria-controls={detailsId}
            onClick={() => scrollRef.current?.scrollTo({ top: scrollRef.current.clientHeight * 0.6, behavior: reducedMotion ? "auto" : "smooth" })}
            className="pointer-events-auto mx-auto mt-2 flex min-h-11 items-center gap-1 rounded-full px-3 text-xs font-semibold text-media-muted hover:text-media-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronUp className="size-4" aria-hidden="true" />
            Details
          </button>
        </div>
      </div>

      <div id={detailsId} className="space-y-4 p-4" data-slot="feed-details">
        <FeedDetails summary={summary} detail={detail} onRetry={onRetryDetail} authenticated={authenticated} saved={saved} mapApiKey={mapApiKey} onOpenOnMap={onOpenOnMap} />
      </div>

      <div className="sticky bottom-0 z-20">
        {detail.status === "ready" ? (
          <ListingActionBar listing={detail.detail} authenticated={authenticated} initialIntent={active ? initialIntent : undefined} compact askPiko={false} />
        ) : (
          <div aria-hidden="true" className="grid grid-cols-2 gap-2 border-t border-border bg-panel p-3" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.75rem)" }}>
            <span className="h-11 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
            <span className="h-11 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
          </div>
        )}
      </div>

      <ReportListingDialog listingId={summary.id} open={reportOpen} onOpenChange={setReportOpen} />
    </article>
  );
}

function FeedDetails({ summary, detail, onRetry, authenticated, saved, mapApiKey, onOpenOnMap }: {
  summary: FeedSummary; detail: DetailEntry; onRetry: () => void; authenticated: boolean; saved: boolean; mapApiKey?: string; onOpenOnMap: () => void;
}) {
  if (detail.status === "loading") {
    return (
      <div role="status" aria-label="Loading listing details" className="space-y-3">
        {[0, 1, 2].map((row) => <span key={row} className="block h-24 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />)}
      </div>
    );
  }
  if (detail.status === "error" || detail.status === "missing") {
    // A missing listing is only on screen until the feed drops it.
    return (
      <div className="rounded-xl border border-status-warning-border bg-status-warning-surface p-4 text-sm text-status-warning-text">
        <p>Details for {summary.title} could not be loaded.</p>
        <Button variant="outline" className="mt-3 min-h-11" onClick={onRetry}>Try again</Button>
      </div>
    );
  }
  return <ReadyDetails listing={detail.detail} authenticated={authenticated} saved={saved} mapApiKey={mapApiKey} onOpenOnMap={onOpenOnMap} />;
}

function ReadyDetails({ listing, authenticated, saved, mapApiKey, onOpenOnMap }: {
  listing: ListingDetail; authenticated: boolean; saved: boolean; mapApiKey?: string; onOpenOnMap: () => void;
}) {
  const isSale = listing.listing_type === "sale";
  const purchase = usePurchaseStages({ listingId: listing.id, isSale, authenticated, favorited: saved });
  const mapUrl = staticMapUrl({ lat: listing.latitude, lng: listing.longitude, apiKey: mapApiKey, width: 400, height: 180 });

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {!isSale && listing.landlordPresence?.name ? <ListerIdentity presence={listing.landlordPresence} /> : null}
        <LandlordTrustSignals summary={listing.landlordTrust} />
        {listing.landlordPresence ? (
          <PresenceBadge
            badge={listing.landlordPresence.badge}
            responseSeconds={listing.landlordTrust?.predictedResponseSeconds ?? listing.landlordTrust?.medianFirstResponseSeconds}
            predicted={listing.landlordTrust?.predictedResponseSeconds !== undefined}
          />
        ) : null}
      </div>

      <ListingFactsGrid listing={listing} compact />

      {isSale ? (
        <>
          <BondCalculatorCard listing={listing} compact />
          <PurchaseProgressTimeline currentStage={purchase.current} completedStages={purchase.completed} compact />
        </>
      ) : (
        <>
          <MoveInCostCard listing={listing} />
          <TrueMonthlyCostCard listing={listing} compact />
        </>
      )}

      <section aria-labelledby={`${listing.id}-location`} className="overflow-hidden rounded-xl border border-border bg-surface-panel">
        {mapUrl ? (
          // A plain img: the static map is already sized for this slot, and the image loader is for listing photos.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mapUrl} alt="" width={400} height={180} loading="lazy" className="block h-[180px] w-full object-cover" />
        ) : null}
        <div className="flex items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <h2 id={`${listing.id}-location`} className="text-sm font-semibold text-ink">Location</h2>
            <p className="mt-1 truncate text-sm text-muted-foreground">{listing.address}</p>
          </div>
          <Button variant="outline" className={cn("min-h-11 shrink-0")} onClick={onOpenOnMap}>
            <MapPin className="size-4" aria-hidden="true" />
            Open on map
          </Button>
        </div>
      </section>

      <LeaseUtilitiesCard listing={listing} />
      <AmenitiesSection amenities={listing.metadata?.amenities} />
    </>
  );
}
