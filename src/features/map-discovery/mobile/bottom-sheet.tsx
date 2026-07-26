"use client";

// MobileBottomSheet — an intent-led Peek / Browse / Full List surface.
//
// Behaviour (see the "ideal bottom sheet" spec in design.md):
//  1. Three purposeful modes: Peek / Browse / Full List.
//  2. Magnetic release — the sheet snaps to the nearest position, projected by
//     fling velocity, never stopping mid-flight.
//  3. Browse and Full List both scroll. Reaching the end of Browse naturally
//     promotes to Full List, while a top-edge pull can still lower the sheet.
//  4. Velocity matters — a fast flick carries further (iOS-style projection).
//  5. Background (map) stays interactive in Peek/Browse; Full List blocks it.
//  6/7. Rounded top corners + a grab handle.
//  8. Lifts above the on-screen keyboard via visualViewport.
//  10. Spring-sampled settling with a restrained 2px-equivalent overshoot.
//
// State (the active snap) is owned by the parent so it can be persisted across
// navigation (Req: state persistence).

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { animate } from "motion/react";

import { MOTION_SPRING } from "@/lib/motion/tokens";
import { cn } from "@/lib/utils";

import {
  fullHeight,
  peekHeight,
  rubberBandSheetHeight,
  resolveSheetRelease,
  snapToHeight,
  stepSnap,
  type SheetSnap,
} from "../lib/sheet";
import { SHEET_BROWSE_RATIO } from "../lib/constants";

/** Movement (px) a pointer must travel before a gesture commits to a mode. */
const GESTURE_THRESHOLD = 6;

const FULL_HEIGHT = "min(95dvh, calc(100dvh - 48px))";
const BROWSE_HEIGHT = `${SHEET_BROWSE_RATIO * 100}dvh`;
const BROWSE_AUTO_EXPAND_THRESHOLD = 48;

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
  fromHandle: boolean;
  allowPullToSheet: boolean;
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
  /** Lightweight map-first summary shown only in Peek. */
  peek?: React.ReactNode;
  /** Current result count, used by the intent pill. */
  resultCount?: number;
  /** Scrollable body content. */
  children: React.ReactNode;
  onContentScroll?: (event: React.UIEvent<HTMLDivElement>) => void;
  onContentScrollPositionChange?: (scrollTop: number) => void;
  getInitialScrollTop?: () => number;
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
    case "full":
      return "translate3d(0, 0, 0)";
    case "browse":
      return `translate3d(0, calc(${FULL_HEIGHT} - ${BROWSE_HEIGHT}), 0)`;
    case "peek":
    default:
      return `translate3d(0, calc(${FULL_HEIGHT} - max(18dvh, 9rem)), 0)`;
  }
}

export function MobileBottomSheet({
  snap,
  onSnapChange,
  header,
  peek,
  resultCount,
  children,
  onContentScroll,
  onContentScrollPositionChange,
  getInitialScrollTop,
  onVisibleHeightChange,
  className,
  "aria-label": ariaLabel,
}: MobileBottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const scrimRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const suppressHandleClickRef = useRef(false);

  // Live translate offset while dragging; `null` at rest (CSS dvh + transition).
  const frameRef = useRef<number | null>(null);
  const settleControlsRef = useRef<{ stop: () => void } | null>(null);
  const currentOffsetRef = useRef<number | null>(null);
  const pendingOffsetRef = useRef<number | null>(null);
  const pendingHeightRef = useRef<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hasDragged, setHasDragged] = useState(false);
  const [keyboardInset, setKeyboardInset] = useState(0);

  const scheduleDragTransform = useCallback((offset: number, visibleHeight: number) => {
    pendingOffsetRef.current = offset;
    pendingHeightRef.current = visibleHeight;
    if (frameRef.current !== null) return;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      const pendingOffset = pendingOffsetRef.current;
      const pendingHeight = pendingHeightRef.current;
      if (pendingOffset === null || pendingHeight === null || !sheetRef.current) return;
      sheetRef.current.style.transform = `translate3d(0, ${pendingOffset}px, 0)`;
      currentOffsetRef.current = pendingOffset;
      const { vh } = readViewport();
      const progress = Math.min(1, Math.max(0, (pendingHeight - peekHeight(vh)) / Math.max(1, fullHeight(vh) - peekHeight(vh))));
      sheetRef.current.style.boxShadow = `0 -18px 48px rgba(18, 35, 27, ${0.08 + progress * 0.1})`;
      if (scrimRef.current) {
        scrimRef.current.style.opacity = `${Math.max(0, (progress - 0.55) / 0.45) * 0.12}`;
        scrimRef.current.style.backdropFilter = `blur(${Math.max(0, progress - 0.55) * 2}px)`;
      }
      onVisibleHeightChange?.(pendingHeight);
    });
  }, [onVisibleHeightChange]);

  useEffect(() => () => {
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    settleControlsRef.current?.stop();
  }, []);

  useLayoutEffect(() => {
    const node = sheetRef.current;
    if (!node || isDragging) return;
    const { vh } = readViewport();
    const targetOffset = fullHeight(vh) - snapToHeight(snap, vh);
    const fromOffset = currentOffsetRef.current;
    settleControlsRef.current?.stop();

    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (fromOffset === null || reducedMotion) {
      currentOffsetRef.current = targetOffset;
      node.style.transform = `translate3d(0, ${targetOffset}px, 0)`;
      return;
    }

    settleControlsRef.current = animate(fromOffset, targetOffset, {
      ...MOTION_SPRING.medium,
      onUpdate: (value) => {
        currentOffsetRef.current = value;
        node.style.transform = `translate3d(0, ${value}px, 0)`;
      },
      onComplete: () => {
        currentOffsetRef.current = targetOffset;
        node.style.transform = `translate3d(0, ${targetOffset}px, 0)`;
      },
    });

    return () => settleControlsRef.current?.stop();
  }, [isDragging, keyboardInset, snap]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = getInitialScrollTop?.() ?? 0;
  }, [getInitialScrollTop, snap]);

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
      pendingHeightRef.current = null;
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      sheetRef.current?.style.removeProperty("box-shadow");
      scrimRef.current?.style.removeProperty("opacity");
      scrimRef.current?.style.removeProperty("backdrop-filter");
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
    const target = event.target instanceof Element ? event.target : null;
    const fromHandle = Boolean(target?.closest("[data-sheet-drag-handle]"));
    const allowPullToSheet = !target?.closest("button, a, input, select, textarea, [role='button']");
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startHeight: snapToHeight(snap, vh),
      lastY: event.clientY,
      lastT: event.timeStamp,
      velocity: 0,
      mode: "pending",
      fromHandle,
      allowPullToSheet,
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

      const atTop = (scrollRef.current?.scrollTop ?? 0) <= 0;
      const draggingDown = dy < 0;
      // Peek owns vertical movement. In Browse/Full, content owns it unless the
      // handle is used or the user intentionally pulls down from the list top.
      const takeSheet = snap === "peek" || drag.fromHandle || (drag.allowPullToSheet && draggingDown && atTop);

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
      settleControlsRef.current?.stop();
      setIsDragging(true);
      setHasDragged(true);
      scheduleDragTransform(fullHeight(vh) - drag.startHeight, drag.startHeight);
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
    scheduleDragTransform(fullHeight(vh) - next, next);
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
    onSnapChange(snap === "full" ? "peek" : stepSnap(snap, "up"));
  }, [onSnapChange, snap]);

  const handleContentScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    onContentScroll?.(event);
    onContentScrollPositionChange?.(event.currentTarget.scrollTop);
    if (snap !== "browse") return;
    const remaining = event.currentTarget.scrollHeight - event.currentTarget.scrollTop - event.currentTarget.clientHeight;
    if (remaining <= BROWSE_AUTO_EXPAND_THRESHOLD) onSnapChange("full");
  }, [onContentScroll, onContentScrollPositionChange, onSnapChange, snap]);

  const isPeek = snap === "peek";
  const isFull = snap === "full";
  const contentScrollable = !isPeek && !isDragging;
  const actionLabel = isPeek
    ? `↑ ${resultCount === undefined ? "Browse homes" : `${resultCount.toLocaleString()} homes`}`
    : snap === "browse"
      ? "↑ Full list"
      : "↓ Show map";

  return (
    <>
      {/* Full List owns the foreground; lower modes leave the map interactive. */}
      <div
        ref={scrimRef}
        aria-hidden="true"
        onClick={() => onSnapChange("browse")}
        className={cn(
          "fixed inset-0 z-[var(--z-chrome)] bg-ink/10 transition-[opacity,backdrop-filter] duration-[220ms]",
          isFull ? "pointer-events-auto opacity-100 backdrop-blur-[1.5px]" : "pointer-events-none opacity-0 backdrop-blur-none",
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
          height: FULL_HEIGHT,
          bottom: keyboardInset > 0 ? `${keyboardInset}px` : "var(--app-mobile-nav-offset)",
          transform: restTransform(snap),
          willChange: isDragging ? "transform" : undefined,
        }}
      >
        <div className="relative flex min-h-11 flex-none items-center justify-center">
          {/* Drag remains available, but fades into a secondary affordance. */}
          <button
            data-sheet-drag-handle
            type="button"
            aria-label={ariaLabel ?? "Resize listings sheet"}
            aria-expanded={!isPeek}
            onKeyDown={toggleFromHandle}
            onClick={handleHandleClick}
            className={cn(
              "absolute inset-0 flex min-h-11 w-full touch-none cursor-grab items-start justify-center pt-3 transition-opacity duration-[220ms] hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring active:cursor-grabbing active:opacity-100",
              hasDragged && !isDragging ? "opacity-25" : "opacity-100",
            )}
          >
            <span className="h-1.5 w-10 rounded-full bg-border" aria-hidden="true" />
          </button>
          {!isPeek ? (
            <button
              type="button"
              onClick={() => onSnapChange(isFull ? "peek" : "full")}
              className="relative z-10 ml-auto mr-4 min-h-11 rounded-full px-3 text-sm font-semibold text-forest transition-[background-color,transform] duration-[120ms] hover:bg-forest/8 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {actionLabel}
            </button>
          ) : null}
        </div>

        {isPeek ? (
          <div className="flex flex-none items-end gap-3 px-5 pb-4">
            {peek ? <div className="min-w-0 flex-1">{peek}</div> : null}
            <button
              type="button"
              onClick={() => onSnapChange("browse")}
              className="min-h-11 shrink-0 rounded-full border border-forest/20 bg-forest/8 px-4 text-sm font-semibold text-forest transition-[background-color,transform] duration-[120ms] hover:bg-forest/12 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {actionLabel}
            </button>
          </div>
        ) : null}
        <span className="sr-only" aria-live="polite">Results sheet {snap}</span>

        {!isPeek && header ? <div className="flex-none touch-pan-x">{header}</div> : null}

        {!isPeek ? (
          <div
            ref={scrollRef}
            onScroll={handleContentScroll}
            className={cn(
              "scroll-contained min-h-0 flex-1 pb-[max(env(safe-area-inset-bottom),0.5rem)]",
              contentScrollable ? "overflow-y-auto" : "overflow-y-hidden",
            )}
            style={{ touchAction: contentScrollable ? "pan-x pan-y" : "pan-x" }}
          >
            {children}
          </div>
        ) : null}

      </div>
    </>
  );
}
