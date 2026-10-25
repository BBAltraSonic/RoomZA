"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { domMin, LayoutGroup, LazyMotion, MotionConfig, useReducedMotion, type FeatureBundle } from "motion/react";
import { MOTION_DURATION, MOTION_EASING, type MotionDirection } from "./tokens";

// Animation is optional: a failed chunk must not reject application startup.
export function loadMotionFeatures(): Promise<FeatureBundle> {
  return import("./features").then((module) => module.default).catch(() => domMin);
}

export function navigationDirectionForEvent(event: "link" | "popstate" | "replace"): MotionDirection {
  if (event === "link") return "forward";
  if (event === "popstate") return "back";
  return "replace";
}

/** Maps and active communication/media keep their own motion and rendering. */
export function hasPageArrivalMotion(pathname: string) {
  const path = pathname.replace(/\/+$/, "") || "/";
  return !["/", "/services", "/offers", "/issue4-test"].includes(path)
    && !/^\/messages\/[^/]+(?:\/|$)/.test(path)
    && !/^\/viewings\/[^/]+\/live(?:\/|$)/.test(path)
    && !/^\/live-tours(?:\/|$)/.test(path);
}

// Next owns layout state, scroll and focus. Never key/remount children or wait
// for an exit animation. HTML is visible before hydration and during navigation.
export function RouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const previousPath = useRef(pathname);
  const surface = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = previousPath.current;
    previousPath.current = pathname;
    const node = surface.current;
    if (!previous || previous === pathname || !hasPageArrivalMotion(pathname)
      || !node?.animate || !window.matchMedia) return;

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
  }, [pathname]);

  return <div ref={surface} className="min-h-0 flex-1" data-motion-route="stable">{children}</div>;
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
