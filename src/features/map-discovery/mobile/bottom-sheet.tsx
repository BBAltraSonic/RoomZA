"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import {
  clampSheetHeight,
  snapSheetHeight,
  snapToHeight,
  type SheetSnap,
} from "../lib/sheet";
import { SheetHeader } from "./sheet-header";

type BottomSheetProps = {
  /** Sheet content rendered in the scrollable region (typically the Listing_Carousel + Sort_Label). */
  children: React.ReactNode;
  /**
   * Invoked when the See_All_Link is activated. The parent handles routing /
   * full-list presentation; this component additionally expands itself to the
   * max ("expanded") snap (Req 4.9).
   */
  onSeeAll: () => void;
  /** Sheet_Title text forwarded to SheetHeader; defaults to "Nearby Listings". */
  title?: string;
};

/**
 * Approximate minimum content height (px) that guarantees the Sheet_Header plus
 * at least one Listing_Card row stay visible at the collapsed height (Req 4.8).
 *
 * Design note: rather than measuring header + one card row at runtime (which
 * couples this presentational component to its children's intrinsic sizes), we
 * use a fixed approximation. `effectiveMin = max(0.25 * vh, MIN_CONTENT_PX)` is
 * applied to the lower bound after the pure `clampSheetHeight` clamp, capped at
 * the expanded bound so short viewports never produce a min above the max.
 */
const MIN_CONTENT_PX = 460;

/** Read the current visual viewport height, falling back to `innerHeight`. */
function getViewportHeight(): number {
  if (typeof window === "undefined") return 0;
  return window.visualViewport?.height ?? window.innerHeight;
}

/**
 * Clamp a candidate height using the pure 25%/90% clamp, then raise the lower
 * bound to `effectiveMin = max(0.25 * vh, MIN_CONTENT_PX)` (capped at the
 * expanded bound) so the header + one card row stay visible (Req 4.6, 4.8).
 */
function clampWithEffectiveMin(candidate: number, vh: number): number {
  const expandedBound = snapToHeight("expanded", vh);
  const effectiveMin = Math.min(
    Math.max(snapToHeight("collapsed", vh), MIN_CONTENT_PX),
    expandedBound,
  );
  const raw = clampSheetHeight(candidate, vh);
  return Math.min(Math.max(raw, effectiveMin), expandedBound);
}

/** Resolve a snap state to its concrete height, honoring the effective minimum. */
function resolveSnapHeight(snap: SheetSnap, vh: number): number {
  const expandedBound = snapToHeight("expanded", vh);
  if (snap === "expanded") return expandedBound;
  return Math.min(Math.max(snapToHeight("collapsed", vh), MIN_CONTENT_PX), expandedBound);
}

/**
 * BottomSheet — draggable panel overlaying the lower portion of the map for the
 * Mobile_Map_Discovery feature.
 *
 * Renders a drag handle (grabber) above the {@link SheetHeader}, then `children`
 * in a scrollable region. Dragging tracks the pointer via `clampSheetHeight`
 * (with `transition-none`); on release it snaps to the nearer 25%/90% bound via
 * `snapSheetHeight` and animates with a 300ms height transition. A `didDrag`
 * flag lets a tap on the handle toggle collapsed/expanded.
 *
 * Anchored fixed at the bottom above the Bottom_Navigation_Bar
 * (`var(--mobile-bottom-nav-h)`).
 *
 * Requirements: 4.1, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 10.4
 */
export function BottomSheet({ children, onSeeAll, title }: BottomSheetProps) {
  const [height, setHeight] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [snap, setSnap] = useState<SheetSnap>("collapsed");

  // Keep the latest snap in a ref so the resize listener avoids stale closures.
  const snapRef = useRef<SheetSnap>(snap);
  useEffect(() => {
    snapRef.current = snap;
  }, [snap]);

  const dragRef = useRef({ startY: 0, startHeight: 0, didDrag: false });

  // Initialize height on mount and re-resolve to the current snap on resize.
  useEffect(() => {
    const vh = getViewportHeight();
    setHeight(Math.round(resolveSnapHeight(snapRef.current, vh)));

    const onResize = () => {
      const v = getViewportHeight();
      setHeight(Math.round(resolveSnapHeight(snapRef.current, v)));
    };

    window.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("resize", onResize);
    };
  }, []);

  const handleToggle = () => {
    // A drag that moved past the threshold should not also toggle on release.
    if (dragRef.current.didDrag) {
      dragRef.current.didDrag = false;
      return;
    }
    const vh = getViewportHeight();
    const nextSnap: SheetSnap = snap === "expanded" ? "collapsed" : "expanded";
    setSnap(nextSnap);
    setHeight(Math.round(resolveSnapHeight(nextSnap, vh)));
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();

    const vh = getViewportHeight();
    const startHeight = height ?? resolveSnapHeight(snap, vh);
    let nextHeight = startHeight;

    dragRef.current = { startY: event.clientY, startHeight, didDrag: false };
    setIsDragging(true);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const delta = dragRef.current.startY - moveEvent.clientY;
      if (Math.abs(delta) > 6) {
        dragRef.current.didDrag = true;
      }
      nextHeight = Math.round(
        clampWithEffectiveMin(dragRef.current.startHeight + delta, vh),
      );
      setHeight(nextHeight);
    };

    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);

      setIsDragging(false);

      const nextSnap = snapSheetHeight(nextHeight, vh);
      setSnap(nextSnap);
      setHeight(Math.round(resolveSnapHeight(nextSnap, vh)));
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
  };

  // See_All expands the sheet to its max snap in addition to the parent's
  // routing/expansion handling (Req 4.9).
  const handleSeeAll = () => {
    const vh = getViewportHeight();
    setSnap("expanded");
    setHeight(Math.round(resolveSnapHeight("expanded", vh)));
    onSeeAll();
  };

  return (
    <section
      aria-label="Nearby listings"
      className={cn(
        "pointer-events-auto fixed inset-x-0 z-[var(--z-controls)] mx-auto flex w-full max-w-[440px] flex-col overflow-hidden rounded-t-[32px] bg-panel shadow-[0_-4px_24px_rgba(0,0,0,0.06)] ease-[var(--ease-out-quart)]",
        isDragging ? "transition-none" : "transition-[height] duration-300",
      )}
      style={{
        bottom: "0",
        height: height != null ? `${height}px` : undefined,
        paddingBottom: "max(env(safe-area-inset-bottom), 5.5rem)", // account for floating nav bar
      }}
    >
      {/* Drag handle (grabber) */}
      <button
        type="button"
        onClick={handleToggle}
        onPointerDown={handlePointerDown}
        className={cn(
          "flex w-full shrink-0 touch-none select-none items-center justify-center px-4 pb-1 pt-3",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
        aria-label={snap === "expanded" ? "Collapse nearby listings" : "Expand nearby listings"}
      >
        <span className="h-1.5 w-12 rounded-full bg-muted-foreground/20" />
      </button>

      {/* Sheet_Header */}
      <div className="shrink-0 px-5 pb-3 pt-1">
        <SheetHeader onSeeAll={handleSeeAll} title={title} />
      </div>

      {/* Scrollable content region */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto scrollbar-hide px-5 pb-5">
        {children}
      </div>
    </section>
  );
}
