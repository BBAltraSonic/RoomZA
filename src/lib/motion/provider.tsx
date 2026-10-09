"use client";

import { domMin, LayoutGroup, LazyMotion, MotionConfig, useReducedMotion, type FeatureBundle } from "motion/react";
import { MOTION_EASING, type MotionDirection } from "./tokens";

// Animation is optional: a failed chunk must not reject application startup.
export function loadMotionFeatures(): Promise<FeatureBundle> {
  return import("./features").then((module) => module.default).catch(() => domMin);
}

export function navigationDirectionForEvent(event: "link" | "popstate" | "replace"): MotionDirection {
  if (event === "link") return "forward";
  if (event === "popstate") return "back";
  return "replace";
}

// Next owns layout state, scroll and focus. HTML is visible before hydration.
export function RouteTransition({ children }: { children: React.ReactNode }) {
  return <div className="min-h-0 flex-1" data-motion-route="stable">{children}</div>;
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
