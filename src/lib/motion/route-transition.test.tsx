// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type RecordedProps = { update?: unknown; exit?: unknown; enter?: unknown; default?: unknown; onUpdate?: (instance: object) => unknown };
const recorded = vi.hoisted(() => ({ props: [] as RecordedProps[], runViewTransitions: true }));
let pathname = "/saved";

// Next's App Router React ships <ViewTransition>; record what the boundary asks it for.
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  function ViewTransition({ children, onUpdate, ...props }: RecordedProps & { children?: ReactNode }) {
    recorded.props.push(props);
    // React runs onUpdate when an armed boundary's content changes in a transition.
    actual.useLayoutEffect(() => {
      if (recorded.runViewTransitions && props.update && props.update !== "none") onUpdate?.({});
    });
    return children;
  }
  return { ...actual, ViewTransition };
});
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

const { LoadingHandoff, RouteTransition } = await import("./provider");

const updates = () => recorded.props.filter((props) => "update" in props).map((props) => props.update);
const lastUpdate = () => updates().at(-1);
/** The class the boundary was armed with for the most recent navigation commit. */
const armedClass = () => updates().filter((update) => update !== "none").at(-1);

beforeEach(() => {
  pathname = "/saved";
  recorded.props = [];
  recorded.runViewTransitions = true;
  vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] });
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(HTMLElement.prototype, "animate");
});

function navigate(to: string, rerender: (ui: React.ReactElement) => void) {
  pathname = to;
  rerender(<RouteTransition>Page {to}</RouteTransition>);
}

describe("RouteTransition view transition boundary", () => {
  it("should_stay_inert_on_first_render", () => {
    render(<RouteTransition>Saved</RouteTransition>);
    expect(lastUpdate()).toBe("none");
    expect(screen.getByText("Saved").closest("[data-motion-route]")?.getAttribute("data-motion-route")).toBe("stable");
  });

  it("should_arm_the_class_for_the_navigation_commit_then_settle_once_it_runs", () => {
    const { rerender, container } = render(<RouteTransition>Saved</RouteTransition>);
    navigate("/listing/12", rerender);
    expect(armedClass()).toBe("route-forward");
    // onUpdate settles the boundary so later in-page transitions don't replay it.
    expect(lastUpdate()).toBe("none");
    // Direction stays readable for styling and tests after the class settles.
    expect(container.querySelector("[data-motion-route]")?.getAttribute("data-motion-route")).toBe("forward");
  });

  it("should_settle_on_the_next_frame_when_no_view_transition_ran", () => {
    recorded.runViewTransitions = false;
    const { rerender } = render(<RouteTransition>Saved</RouteTransition>);
    navigate("/listing/12", rerender);
    expect(lastUpdate()).toBe("route-forward");
    act(() => { vi.advanceTimersToNextFrame(); });
    expect(lastUpdate()).toBe("none");
  });

  it("should_pick_direction_from_the_hierarchy", () => {
    const { rerender } = render(<RouteTransition>Saved</RouteTransition>);
    navigate("/listing/12", rerender);
    expect(armedClass()).toBe("route-forward");
    navigate("/saved", rerender);
    expect(armedClass()).toBe("route-back");
    navigate("/messages", rerender);
    expect(armedClass()).toBe("route-lateral");
  });

  it("should_not_replay_route_motion_for_same_path_updates", () => {
    const { rerender } = render(<RouteTransition>Saved</RouteTransition>);
    navigate("/profile", rerender);
    act(() => { vi.advanceTimersToNextFrame(); });
    rerender(<RouteTransition>Profile with new data</RouteTransition>);
    expect(lastUpdate()).toBe("none");
  });

  function mockSurfaceAnimate() {
    const animate = vi.fn(() => ({ cancel: vi.fn() }));
    Object.defineProperty(HTMLElement.prototype, "animate", { configurable: true, value: animate });
    return animate;
  }

  it("should_skip_the_opacity_fallback_when_a_view_transition_animated_the_route", () => {
    const animate = mockSurfaceAnimate();
    const { rerender } = render(<RouteTransition>Saved</RouteTransition>);
    navigate("/profile", rerender);
    expect(animate).not.toHaveBeenCalled();
  });

  it("should_fall_back_to_an_opacity_arrival_when_no_view_transition_ran", () => {
    // History traversal commits synchronously, so React starts no view transition.
    recorded.runViewTransitions = false;
    const animate = mockSurfaceAnimate();
    const { rerender } = render(<RouteTransition>Saved</RouteTransition>);
    window.dispatchEvent(new PopStateEvent("popstate"));
    navigate("/listing/4", rerender);
    expect(animate).toHaveBeenCalledOnce();
  });

  it("should_leave_swipe_back_gestures_to_the_browser", () => {
    recorded.runViewTransitions = false;
    const animate = mockSurfaceAnimate();
    const { rerender } = render(<RouteTransition>Listing</RouteTransition>);
    const swipe = new PopStateEvent("popstate");
    Object.defineProperty(swipe, "hasUAVisualTransition", { value: true });
    window.dispatchEvent(swipe);
    navigate("/saved", rerender);
    expect(animate).not.toHaveBeenCalled();
  });
});

describe("LoadingHandoff", () => {
  it("should_animate_only_when_the_fallback_leaves", () => {
    render(<LoadingHandoff><p>Loading</p></LoadingHandoff>);
    expect(screen.getByText("Loading")).toBeTruthy();
    expect(recorded.props.at(-1)).toEqual({ default: "none", enter: "none", exit: "route-reveal" });
  });
});
