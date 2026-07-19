import type { Transition } from "motion/react";

export type MotionDurationName = "fast" | "normal" | "slow";
export type MotionEasingName = "easeOut" | "easeInOut";
export type MotionSpringName = "soft" | "medium" | "bouncy";
export type MotionDistanceName = "xs" | "sm" | "md" | "lg";
export type MotionDirection = "forward" | "back" | "replace";

export const MOTION_DURATION = {
  fast: 0.12,
  normal: 0.22,
  slow: 0.38,
} as const satisfies Record<MotionDurationName, number>;

export const MOTION_EASING = {
  easeOut: [0.16, 1, 0.3, 1],
  easeInOut: [0.65, 0, 0.35, 1],
} as const satisfies Record<MotionEasingName, readonly [number, number, number, number]>;

export const MOTION_SPRING = {
  soft: { type: "spring", stiffness: 260, damping: 30, mass: 0.9 },
  medium: { type: "spring", stiffness: 360, damping: 28, mass: 0.8 },
  bouncy: { type: "spring", stiffness: 500, damping: 20, mass: 0.7 },
} as const satisfies Record<MotionSpringName, Transition>;

export const MOTION_DISTANCE = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
} as const satisfies Record<MotionDistanceName, number>;

export const MOTION_SCALE = {
  hover: 1.03,
  press: 0.96,
  incoming: 0.985,
  outgoing: 0.98,
} as const;

export const MOTION_OPACITY = {
  hidden: 0,
  muted: 0.7,
  visible: 1,
} as const;

export const MOTION_BLUR_PX = 6;
export const MOTION_STAGGER_SECONDS = 0.04;
export const MOTION_STAGGER_LEAD_SECONDS = 0.03;
export const MOTION_PARTICLE_STAGGER_SECONDS = 0.025;
export const MOTION_CELEBRATION_MS = 900;
export const MOTION_STAGGER_LIMIT = 10;
export const MOTION_EXIT_FACTOR = 0.75;

export function staggerDelay(index: number) {
  return Math.min(Math.max(index, 0), MOTION_STAGGER_LIMIT) * MOTION_STAGGER_SECONDS;
}
