"use client";

// MobileBottomSheet — the premium, three-snap draggable sheet for the
// Mobile_Map_Discovery feature.
//
// Behaviour (see the "ideal bottom sheet" spec in design.md):
//  1. Three snap positions: collapsed (peek) / half / expanded (full).
//  2. Magnetic release — the sheet snaps to the nearest position, projected by
//     fling velocity, never stopping mid-flight.
//  3. Scroll + drag cooperate: when not fully expanded a vertical drag grows
//     the sheet; only once expanded does the inner content scroll. Dragging
//     down while the content is at the top collapses the sheet instead of
//     rubber-banding.
//  4. Velocity matters — a fast flick carries further (iOS-style projection).
//  5. Background (map) stays interactive at collapsed/half; a scrim blocks it
//     only when fully expanded.
//  6/7. Rounded top corners + a grab handle.
//  8. Lifts above the on-screen keyboard via visualViewport.
//  10. Spring-like easing, ~320ms.
//
// State (the active snap) is owned by the parent so it can be persisted across
// navigation (Req: state persistence).

import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import {
  expandedHeight,
  rubberBandSheetHeight,
  resolveSheetRelease,
  snapToHeight,
  stepSnap,
  type SheetSnap,
} from "../lib/sheet";

/** Movement (px) a pointer must travel before a gesture commits to a mode. */
const GESTURE_THRESHOLD = 6;

/** Spring-like settle easing + duration for snap animations. */
const SNAP_TRANSITION = "transform var(--motion-sheet) var(--ease-out-quint)";
const EXPANDED_HEIGHT = "min(92dvh, calc(100dvh - 120px))";

type GestureMode = "pending" | "sheet" | "scroll";

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  startHeight: number;
  lastY: number;
  lastT: number;
  velocity: number;
  mode: GestureMode;
};

export type MobileBottomSheetProps = {
  /** Active snap position (owned by the parent for persistence). */
  snap: SheetSnap;
  /** Called when the sheet settles on a new snap position. */
  onSnapChange: (snap: SheetSnap) => void;
  /**
   * Non-scrolling header rendered directly under the handle (e.g. title +
   * filter pills). Part of the drag surface.
   */
  header?: React.ReactNode;
  /** Scrollable body content. */
  children: React.ReactNode;
  onContentScroll?: (event: React.UIEvent<HTMLDivElement>) => void;
  onVisibleHeightChange?: (height: number) => void;
  className?: string;
  "aria-label"?: string;
};

/** Read the current usable viewport height (excludes the on-screen keyboard). */
function readViewport(): { vh: number; keyboardInset: number } {
  if (typeof window === "undefined") return { vh: 800, keyboardInset: 0 };
  const vv = window.visualViewport;
  const innerH = window.innerHeight || document.documentElement.clientHeight;
  const vh = vv?.height ?? innerH;
  const keyboardInset = vv ? Math.max(0, innerH - vv.height - vv.offsetTop) : 0;
  return { vh, keyboardInset };
}

/** GPU-only resting offset for a snap position. SSR-safe (dvh-based). */
function restTransform(snap: SheetSnap): string {
  switch (snap) {
    case "expanded":
      return "translate3d(0, 0, 0)";
    case "half":
      return `translate3d(0, calc(${EXPANDED_HEIGHT} - 56dvh), 0)`;
    case "collapsed":
    default:
      return `translate3d(0, calc(${EXPANDED_HEIGHT} - max(18dvh, 9rem)), 0)`;
  }
}

export function MobileBottomSheet({
  snap,
  onSnapChange,
  header,
  children,
  onContentScroll,
  onVisibleHeightChange,
  className,
  "aria-label": ariaLabel,
}: MobileBottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const suppressHandleClickRef = useRef(false);

  // Live translate offset while dragging; `null` at rest (CSS dvh + transition).
  const frameRef = useRef<number | null>(null);
  const pendingOffsetRef = useRef<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [keyboardInset, setKeyboardInset] = useState(0);

  const scheduleDragTransform = useCallback((offset: number) => {
    pendingOffsetRef.current = offset;
    if (frameRef.current !== null) return;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      const pendingOffset = pendingOffsetRef.current;
      if (pendingOffset === null || !sheetRef.current) return;
      sheetRef.current.style.transform = `translate3d(0, ${pendingOffset}px, 0)`;
    });
  }, []);

  useEffect(() => () => {
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
  }, []);

  // Keep the sheet above the on-screen keyboard.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => setKeyboardInset(readViewport().keyboardInset);
    vv.addEventListener("resize", onResize);
    vv.addEventListener("scroll", onResize);
    onResize();
    return () => {
      vv.removeEventListener("resize", onResize);
      vv.removeEventListener("scroll", onResize);
    };
  }, []);

  useEffect(() => {
    if (!onVisibleHeightChange) return;
    const updateHeight = () => onVisibleHeightChange(snapToHeight(snap, readViewport().vh));
    const observer = typeof ResizeObserver !== "undefined" && sheetRef.current
      ? new ResizeObserver(updateHeight)
      : null;
    if (sheetRef.current) observer?.observe(sheetRef.current);
    window.visualViewport?.addEventListener("resize", updateHeight);
    updateHeight();
    return () => {
      observer?.disconnect();
      window.visualViewport?.removeEventListener("resize", updateHeight);
    };
  }, [onVisibleHeightChange, snap]);

  const finishDrag = useCallback(
    (pointerId: number, clientY: number) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== pointerId) return;

      if (drag.mode === "sheet") {
        const { vh } = readViewport();
        const endHeight = drag.startHeight + (drag.startY - clientY);
        onSnapChange(resolveSheetRelease(endHeight, drag.velocity, vh));
      }
      dragRef.current = null;
      pendingOffsetRef.current = null;
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      sheetRef.current?.style.removeProperty("transform");
      setIsDragging(false);
    },
    [onSnapChange],
  );

  const endDrag = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => finishDrag(event.pointerId, event.clientY),
    [finishDrag],
  );

  const handleLostPointerCapture = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      finishDrag(event.pointerId, drag.lastY);
    },
    [finishDrag],
  );

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    // Ignore secondary mouse buttons; allow touch/pen/primary mouse.
    if (event.button > 0) return;
    const { vh } = readViewport();
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startHeight: snapToHeight(snap, vh),
      lastY: event.clientY,
      lastT: event.timeStamp,
      velocity: 0,
      mode: "pending",
    };
  }, [snap]);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const dy = drag.startY - event.clientY; // positive = dragged up (grow)
    const dx = event.clientX - drag.startX;

    if (drag.mode === "pending") {
      if (Math.abs(dy) < GESTURE_THRESHOLD && Math.abs(dx) < GESTURE_THRESHOLD) return;
      // Predominantly horizontal → leave it to nested carousels / pills.
      if (Math.abs(dx) > Math.abs(dy)) {
        drag.mode = "scroll";
        return;
      }

      const atExpanded = snap === "expanded";
      const atTop = (scrollRef.current?.scrollTop ?? 0) <= 0;
      const draggingDown = dy < 0;
      // Not fully expanded → the sheet always moves. Fully expanded → the sheet
      // only moves when pulling down from the top (otherwise content scrolls).
      const takeSheet = !atExpanded || (draggingDown && atTop);

      if (!takeSheet) {
        drag.mode = "scroll";
        return;
      }

      // Commit to a sheet drag; re-anchor the origin to avoid a jump.
      drag.mode = "sheet";
      drag.startY = event.clientY;
      const { vh } = readViewport();
      drag.startHeight = snapToHeight(snap, vh);
      drag.lastY = event.clientY;
      drag.lastT = event.timeStamp;
      suppressHandleClickRef.current = true;
      setIsDragging(true);
      scheduleDragTransform(expandedHeight(vh) - drag.startHeight);
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        /* capture is best-effort */
      }
      return;
    }

    if (drag.mode !== "sheet") return;

    const { vh } = readViewport();
    const next = rubberBandSheetHeight(drag.startHeight + (drag.startY - event.clientY), vh);

    const dt = event.timeStamp - drag.lastT;
    if (dt > 0) {
      drag.velocity = (drag.lastY - event.clientY) / dt;
      drag.lastY = event.clientY;
      drag.lastT = event.timeStamp;
    }
    scheduleDragTransform(expandedHeight(vh) - next);
  }, [scheduleDragTransform, snap]);

  const toggleFromHandle = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === "ArrowUp") {
        event.preventDefault();
        onSnapChange(stepSnap(snap, "up"));
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        onSnapChange(stepSnap(snap, "down"));
      }
    },
    [onSnapChange, snap],
  );

  const handleHandleClick = useCallback(() => {
    if (suppressHandleClickRef.current) {
      suppressHandleClickRef.current = false;
      return;
    }
    onSnapChange(snap === "expanded" ? "collapsed" : stepSnap(snap, "up"));
  }, [onSnapChange, snap]);

  const isExpanded = snap === "expanded";
  const contentScrollable = isExpanded && !isDragging;

  return (
    <>
      {/* Scrim — blocks map interaction only when fully expanded (Req 5). */}
      <div
        aria-hidden="true"
        onClick={() => onSnapChange("half")}
        className={cn(
          "fixed inset-0 z-[var(--z-chrome)] bg-ink/10 transition-opacity duration-300",
          isExpanded ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      <div
        ref={sheetRef}
        data-snap={snap}
        data-motion-sheet="spring-medium"
        data-dragging={isDragging ? "" : undefined}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={handleLostPointerCapture}
        className={cn(
          "fixed inset-x-0 bottom-0 z-[calc(var(--z-chrome)+1)] mx-auto flex w-full max-w-[520px] flex-col overflow-hidden rounded-t-[24px] border border-b-0 border-border/40 bg-warm-surface shadow-[var(--elevation-3)]",
          className,
        )}
        style={{
          height: EXPANDED_HEIGHT,
          bottom: keyboardInset > 0 ? `${keyboardInset}px` : undefined,
          transform: restTransform(snap),
          transition: isDragging ? "none" : SNAP_TRANSITION,
          willChange: isDragging ? "transform" : undefined,
        }}
      >
        {/* Grab handle (Req 7) — the always-draggable affordance. */}
        <button
          type="button"
          aria-label={ariaLabel ?? "Resize listings sheet"}
          aria-expanded={isExpanded}
          onKeyDown={toggleFromHandle}
          onClick={handleHandleClick}
          className="flex min-h-11 w-full flex-none touch-none cursor-grab items-center justify-center pt-3 pb-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring active:cursor-grabbing"
        >
          <span className="h-1.5 w-10 rounded-full bg-border" aria-hidden="true" />
        </button>

        <div className="flex flex-none justify-end px-4 pb-1">
          <button
            type="button"
            onClick={() => onSnapChange(snap === "expanded" ? "collapsed" : stepSnap(snap, "up"))}
            className="min-h-11 rounded-full px-3 text-xs font-semibold text-forest hover:bg-forest/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {snap === "collapsed" ? "Show homes" : snap === "half" ? "Expand results" : "Show map"}
          </button>
          <span className="sr-only" aria-live="polite">Results sheet {snap}</span>
        </div>

        {/* Non-scrolling header (part of the drag surface). `touch-pan-x`
            keeps horizontally scrollable filter pills swipeable while vertical
            drags still resize the sheet. */}
        {header ? <div className="flex-none touch-pan-x">{header}</div> : null}

        {/* Scrollable body — scrolls only when fully expanded. */}
        <div
          ref={scrollRef}
          onScroll={onContentScroll}
          className={cn(
            "scroll-contained min-h-0 flex-1 pb-[max(env(safe-area-inset-bottom),0.5rem)]",
            contentScrollable ? "overflow-y-auto" : "overflow-y-hidden",
          )}
          // Horizontal panning (carousels) stays native at every snap. Vertical
          // panning is native only when fully expanded (content scroll); at
          // collapsed/half the vertical axis is reserved for the sheet drag.
          style={{ touchAction: contentScrollable ? "pan-x pan-y" : "pan-x" }}
        >
          {children}
        </div>
      </div>
    </>
  );
}
