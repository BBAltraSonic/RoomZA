import { describe, expect, it } from "vitest";

import { reducedRouteVariants, routeVariants } from "./presets";
import { navigationDirectionForEvent } from "./provider";
import {
  MOTION_BLUR_PX,
  MOTION_DISTANCE,
  MOTION_DURATION,
  MOTION_EASING,
  MOTION_EXIT_FACTOR,
  MOTION_SCALE,
  MOTION_SPRING,
  staggerDelay,
} from "./tokens";

describe("motion system tokens", () => {
  it("locks the application choreography contract", () => {
    expect(MOTION_DURATION).toEqual({ fast: 0.12, normal: 0.22, slow: 0.38 });
    expect(MOTION_EASING.easeOut).toEqual([0.16, 1, 0.3, 1]);
    expect(MOTION_EASING.easeInOut).toEqual([0.65, 0, 0.35, 1]);
    expect(MOTION_SPRING.soft).toMatchObject({ stiffness: 260, damping: 30, mass: 0.9 });
    expect(MOTION_SPRING.medium).toMatchObject({ stiffness: 360, damping: 28, mass: 0.8 });
    expect(MOTION_SPRING.bouncy).toMatchObject({ stiffness: 500, damping: 20, mass: 0.7 });
    expect(MOTION_DISTANCE).toEqual({ xs: 4, sm: 8, md: 16, lg: 24 });
    expect(MOTION_SCALE).toEqual({ hover: 1.03, press: 0.96, incoming: 0.985, outgoing: 0.98 });
    expect(MOTION_BLUR_PX).toBe(6);
    expect(MOTION_EXIT_FACTOR).toBe(0.75);
  });

  it("caps list staggering at ten items and 400ms", () => {
    expect(staggerDelay(-1)).toBe(0);
    expect(staggerDelay(1)).toBe(0.04);
    expect(staggerDelay(10)).toBe(0.4);
    expect(staggerDelay(100)).toBe(0.4);
  });

  it("reverses forward and back route travel while reduced motion uses opacity only", () => {
    const initial = routeVariants.initial;
    const exit = routeVariants.exit;
    expect(typeof initial).toBe("function");
    expect(typeof exit).toBe("function");

    const forwardInitial = (initial as (direction: string) => Record<string, unknown>)("forward");
    const backExit = (exit as (direction: string) => Record<string, unknown>)("back");
    expect(forwardInitial).toMatchObject({ opacity: 0, y: 24, scale: 0.985 });
    expect(backExit).toMatchObject({ opacity: 0, y: 24, scale: 0.985 });
    expect(reducedRouteVariants.initial).toEqual({ opacity: 0 });
    expect(reducedRouteVariants.animate).not.toHaveProperty("y");
    expect(reducedRouteVariants.animate).not.toHaveProperty("scale");
    expect(reducedRouteVariants.animate).not.toHaveProperty("filter");
  });

  it("resolves link, history, and replacement navigation directions", () => {
    expect(navigationDirectionForEvent("link")).toBe("forward");
    expect(navigationDirectionForEvent("popstate")).toBe("back");
    expect(navigationDirectionForEvent("replace")).toBe("replace");
  });
});
