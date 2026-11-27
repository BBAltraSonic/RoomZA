import { describe, expect, it } from "vitest";

import { dragVisual, lockAxis, MAX_ROTATION_DEG, resolveSwipe, swipeVelocity, TAP_SLOP_PX } from "./swipe-physics";

describe("resolveSwipe", () => {
  const width = 400;

  it("should_save_when_dragged_right_past_thirty_percent", () => {
    expect(resolveSwipe({ offsetX: 121, velocityX: 0, width })).toBe("save");
  });

  it("should_pass_when_dragged_left_past_thirty_percent", () => {
    expect(resolveSwipe({ offsetX: -121, velocityX: 0, width })).toBe("pass");
  });

  it("should_spring_back_when_the_drag_is_short_and_slow", () => {
    expect(resolveSwipe({ offsetX: 100, velocityX: 200, width })).toBeNull();
    expect(resolveSwipe({ offsetX: -100, velocityX: -200, width })).toBeNull();
  });

  it("should_commit_a_fast_flick_even_when_the_drag_is_short", () => {
    expect(resolveSwipe({ offsetX: 40, velocityX: 900, width })).toBe("save");
    expect(resolveSwipe({ offsetX: -40, velocityX: -900, width })).toBe("pass");
  });

  it("should_not_commit_a_flick_against_the_drag_direction", () => {
    expect(resolveSwipe({ offsetX: 40, velocityX: -900, width })).toBeNull();
  });

  it("should_not_commit_a_flick_that_barely_moved", () => {
    expect(resolveSwipe({ offsetX: 10, velocityX: 2000, width })).toBeNull();
  });

  it("should_not_commit_when_the_width_is_unknown", () => {
    expect(resolveSwipe({ offsetX: 300, velocityX: 0, width: 0 })).toBeNull();
  });
});

describe("lockAxis", () => {
  it("should_wait_until_the_pointer_moves_past_the_slop", () => {
    expect(lockAxis(TAP_SLOP_PX - 1, 0)).toBeNull();
  });

  it("should_lock_horizontally_for_a_mostly_sideways_move", () => {
    expect(lockAxis(20, 5)).toBe("x");
    expect(lockAxis(-20, 5)).toBe("x");
  });

  it("should_lock_vertically_for_a_scroll_or_a_diagonal", () => {
    expect(lockAxis(5, 20)).toBe("y");
    expect(lockAxis(15, 14)).toBe("y");
  });
});

describe("swipeVelocity", () => {
  it("should_measure_pixels_per_second_over_recent_samples", () => {
    const samples = [{ x: 0, t: 0 }, { x: 50, t: 50 }, { x: 100, t: 100 }];
    expect(swipeVelocity(samples)).toBeCloseTo(1000);
  });

  it("should_ignore_samples_older_than_the_window", () => {
    const samples = [{ x: 0, t: 0 }, { x: 0, t: 400 }, { x: 30, t: 450 }];
    expect(swipeVelocity(samples)).toBeCloseTo(600);
  });

  it("should_be_zero_without_enough_samples", () => {
    expect(swipeVelocity([])).toBe(0);
    expect(swipeVelocity([{ x: 10, t: 5 }])).toBe(0);
  });
});

describe("dragVisual", () => {
  it("should_rotate_with_the_drag_and_cap_the_angle", () => {
    expect(dragVisual(0, 400).rotate).toBe(0);
    expect(dragVisual(200, 400).rotate).toBeGreaterThan(0);
    expect(dragVisual(-2000, 400).rotate).toBe(-MAX_ROTATION_DEG);
  });

  it("should_fade_in_the_matching_stamp_up_to_the_commit_distance", () => {
    expect(dragVisual(60, 400)).toMatchObject({ saveOpacity: 0.5, passOpacity: 0 });
    expect(dragVisual(-500, 400)).toMatchObject({ saveOpacity: 0, passOpacity: 1 });
  });
});
