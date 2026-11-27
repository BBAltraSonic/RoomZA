"use client";

import { getImageProps } from "next/image";
import { useRouter } from "next/navigation";
import { useReducedMotion } from "motion/react";
import { Map as MapIcon, RotateCcw } from "lucide-react";
import { preload } from "react-dom";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { ListingDetail } from "@/features/listings/detail-cards/types";
import { useFavorites } from "@/features/map-discovery/hooks/use-favorites";
import type { ListingCardModel } from "@/features/map-discovery/lib/types";
import { authPathForRedirect } from "@/lib/redirects";
import { cn } from "@/lib/utils";

import { FeedCard, type FeedCardHandle } from "./feed-card";
import { createFeedState, feedPosition, feedReducer, upcomingIds } from "./feed-queue";
import { summaryFromDetail, toFeedSummary, type FeedSummary } from "./feed-summary";
import { addGuestSave, mergeGuestSaves, readGuestSaves, removeGuestSave } from "./guest-saves";
import { FEED_IMAGE_SIZES } from "./photo-stage";
import { readSessionPasses, writeSessionPasses } from "./session-passes";
import type { SwipeDecision } from "./swipe-physics";
import { useListingDetails } from "./use-listing-details";

export type FeedViewProps = {
  /** The current results, in the order the map and list show them. */
  listings: readonly ListingCardModel[];
  /** The listing the URL names: a pin or card tap, or a /listing/[id] link. */
  openListingId?: string | null;
  listingMode: "rent" | "buy";
  initialListing?: ListingDetail | null;
  initialIntent?: "apply" | "message";
  mapApiKey?: string;
  surface: "desktop" | "mobile";
  /** The quick filter chips, shared with the map view. */
  chips?: ReactNode;
  resultsLoading?: boolean;
  onCursorChange: (id: string | null) => void;
  onClose: () => void;
  onOpenOnMap: (id: string) => void;
  onClearFilters?: () => void;
};

/**
 * One listing at a time: ✕ passes for this session, ♡ saves, both move on, and
 * scrolling up opens the details (requirements 1–10).
 */
export function FeedView({
  listings, openListingId, listingMode, initialListing, initialIntent, mapApiKey, surface, chips,
  resultsLoading, onCursorChange, onClose, onOpenOnMap, onClearFilters,
}: FeedViewProps) {
  const router = useRouter();
  const reducedMotion = Boolean(useReducedMotion());
  const { isFavorite, toggleFavorite, authenticated } = useFavorites();

  // A listing opened from outside (pin, card or link) stays in the queue even when the results do not include it.
  const [pinnedId, setPinnedId] = useState(openListingId ?? null);
  const reportedRef = useRef(openListingId ?? null);
  const ids = useMemo(() => listings.map((listing) => listing.id), [listings]);
  const order = useMemo(() => (pinnedId && !ids.includes(pinnedId) ? [pinnedId, ...ids] : ids), [ids, pinnedId]);

  const [state, dispatch] = useReducer(feedReducer, undefined, () => createFeedState(order, { cursor: openListingId ?? undefined }));
  const cursor = state.cursor;
  const next = upcomingIds(state, 2);
  const details = useListingDetails({ ids: cursor ? [cursor, ...next.slice(0, 1)] : [], listingMode, seed: initialListing });

  useEffect(() => { dispatch({ type: "passes", ids: readSessionPasses() }); }, []);
  useEffect(() => { writeSessionPasses(state.passed); }, [state.passed]);
  useEffect(() => { dispatch({ type: "results", order }); }, [order]);

  useEffect(() => {
    if (!openListingId || openListingId === reportedRef.current) return;
    reportedRef.current = openListingId;
    setPinnedId(openListingId);
    dispatch({ type: "open", id: openListingId });
  }, [openListingId]);

  useEffect(() => {
    if (cursor === reportedRef.current) return;
    reportedRef.current = cursor;
    onCursorChange(cursor);
  }, [cursor, onCursorChange]);

  const summaries = useMemo(() => new Map(listings.map((listing) => [listing.id, toFeedSummary(listing)])), [listings]);
  const summaryFor = useCallback((id: string): FeedSummary => {
    const known = summaries.get(id);
    if (known) return known;
    const entry = details.get(id);
    if (entry.status === "ready") return summaryFromDetail(entry.detail);
    if (initialListing?.id === id) return summaryFromDetail(initialListing);
    return { id, title: "Loading listing", area: null, imageUrls: [], price: 0, listingType: "rent", bedrooms: 0, bathrooms: 0, propertyType: null };
  }, [details, initialListing, summaries]);

  // The photo two cards ahead starts loading now; the next card is already mounted.
  const preloadUrl = next[1] ? summaryFor(next[1]).imageUrls[0] : undefined;
  useEffect(() => {
    if (!preloadUrl) return;
    const { props } = getImageProps({ src: preloadUrl, alt: "", fill: true, sizes: FEED_IMAGE_SIZES });
    preload(props.src, { as: "image", imageSrcSet: props.srcSet, imageSizes: props.sizes, fetchPriority: "low" });
  }, [preloadUrl]);

  const saves = useFeedSaves({ authenticated: Boolean(authenticated), isFavorite, toggleFavorite, router });

  const decide = useCallback((id: string, decision: SwipeDecision) => {
    dispatch({ type: decision, id });
    if (decision === "save") void saves.save(id, summaryFor(id).listingType);
  }, [saves, summaryFor]);

  const undo = useCallback(() => {
    const last = state.history.at(-1);
    if (!last) return;
    dispatch({ type: "undo" });
    if (last.type === "save") void saves.unsave(last.id);
  }, [saves, state.history]);

  const cardRef = useRef<FeedCardHandle>(null);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
      if (document.querySelector('[role="dialog"], [role="menu"]')) return;
      if (event.key === "ArrowLeft") cardRef.current?.decide("pass");
      else if (event.key === "ArrowRight") cardRef.current?.decide("save");
      else if (event.key === "z" || event.key === "Z") undo();
      else if (event.key === "m" || event.key === "M" || (event.key === "Escape" && surface === "mobile")) onClose();
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, surface, undo]);

  const position = feedPosition(state);
  const current = cursor ? summaryFor(cursor) : null;

  return (
    <section aria-label="Listing feed" data-slot="swipe-feed" className="relative flex h-full min-h-0 flex-col bg-surface-results text-ink">
      <header className={cn("flex shrink-0 items-center gap-2 px-3 py-2", surface === "desktop" && "pr-28")}>
        <Button variant="outline" className="min-h-11 shrink-0 rounded-full" onClick={onClose} aria-keyshortcuts="m">
          <MapIcon className="size-4" aria-hidden="true" />
          Map
        </Button>
        <div className="min-w-0 flex-1 overflow-x-auto scrollbar-hide">{chips}</div>
        {position.total > 0 && cursor ? (
          <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">{position.index} / {position.total}</span>
        ) : null}
      </header>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        {cursor ? (
          [...next.slice(0, 1).reverse(), cursor].map((id) => (
            <FeedCard
              key={id}
              ref={id === cursor ? cardRef : undefined}
              summary={summaryFor(id)}
              detail={details.get(id)}
              onRetryDetail={() => details.retry(id)}
              active={id === cursor}
              saved={saves.isSaved(id)}
              canUndo={state.history.length > 0}
              authenticated={Boolean(authenticated)}
              reducedMotion={reducedMotion}
              onDecision={(decision) => decide(id, decision)}
              onUndo={undo}
              onOpenOnMap={() => onOpenOnMap(id)}
              initialIntent={id === initialListing?.id ? initialIntent : undefined}
              mapApiKey={mapApiKey}
            />
          ))
        ) : resultsLoading && order.length === 0 ? (
          <div role="status" aria-label="Loading listings" className="absolute inset-3 animate-pulse rounded-2xl bg-muted motion-reduce:animate-none" />
        ) : (
          <FeedEnd
            empty={order.length === 0}
            hasPassed={state.passed.size > 0}
            onRestorePassed={() => dispatch({ type: "restorePassed" })}
            onClearFilters={onClearFilters}
            onClose={onClose}
          />
        )}
      </div>

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {current ? `${current.title}, ${position.index} of ${position.total}` : order.length === 0 ? "No listings match" : "You have seen every listing here"}
      </p>
    </section>
  );
}

function FeedEnd({ empty, hasPassed, onRestorePassed, onClearFilters, onClose }: {
  empty: boolean; hasPassed: boolean; onRestorePassed: () => void; onClearFilters?: () => void; onClose: () => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <h2 className="text-lg font-semibold text-ink">{empty ? "No listings match here" : "You've seen every listing here"}</h2>
      <p className="max-w-[32ch] text-sm text-muted-foreground">Move the map to a new area or loosen your filters to see more.</p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        {hasPassed ? (
          <Button variant="outline" className="min-h-11" onClick={onRestorePassed}>
            <RotateCcw className="size-4" aria-hidden="true" />
            Show passed listings
          </Button>
        ) : null}
        {onClearFilters ? <Button variant="outline" className="min-h-11" onClick={onClearFilters}>Clear filters</Button> : null}
        <Button className="min-h-11" onClick={onClose}>Back to map</Button>
      </div>
    </div>
  );
}

function isTyping(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/**
 * ♡ for both signed-in visitors (favourites API) and guests (this device, merged
 * after sign-in). Saving never redirects to sign-in (requirement 3.7).
 */
function useFeedSaves({ authenticated, isFavorite, toggleFavorite, router }: {
  authenticated: boolean;
  isFavorite: (id: string) => boolean;
  toggleFavorite: (id: string, options?: { listingType?: "rent" | "sale" }) => Promise<boolean>;
  router: ReturnType<typeof useRouter>;
}) {
  const [local, setLocal] = useState<ReadonlySet<string>>(new Set());
  const addedRef = useRef(new Set<string>());
  const promptedRef = useRef(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate browser-only saves after the server render
    setLocal(new Set(readGuestSaves().map((save) => save.id)));
  }, []);

  useEffect(() => {
    if (!authenticated || readGuestSaves().length === 0) return;
    let cancelled = false;
    void mergeGuestSaves(async ({ id, listingType }) => {
      const response = await fetch("/api/favorites", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ listingId: id, listingType }),
      });
      return response.ok;
    }).then(({ merged }) => {
      if (cancelled || merged.length === 0) return;
      toast.success(merged.length === 1 ? "Your saved listing is on your account" : `${merged.length} saved listings are on your account`);
    });
    return () => { cancelled = true; };
  }, [authenticated]);

  const keepLocally = useCallback((id: string, listingType: "rent" | "sale") => {
    addGuestSave({ id, listingType });
    setLocal((current) => new Set(current).add(id));
  }, []);

  const save = useCallback(async (id: string, listingType: "rent" | "sale") => {
    if (authenticated) {
      if (isFavorite(id)) return;
      const ok = await toggleFavorite(id, { listingType });
      if (ok) addedRef.current.add(id);
      // A failed save stays on this device and is posted again after the next sign-in.
      else keepLocally(id, listingType);
      return;
    }
    keepLocally(id, listingType);
    if (promptedRef.current) return;
    promptedRef.current = true;
    toast("Saved on this device", {
      description: "Sign in to keep your saves on your account.",
      action: { label: "Sign in", onClick: () => router.push(authPathForRedirect(`${window.location.pathname}${window.location.search}`)) },
    });
  }, [authenticated, isFavorite, keepLocally, router, toggleFavorite]);

  const unsave = useCallback(async (id: string) => {
    if (local.has(id)) {
      removeGuestSave(id);
      setLocal((current) => {
        const nextSet = new Set(current);
        nextSet.delete(id);
        return nextSet;
      });
      return;
    }
    if (authenticated && addedRef.current.has(id) && isFavorite(id)) {
      addedRef.current.delete(id);
      await toggleFavorite(id);
    }
  }, [authenticated, isFavorite, local, toggleFavorite]);

  const isSaved = useCallback((id: string) => isFavorite(id) || local.has(id), [isFavorite, local]);
  return useMemo(() => ({ save, unsave, isSaved }), [isSaved, save, unsave]);
}
