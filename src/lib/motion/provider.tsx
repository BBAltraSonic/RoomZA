/// <reference types="react/canary" />
"use client";

import * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { domMin, LayoutGroup, LazyMotion, MotionConfig, useReducedMotion, type FeatureBundle } from "motion/react";

import { adminNavigationGroups, memberNavigation } from "@/components/navigation/navigation-config";

import {
  animateRouteChange,
  classifyRouteMotion,
  routeMotionClass,
  type RouteMotionKind,
  type RouteTransitionSnapshots,
} from "./route-motion";
import { MOTION_DURATION, MOTION_EASING, type MotionDirection } from "./tokens";

export { hasPageArrivalMotion } from "./route-motion";

// Animation is optional: a failed chunk must not reject application startup.
export function loadMotionFeatures(): Promise<FeatureBundle> {
  return import("./features").then((module) => module.default).catch(() => domMin);
}

export function navigationDirectionForEvent(event: "link" | "popstate" | "replace"): MotionDirection {
  if (event === "link") return "forward";
  if (event === "popstate") return "back";
  return "replace";
}

/** Primary and admin navigation destinations: switching between them is a section change. */
export const NAVIGATION_TAB_ROOTS: ReadonlySet<string> = new Set([
  ...memberNavigation.map((item) => item.href),
  ...adminNavigationGroups.flatMap((group) => group.items.map((item) => item.href)),
]);

function PassThroughTransition({ children }: React.ViewTransitionProps) {
  return <>{children}</>;
}

// Next's App Router React exports <ViewTransition>; older runtimes (tests) do not.
const RouteViewTransition: React.ComponentType<React.ViewTransitionProps> =
  React.ViewTransition ?? PassThroughTransition;

type RouteMotionState = { path: string; kind: RouteMotionKind; id: number; settled: boolean; fromScrollY: number };

/**
 * Derives the motion for the navigation being rendered. The class is armed
 * only for the commit that changes the pathname, then settles to "none" so
 * in-page transitions (filters, refreshes, Suspense reveals) never replay it.
 */
function useRouteMotion(pathname: string) {
  const [state, setState] = useState<RouteMotionState>({ path: pathname, kind: "none", id: 0, settled: true, fromScrollY: 0 });
  let current = state;
  if (state.path !== pathname) {
    const kind = classifyRouteMotion(state.path, pathname, NAVIGATION_TAB_ROOTS);
    // Rendered before Next resets or restores scroll for the destination.
    current = { path: pathname, kind, id: state.id + 1, settled: kind === "none", fromScrollY: window.scrollY };
    setState(current);
  }

  const { id, settled } = current;
  const settle = useCallback(() => {
    setState((latest) => (latest.id === id && !latest.settled ? { ...latest, settled: true } : latest));
  }, [id]);

  // Backstop for commits where no view transition ran (unsupported or skipped).
  useEffect(() => {
    if (settled) return;
    const frame = requestAnimationFrame(settle);
    return () => cancelAnimationFrame(frame);
  }, [settle, settled]);

  return { ...current, settle };
}

// Next owns layout state, scroll and focus. Never key/remount children or wait
// for an exit animation. HTML is visible before hydration and during navigation.
export function RouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const motion = useRouteMotion(pathname);
  const surface = useRef<HTMLDivElement>(null);
  const { id, kind, fromScrollY, settle } = motion;
  const viewTransitionRanFor = useRef(0);
  const browserAnimatedTraversal = useRef(false);

  const onUpdate = useCallback((instance: React.ViewTransitionInstance) => {
    viewTransitionRanFor.current = id;
    settle();
    return animateRouteChange(instance as RouteTransitionSnapshots, {
      kind,
      fromScrollY,
      toScrollY: window.scrollY,
      reducedMotion: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
    });
  }, [fromScrollY, id, kind, settle]);

  // A swipe-back gesture already animated the page; don't add a second motion.
  // Capture runs before Next's own popstate listener commits the destination.
  useEffect(() => {
    const onPopState = (event: PopStateEvent) => {
      browserAnimatedTraversal.current = (event as PopStateEvent & { hasUAVisualTransition?: boolean }).hasUAVisualTransition === true;
    };
    window.addEventListener("popstate", onPopState, { capture: true });
    return () => window.removeEventListener("popstate", onPopState, { capture: true });
  }, []);

  // Commits without a view transition (unsupported browsers, and history
  // traversal, which React commits synchronously) get an opacity arrival.
  // Passive effects follow a running view transition, so the ref is current.
  useEffect(() => {
    const node = surface.current;
    const browserAnimated = browserAnimatedTraversal.current;
    browserAnimatedTraversal.current = false;
    if (kind === "none" || viewTransitionRanFor.current === id || browserAnimated || !node?.animate || !window.matchMedia) return;

    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (preference.matches) return;

    // Opacity alone avoids moving fixed controls or measuring/reflowing layouts.
    // Start nearly opaque so content stays readable and interactive throughout.
    let animation: Animation;
    try {
      animation = node.animate([{ opacity: 0.94 }, { opacity: 1 }], {
        duration: MOTION_DURATION.fast * 1000,
        easing: `cubic-bezier(${MOTION_EASING.easeOut.join(",")})`,
      });
    } catch {
      return; // Optional decoration must never interrupt navigation.
    }

    const onPreferenceChange = () => { if (preference.matches) animation.cancel(); };
    preference.addEventListener("change", onPreferenceChange);
    return () => {
      animation.cancel();
      preference.removeEventListener("change", onPreferenceChange);
    };
  }, [id, kind]);

  return (
    <RouteViewTransition default="none" enter="none" exit="none" update={motion.settled ? "none" : routeMotionClass(kind)} onUpdate={onUpdate}>
      <div ref={surface} className="min-h-0 flex-1" data-motion-route={kind === "none" ? "stable" : kind}>{children}</div>
    </RouteViewTransition>
  );
}

/**
 * Hands a loading fallback off to the content that replaces it: the skeleton
 * sinks and fades while the revealed page is already in place underneath.
 */
export function LoadingHandoff({ children }: { children: React.ReactNode }) {
  return <RouteViewTransition default="none" enter="none" exit="route-reveal">{children}</RouteViewTransition>;
}

export function MotionProvider({ children }: { children: React.ReactNode }) {
  const reduceMotion = useReducedMotion();
  return (
    <LazyMotion features={reduceMotion ? domMin : loadMotionFeatures} strict>
      <MotionConfig reducedMotion="user" transition={{ ease: MOTION_EASING.easeOut }}>
        <LayoutGroup id="pinpoint-app-motion">
          <RouteTransition>{children}</RouteTransition>
        </LayoutGroup>
      </MotionConfig>
    </LazyMotion>
  );
}
