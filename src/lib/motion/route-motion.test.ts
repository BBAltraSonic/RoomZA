import { describe, expect, it, vi } from "vitest";

import { animateRouteChange, classifyRouteMotion, routeMotionClass } from "./route-motion";

const tabs = new Set(["/", "/saved", "/post/listings", "/messages", "/profile", "/admin", "/admin/users", "/admin/reports"]);
const classify = (from: string | null, to: string) => classifyRouteMotion(from, to, tabs);

describe("classifyRouteMotion", () => {
  it("should_stay_still_on_first_load_and_same_path_updates", () => {
    expect(classify(null, "/saved")).toBe("none");
    expect(classify("/saved", "/saved")).toBe("none");
    expect(classify("/saved/", "/saved")).toBe("none");
    expect(classify("/saved?sort=new", "/saved?sort=old#top")).toBe("none");
  });

  it("should_move_forward_when_drilling_into_a_descendant_or_deeper_screen", () => {
    expect(classify("/messages", "/messages/abc")).toBe("forward");
    expect(classify("/saved", "/listing/123")).toBe("forward");
    expect(classify("/dashboard", "/dashboard/listings/42/edit")).toBe("forward");
    expect(classify("/auth", "/auth/forgot-password")).toBe("forward");
  });

  it("should_move_back_when_returning_to_an_ancestor_or_shallower_screen", () => {
    expect(classify("/messages/abc", "/messages")).toBe("back");
    expect(classify("/listing/123", "/saved")).toBe("back");
    expect(classify("/admin/users/9", "/admin/reports")).toBe("back");
    expect(classify("/auth/forgot-password", "/auth")).toBe("back");
  });

  it("should_crossfade_between_siblings_and_top_level_sections", () => {
    expect(classify("/settings/privacy", "/settings/alerts")).toBe("lateral");
    expect(classify("/listing/1", "/listing/2")).toBe("lateral");
    expect(classify("/terms", "/privacy")).toBe("lateral");
    expect(classify("/auth", "/onboarding")).toBe("lateral");
  });

  it("should_treat_navigation_tabs_as_lateral_even_at_different_depths", () => {
    expect(classify("/saved", "/post/listings")).toBe("lateral");
    expect(classify("/post/listings", "/profile")).toBe("lateral");
    expect(classify("/admin", "/admin/users")).toBe("lateral");
    expect(classify("/", "/saved")).toBe("lateral");
  });

  it("should_still_drill_forward_from_a_tab_into_its_detail", () => {
    expect(classify("/profile", "/profile/edit")).toBe("forward");
    expect(classify("/admin/users", "/admin/users/9")).toBe("forward");
  });

  it("should_leave_self_animating_destinations_alone", () => {
    for (const destination of ["/", "/services", "/offers", "/services/", "/viewings/1/live", "/live-tours/7", "/issue4-test"]) {
      expect(classify("/profile", destination)).toBe("none");
    }
  });

  it("should_not_animate_away_from_live_video", () => {
    expect(classify("/viewings/1/live", "/viewings")).toBe("none");
    expect(classify("/live-tours/7", "/saved")).toBe("none");
  });

  it("should_ignore_unparseable_paths", () => {
    expect(classify("not a path", "/saved")).toBe("none");
    expect(classify("/saved", "")).toBe("none");
  });
});

describe("routeMotionClass", () => {
  it("should_map_each_kind_to_its_view_transition_class", () => {
    expect(routeMotionClass("forward")).toBe("route-forward");
    expect(routeMotionClass("back")).toBe("route-back");
    expect(routeMotionClass("lateral")).toBe("route-lateral");
    expect(routeMotionClass("none")).toBe("none");
  });
});

describe("animateRouteChange", () => {
  function snapshots() {
    const cancel = vi.fn();
    const animation = { cancel } as unknown as Animation;
    return { old: { animate: vi.fn(() => animation) }, new: { animate: vi.fn(() => animation) }, cancel };
  }
  const base = { fromScrollY: 0, toScrollY: 0, reducedMotion: false };
  const firstFrame = (animate: ReturnType<typeof snapshots>["new"]["animate"]) =>
    (animate.mock.calls[0] as unknown as [Keyframe[]])[0][0]!;

  it("should_slide_forward_from_the_end_edge_and_leave_toward_the_start", () => {
    const pair = snapshots();
    animateRouteChange(pair, { ...base, kind: "forward" });
    const [oldFrames, oldOptions] = pair.old.animate.mock.calls[0] as unknown as [Keyframe[], KeyframeAnimationOptions];
    const [newFrames, newOptions] = pair.new.animate.mock.calls[0] as unknown as [Keyframe[], KeyframeAnimationOptions];
    expect(oldFrames.at(-1)).toEqual({ opacity: 0, transform: "translate3d(-24px, 0px, 0)" });
    expect(newFrames[0]).toEqual({ opacity: 0, transform: "translate3d(24px, 0px, 0) scale(1)" });
    expect(oldOptions.duration).toBe(120);
    expect(newOptions.duration).toBe(220);
  });

  it("should_mirror_travel_when_going_back", () => {
    const pair = snapshots();
    animateRouteChange(pair, { ...base, kind: "back" });
    expect(firstFrame(pair.new.animate).transform).toBe("translate3d(-24px, 0px, 0) scale(1)");
  });

  it("should_rise_in_place_for_lateral_moves", () => {
    const pair = snapshots();
    animateRouteChange(pair, { ...base, kind: "lateral" });
    expect(firstFrame(pair.new.animate).transform).toBe("translate3d(0px, 8px, 0) scale(0.985)");
  });

  it("should_pin_the_old_page_where_the_reader_left_it", () => {
    const pair = snapshots();
    animateRouteChange(pair, { ...base, kind: "forward", fromScrollY: 1800, toScrollY: 0 });
    expect(firstFrame(pair.old.animate).transform).toBe("translate3d(0, -1800px, 0)");
  });

  it("should_drop_travel_and_scale_for_reduced_motion", () => {
    const pair = snapshots();
    animateRouteChange(pair, { ...base, kind: "lateral", reducedMotion: true });
    const [frames, options] = pair.new.animate.mock.calls[0] as unknown as [Keyframe[], KeyframeAnimationOptions];
    expect(frames[0]!.transform).toBe("translate3d(0px, 0px, 0) scale(1)");
    expect(options.duration).toBe(120);
  });

  it("should_cancel_both_animations_on_cleanup", () => {
    const pair = snapshots();
    animateRouteChange(pair, { ...base, kind: "forward" })();
    expect(pair.cancel).toHaveBeenCalledTimes(2);
  });

  it("should_do_nothing_without_snapshots_or_motion", () => {
    expect(() => animateRouteChange({}, { ...base, kind: "forward" })()).not.toThrow();
    const pair = snapshots();
    animateRouteChange(pair, { ...base, kind: "none" });
    expect(pair.old.animate).not.toHaveBeenCalled();
  });

  it("should_survive_an_animation_failure", () => {
    const pair = snapshots();
    pair.new.animate.mockImplementation(() => { throw new Error("unsupported"); });
    const cleanup = animateRouteChange(pair, { ...base, kind: "forward" });
    cleanup();
    expect(pair.cancel).toHaveBeenCalledOnce();
  });
});
