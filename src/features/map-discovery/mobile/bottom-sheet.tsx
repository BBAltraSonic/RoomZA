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
  clampSheetHeight,
  resolveSheetRelease,
  stepSnap,
  type SheetSnap,
} from "../lib/sheet";

/** Movement (px) a pointer must travel before a gesture commits to a mode. */
const GESTURE_THRESHOLD = 6;

/** Spring-like settle easing + duration for snap animations. */
const SNAP_TRANSITION = "height 320ms cubic-bezier(0.32, 0.72, 0, 1), transform 320ms cubic-bezier(0.32, 0.72, 0, 1)";

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

/** CSS height for a resting (non-dragging) snap position. SSR-safe (dvh-based). */
function restHeight(snap: SheetSnap): string {
  switch (snap) {
    case "expanded":
      return "min(92dvh, calc(100dvh - 120px))";
    case "half":
      return "60dvh";
    case "collapsed":
    default:
      return "max(28dvh, 9rem)";
  }
}

export function MobileBottomSheet({
  snap,
  onSnapChange,
  header,
  children,
  className,
  "aria-label": ariaLabel,
}: MobileBottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);

  // Live pixel height while dragging; `null` at rest (CSS dvh + transition).
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [keyboardInset, setKeyboardInset] = useState(0);

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

  const endDrag = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;

      if (drag.mode === "sheet") {
        const { vh } = readViewport();
        const endHeight = drag.startHeight + (drag.startY - event.clientY);
        onSnapChange(resolveSheetRelease(endHeight, drag.velocity, vh));
      }
      dragRef.current = null;
      setDragHeight(null);
      setIsDragging(false);
    },
    [onSnapChange],
  );

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    // Ignore secondary mouse buttons; allow touch/pen/primary mouse.
    if (event.button > 0) return;
    const measured = sheetRef.current?.getBoundingClientRect().height ?? 0;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startHeight: measured,
      lastY: event.clientY,
      lastT: event.timeStamp,
      velocity: 0,
      mode: "pending",
    };
  }, []);

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
      drag.startHeight = sheetRef.current?.getBoundingClientRect().height ?? drag.startHeight;
      drag.lastY = event.clientY;
      drag.lastT = event.timeStamp;
      setIsDragging(true);
      setDragHeight(drag.startHeight);
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        /* capture is best-effort */
      }
      return;
    }

    if (drag.mode !== "sheet") return;

    const { vh } = readViewport();
    const next = clampSheetHeight(drag.startHeight + (drag.startY - event.clientY), vh);

    const dt = event.timeStamp - drag.lastT;
    if (dt > 0) {
      drag.velocity = (drag.lastY - event.clientY) / dt;
      drag.lastY = event.clientY;
      drag.lastT = event.timeStamp;
    }
    setDragHeight(next);
  }, [snap]);

  const toggleFromHandle = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onSnapChange(snap === "expanded" ? "collapsed" : stepSnap(snap, "up"));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        onSnapChange(stepSnap(snap, "up"));
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        onSnapChange(stepSnap(snap, "down"));
      }
    },
    [onSnapChange, snap],
  );

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
        data-dragging={isDragging ? "" : undefined}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className={cn(
          "fixed inset-x-0 bottom-0 z-[calc(var(--z-chrome)+1)] mx-auto flex w-full max-w-[520px] flex-col overflow-hidden rounded-t-[24px] border border-b-0 border-border/40 bg-warm-surface shadow-[var(--elevation-3)]",
          className,
        )}
        style={{
          height: dragHeight !== null ? `${dragHeight}px` : restHeight(snap),
          transform: keyboardInset > 0 ? `translateY(-${keyboardInset}px)` : undefined,
          transition: isDragging ? "none" : SNAP_TRANSITION,
          willChange: "height",
        }}
      >
        {/* Grab handle (Req 7) — the always-draggable affordance. */}
        <div
          role="button"
          tabIndex={0}
          aria-label={ariaLabel ?? "Resize listings sheet"}
          aria-expanded={isExpanded}
          onKeyDown={toggleFromHandle}
          className="flex min-h-9 flex-none touch-none cursor-grab items-center justify-center pt-3 pb-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
        >
          <span className="h-1.5 w-10 rounded-full bg-border" aria-hidden="true" />
        </div>

        {/* Non-scrolling header (part of the drag surface). `touch-pan-x`
            keeps horizontally scrollable filter pills swipeable while vertical
            drags still resize the sheet. */}
        {header ? <div className="flex-none touch-pan-x">{header}</div> : null}

        {/* Scrollable body — scrolls only when fully expanded. */}
        <div
          ref={scrollRef}
          className={cn(
            "min-h-0 flex-1 overscroll-contain pb-[max(env(safe-area-inset-bottom),0.5rem)]",
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
