"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import type { PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent } from "react";

import { dragVisual, lockAxis, MAX_ROTATION_DEG, resolveSwipe, swipeVelocity, type PointerSample, type SwipeDecision } from "./swipe-physics";

export const FLY_OUT_MS = 220;
export const SPRING_BACK_MS = 180;
/** A press shorter than this, that barely moved, is a tap (photo stepping). */
const TAP_MAX_MS = 300;
/** Wait a few frames after a fly-out before clearing styles, so the next card renders first. */
const RESET_DELAY_MS = 50;

export type SwipeGestureOptions = {
  /** False while the card is scrolled into its details (requirement 4.5). Taps still work. */
  enabled: boolean;
  reducedMotion: boolean;
  /** Called once the card has left the screen. */
  onDecision: (decision: SwipeDecision) => void;
  /** Tap position across the card, 0 (left edge) to 1 (right edge). */
  onTap?: (xRatio: number) => void;
  /** The element that moves, when it is larger than the drag handle (the whole card). */
  getTarget?: () => HTMLElement | null;
};

type Press = { x: number; y: number; t: number; pointerId: number; axis: "x" | "y" | null; samples: PointerSample[]; offsetX: number };

/**
 * Horizontal swipe on plain pointer events. Styles are written straight to the
 * element, so dragging causes no React renders. The motion provider swaps drag
 * support out under reduced motion, which is why this does not use motion's drag.
 *
 * The element gets `touch-action: pan-y`: the browser keeps vertical scrolling
 * and hands sideways moves to us. Stamps can read `--swipe-save-opacity` and
 * `--swipe-pass-opacity` from the element.
 */
export function useSwipeGesture(options: SwipeGestureOptions) {
  const optionsRef = useRef(options);
  useEffect(() => { optionsRef.current = options; });

  const elementRef = useRef<HTMLElement | null>(null);
  const pressRef = useRef<Press | null>(null);
  const animatingRef = useRef(false);
  const suppressClickRef = useRef(false);
  const timersRef = useRef<number[]>([]);

  const later = useCallback((callback: () => void, ms: number) => {
    timersRef.current.push(window.setTimeout(callback, ms));
  }, []);

  useEffect(() => () => { timersRef.current.forEach((timer) => window.clearTimeout(timer)); }, []);

  const target = useCallback(() => optionsRef.current.getTarget?.() ?? elementRef.current, []);

  const paint = useCallback((offsetX: number) => {
    const element = target();
    if (!element) return;
    const visual = dragVisual(offsetX, elementRef.current?.getBoundingClientRect().width ?? 0);
    element.style.transition = "none";
    element.style.transform = `translate3d(${offsetX}px,0,0) rotate(${visual.rotate}deg)`;
    element.style.setProperty("--swipe-save-opacity", String(visual.saveOpacity));
    element.style.setProperty("--swipe-pass-opacity", String(visual.passOpacity));
  }, [target]);

  const reset = useCallback(() => {
    const element = target();
    if (!element) return;
    element.style.transition = "";
    element.style.transform = "";
    element.style.opacity = "";
    element.style.removeProperty("--swipe-save-opacity");
    element.style.removeProperty("--swipe-pass-opacity");
  }, [target]);

  const springBack = useCallback(() => {
    const element = target();
    if (!element || optionsRef.current.reducedMotion) { reset(); return; }
    element.style.transition = `transform ${SPRING_BACK_MS}ms ease-out`;
    element.style.transform = "translate3d(0,0,0) rotate(0deg)";
    element.style.setProperty("--swipe-save-opacity", "0");
    element.style.setProperty("--swipe-pass-opacity", "0");
    later(reset, SPRING_BACK_MS);
  }, [later, reset, target]);

  /** Sends the card off screen, then reports the decision. Buttons and keys use this too. */
  const flyOut = useCallback((decision: SwipeDecision) => {
    if (animatingRef.current) return;
    animatingRef.current = true;
    const element = target();
    if (element) {
      element.style.setProperty(decision === "save" ? "--swipe-save-opacity" : "--swipe-pass-opacity", "1");
      if (optionsRef.current.reducedMotion) {
        element.style.transition = `opacity ${FLY_OUT_MS}ms linear`;
        element.style.transform = "";
        element.style.opacity = "0";
      } else {
        const sign = decision === "save" ? 1 : -1;
        const distance = Math.max(element.getBoundingClientRect().width, window.innerWidth) * 1.5;
        element.style.transition = `transform ${FLY_OUT_MS}ms ease-in`;
        element.style.transform = `translate3d(${sign * distance}px,0,0) rotate(${sign * MAX_ROTATION_DEG}deg)`;
      }
    }
    later(() => {
      animatingRef.current = false;
      optionsRef.current.onDecision(decision);
      later(reset, RESET_DELAY_MS);
    }, FLY_OUT_MS);
  }, [later, reset, target]);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (animatingRef.current || !event.isPrimary) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    suppressClickRef.current = false;
    pressRef.current = { x: event.clientX, y: event.clientY, t: Date.now(), pointerId: event.pointerId, axis: null, samples: [], offsetX: 0 };
  }, []);

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const press = pressRef.current;
    if (!press || event.pointerId !== press.pointerId || press.axis === "y") return;
    const dx = event.clientX - press.x;
    if (press.axis === null) {
      const axis = lockAxis(dx, event.clientY - press.y);
      if (axis === null) return;
      // A disabled card treats a sideways drag like a scroll: ignored.
      press.axis = axis === "x" && optionsRef.current.enabled ? "x" : "y";
      if (press.axis === "y") return;
      suppressClickRef.current = true;
      try { event.currentTarget.setPointerCapture?.(event.pointerId); } catch { /* pointer already released */ }
    }
    press.samples.push({ x: event.clientX, t: Date.now() });
    press.offsetX = dx;
    paint(dx);
  }, [paint]);

  const onPointerUp = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const press = pressRef.current;
    if (!press || event.pointerId !== press.pointerId) return;
    pressRef.current = null;
    if (press.axis === "x") {
      const width = elementRef.current?.getBoundingClientRect().width ?? 0;
      const decision = resolveSwipe({ offsetX: press.offsetX, velocityX: swipeVelocity(press.samples), width });
      if (decision) flyOut(decision);
      else springBack();
      return;
    }
    if (press.axis === null && Date.now() - press.t < TAP_MAX_MS) {
      const rect = event.currentTarget.getBoundingClientRect();
      if (rect.width > 0) optionsRef.current.onTap?.((event.clientX - rect.left) / rect.width);
    }
  }, [flyOut, springBack]);

  const onPointerCancel = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const press = pressRef.current;
    if (!press || event.pointerId !== press.pointerId) return;
    pressRef.current = null;
    if (press.axis === "x") springBack();
  }, [springBack]);

  /** The click that ends a drag must not press a button inside the card. */
  const onClickCapture = useCallback((event: ReactMouseEvent<HTMLElement>) => {
    if (!suppressClickRef.current) return;
    suppressClickRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const ref = useCallback((node: HTMLElement | null) => { elementRef.current = node; }, []);

  const bind = useMemo(
    () => ({ ref, onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onClickCapture, style: { touchAction: "pan-y" } as const }),
    [ref, onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onClickCapture],
  );

  return { bind, flyOut };
}
