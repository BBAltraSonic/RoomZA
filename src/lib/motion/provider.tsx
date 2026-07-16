"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { LayoutGroup, LazyMotion, MotionConfig, useReducedMotion, type Variants } from "motion/react";
import * as m from "motion/react-m";

import { reducedRouteVariants, routeVariants } from "./presets";
import { MOTION_EASING, type MotionDirection } from "./tokens";

const loadMotionFeatures = () => import("./features").then((module) => module.default);

type NavigationWithIndex = {
  currentEntry?: { index?: number };
};

function currentNavigationIndex() {
  const navigation = (window as Window & { navigation?: NavigationWithIndex }).navigation;
  return typeof navigation?.currentEntry?.index === "number" ? navigation.currentEntry.index : null;
}

export function navigationDirectionForEvent(event: "link" | "popstate" | "replace"): MotionDirection {
  if (event === "link") return "forward";
  if (event === "popstate") return "back";
  return "replace";
}

function isPlainSameOriginNavigation(event: MouseEvent) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return false;
  }
  const target = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
  if (!target || target.target || target.hasAttribute("download")) return false;
  const url = new URL(target.href, window.location.href);
  return url.origin === window.location.origin && url.pathname !== window.location.pathname;
}

function focusRouteHeading(root: HTMLElement | null) {
  const heading = root?.querySelector<HTMLElement>(
    "main h1, main [role='heading'][aria-level='1']",
  );
  if (!heading) return;
  if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1");
  heading.focus({ preventScroll: true });
}

function RouteFrame({ children, direction, variants }: {
  children: React.ReactNode;
  direction: MotionDirection;
  variants: Variants;
}) {
  const routeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = routeRef.current;
    if (!root) return;
    let focusedHeading: HTMLElement | null = null;
    const focusNewHeading = () => {
      const heading = root.querySelector<HTMLElement>(
        "main h1, main [role='heading'][aria-level='1']",
      );
      if (!heading || heading === focusedHeading) return;
      focusedHeading = heading;
      focusRouteHeading(root);
    };
    const frame = window.requestAnimationFrame(focusNewHeading);
    const observer = new MutationObserver(focusNewHeading);
    observer.observe(root, { childList: true, subtree: true });
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return (
    <m.div
      ref={routeRef}
      data-motion-route={direction}
      className="min-h-0 flex-1"
      custom={direction}
      variants={variants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {children}
    </m.div>
  );
}

export function RouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const shouldReduceMotion = useReducedMotion();
  const navigationIndexRef = useRef<number | null>(null);
  const [direction, setDirection] = useState<MotionDirection>("replace");

  const recordDirection = useCallback((next: MotionDirection) => {
    setDirection(next);
  }, []);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (isPlainSameOriginNavigation(event)) recordDirection(navigationDirectionForEvent("link"));
    };
    const onPopState = () => {
      const previousIndex = navigationIndexRef.current;
      const nextIndex = currentNavigationIndex();
      recordDirection(
        previousIndex !== null && nextIndex !== null && nextIndex > previousIndex
          ? navigationDirectionForEvent("link")
          : navigationDirectionForEvent("popstate"),
      );
      navigationIndexRef.current = nextIndex;
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
    };
  }, [recordDirection]);

  useEffect(() => {
    navigationIndexRef.current = currentNavigationIndex();
  }, [pathname]);

  const adminRoute = pathname.startsWith("/admin");
  if (adminRoute) {
    return <div className="min-h-0 flex-1" data-motion-route="disabled">{children}</div>;
  }

  const variants = shouldReduceMotion ? reducedRouteVariants : routeVariants;

  return (
    <RouteFrame
      key={pathname}
      direction={direction}
      variants={variants}
    >
      {children}
    </RouteFrame>
  );
}

export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={loadMotionFeatures} strict>
      <MotionConfig reducedMotion="user" transition={{ ease: MOTION_EASING.easeOut }}>
        <LayoutGroup id="pinpoint-app-motion">
          <RouteTransition>{children}</RouteTransition>
        </LayoutGroup>
      </MotionConfig>
    </LazyMotion>
  );
}
