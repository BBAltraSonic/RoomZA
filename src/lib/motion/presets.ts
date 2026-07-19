import type { Variants } from "motion/react";

import {
  MOTION_BLUR_PX,
  MOTION_DISTANCE,
  MOTION_DURATION,
  MOTION_EASING,
  MOTION_EXIT_FACTOR,
  MOTION_OPACITY,
  MOTION_SCALE,
  MOTION_SPRING,
  MOTION_STAGGER_LEAD_SECONDS,
  MOTION_STAGGER_SECONDS,
  type MotionDirection,
} from "./tokens";

export const routeVariants: Variants = {
  initial: (direction: MotionDirection) => {
    if (direction === "back") {
      return {
        opacity: MOTION_OPACITY.muted,
        scale: MOTION_SCALE.outgoing,
        filter: `blur(${MOTION_BLUR_PX}px)`,
      };
    }
    if (direction === "replace") return { opacity: MOTION_OPACITY.hidden };
    return {
      opacity: MOTION_OPACITY.hidden,
      y: MOTION_DISTANCE.lg,
      scale: MOTION_SCALE.incoming,
    };
  },
  animate: {
    opacity: MOTION_OPACITY.visible,
    y: 0,
    scale: 1,
    filter: "none",
    transition: {
      duration: MOTION_DURATION.normal,
      ease: MOTION_EASING.easeOut,
    },
    transitionEnd: { filter: "none" },
  },
  exit: (direction: MotionDirection) => {
    if (direction === "back") {
      return {
        opacity: MOTION_OPACITY.hidden,
        y: MOTION_DISTANCE.lg,
        scale: MOTION_SCALE.incoming,
        transition: {
          duration: MOTION_DURATION.normal * MOTION_EXIT_FACTOR,
          ease: MOTION_EASING.easeInOut,
        },
      };
    }
    if (direction === "replace") {
      return {
        opacity: MOTION_OPACITY.hidden,
        transition: { duration: MOTION_DURATION.fast },
      };
    }
    return {
      opacity: MOTION_OPACITY.muted,
      scale: MOTION_SCALE.outgoing,
      filter: `blur(${MOTION_BLUR_PX}px)`,
      transition: {
        duration: MOTION_DURATION.normal * MOTION_EXIT_FACTOR,
        ease: MOTION_EASING.easeInOut,
      },
    };
  },
};

export const reducedRouteVariants: Variants = {
  initial: { opacity: MOTION_OPACITY.hidden },
  animate: {
    opacity: MOTION_OPACITY.visible,
    transition: { duration: MOTION_DURATION.fast },
  },
  exit: {
    opacity: MOTION_OPACITY.hidden,
    transition: { duration: MOTION_DURATION.fast * MOTION_EXIT_FACTOR },
  },
};

export const revealVariants: Variants = {
  hidden: {
    opacity: MOTION_OPACITY.hidden,
    y: MOTION_DISTANCE.md,
    scale: 0.97,
  },
  visible: {
    opacity: MOTION_OPACITY.visible,
    y: 0,
    scale: 1,
    transition: {
      duration: MOTION_DURATION.normal,
      ease: MOTION_EASING.easeOut,
    },
  },
};

export const listVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: MOTION_STAGGER_SECONDS,
      delayChildren: MOTION_STAGGER_LEAD_SECONDS,
      staggerDirection: 1,
    },
  },
};

export const listItemVariants: Variants = {
  hidden: { opacity: 0, y: MOTION_DISTANCE.md, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: MOTION_DURATION.normal,
      ease: MOTION_EASING.easeOut,
    },
  },
  exit: {
    opacity: 0,
    scale: MOTION_SCALE.press,
    transition: { duration: MOTION_DURATION.fast },
  },
};

export const modalTransition = MOTION_SPRING.soft;
export const sheetTransition = MOTION_SPRING.medium;
export const feedbackTransition = MOTION_SPRING.bouncy;
