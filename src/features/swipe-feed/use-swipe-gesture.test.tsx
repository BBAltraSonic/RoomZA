// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { useEffect } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { FLY_OUT_MS, useSwipeGesture, type SwipeGestureOptions } from "./use-swipe-gesture";

beforeAll(() => {
  // jsdom has no PointerEvent; MouseEvent carries clientX/clientY, which is all the hook reads.
  if (!("PointerEvent" in window)) {
    class PointerEventPolyfill extends MouseEvent {
      pointerId: number;
      isPrimary: boolean;
      pointerType: string;
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 1;
        this.isPrimary = init.isPrimary ?? true;
        this.pointerType = init.pointerType ?? "touch";
      }
    }
    Object.assign(window, { PointerEvent: PointerEventPolyfill });
  }
});

beforeEach(() => vi.useFakeTimers());
afterEach(() => { cleanup(); vi.useRealTimers(); });

type FlyOut = ReturnType<typeof useSwipeGesture>["flyOut"];
const api: { flyOut: FlyOut } = { flyOut: () => {} };
const flyOut: FlyOut = (decision) => api.flyOut(decision);

function Harness(props: Partial<SwipeGestureOptions>) {
  const gesture = useSwipeGesture({ enabled: true, reducedMotion: false, onDecision: () => {}, ...props });
  useEffect(() => { api.flyOut = gesture.flyOut; }, [gesture.flyOut]);
  return (
    <div data-testid="card" {...gesture.bind}>
      <button type="button">Inner action</button>
    </div>
  );
}

function setup(props: Partial<SwipeGestureOptions> = {}) {
  const onDecision = vi.fn();
  const onTap = vi.fn();
  render(<Harness onDecision={onDecision} onTap={onTap} {...props} />);
  const card = screen.getByTestId("card");
  card.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 700, right: 400, bottom: 700, x: 0, y: 0, toJSON: () => ({}) });
  return { card, onDecision, onTap };
}

function drag(card: HTMLElement, path: Array<[number, number, number]>) {
  const [first, ...rest] = path;
  const [x0, y0, t0] = first!;
  vi.setSystemTime(t0);
  fireEvent.pointerDown(card, { clientX: x0, clientY: y0, pointerId: 1, isPrimary: true, button: 0 });
  for (const [x, y, t] of rest) {
    vi.setSystemTime(t);
    fireEvent.pointerMove(card, { clientX: x, clientY: y, pointerId: 1 });
  }
  const [x, y] = path.at(-1)!;
  fireEvent.pointerUp(card, { clientX: x, clientY: y, pointerId: 1 });
}

describe("useSwipeGesture", () => {
  it("should_save_after_a_long_drag_right_once_the_card_has_flown_out", () => {
    const { card, onDecision } = setup();
    drag(card, [[0, 0, 0], [20, 2, 400], [200, 4, 800]]);
    expect(onDecision).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(FLY_OUT_MS + 50); });
    expect(onDecision).toHaveBeenCalledWith("save");
  });

  it("should_pass_after_a_long_drag_left", () => {
    const { card, onDecision } = setup();
    drag(card, [[300, 0, 0], [280, 2, 400], [100, 4, 800]]);
    act(() => { vi.advanceTimersByTime(FLY_OUT_MS + 50); });
    expect(onDecision).toHaveBeenCalledWith("pass");
  });

  it("should_spring_back_after_a_short_slow_drag", () => {
    const { card, onDecision } = setup();
    drag(card, [[0, 0, 0], [20, 0, 400], [60, 0, 800]]);
    act(() => { vi.advanceTimersByTime(FLY_OUT_MS + 50); });
    expect(onDecision).not.toHaveBeenCalled();
    expect(card.style.transform).toBe("");
  });

  it("should_leave_vertical_moves_to_the_browser_for_scrolling", () => {
    const { card, onDecision, onTap } = setup();
    drag(card, [[100, 0, 0], [102, 30, 50], [104, 300, 100]]);
    act(() => { vi.advanceTimersByTime(FLY_OUT_MS + 50); });
    expect(onDecision).not.toHaveBeenCalled();
    expect(onTap).not.toHaveBeenCalled();
    expect(card.style.transform).toBe("");
  });

  it("should_ignore_drags_while_disabled", () => {
    const { card, onDecision } = setup({ enabled: false });
    drag(card, [[0, 0, 0], [20, 0, 400], [300, 0, 800]]);
    act(() => { vi.advanceTimersByTime(FLY_OUT_MS + 50); });
    expect(onDecision).not.toHaveBeenCalled();
  });

  it("should_report_a_tap_with_its_horizontal_position", () => {
    const { card, onTap, onDecision } = setup();
    drag(card, [[300, 200, 0], [302, 201, 40]]);
    expect(onTap).toHaveBeenCalledWith(0.755);
    expect(onDecision).not.toHaveBeenCalled();
  });

  it("should_swallow_the_click_that_ends_a_drag", () => {
    const { card } = setup();
    const onClick = vi.fn();
    screen.getByRole("button", { name: "Inner action" }).addEventListener("click", onClick);
    drag(card, [[0, 0, 0], [20, 0, 400], [60, 0, 800]]);
    fireEvent.click(screen.getByRole("button", { name: "Inner action" }));
    expect(onClick).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Inner action" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("should_fly_out_from_a_button_press_the_same_way", () => {
    const { card, onDecision } = setup();
    act(() => flyOut("pass"));
    expect(card.style.transform).toContain("translate3d(-");
    act(() => { vi.advanceTimersByTime(FLY_OUT_MS + 50); });
    expect(onDecision).toHaveBeenCalledWith("pass");
  });

  it("should_fade_instead_of_flying_with_reduced_motion", () => {
    const { card, onDecision } = setup({ reducedMotion: true });
    act(() => flyOut("save"));
    expect(card.style.transform).toBe("");
    expect(card.style.opacity).toBe("0");
    act(() => { vi.advanceTimersByTime(FLY_OUT_MS + 50); });
    expect(onDecision).toHaveBeenCalledWith("save");
  });

  it("should_ignore_a_second_decision_while_one_is_animating", () => {
    const { onDecision } = setup();
    act(() => { flyOut("pass"); flyOut("save"); });
    act(() => { vi.advanceTimersByTime(FLY_OUT_MS + 50); });
    expect(onDecision).toHaveBeenCalledTimes(1);
    expect(onDecision).toHaveBeenCalledWith("pass");
  });

  it("should_write_stamp_opacity_while_dragging", () => {
    const { card } = setup();
    vi.setSystemTime(0);
    fireEvent.pointerDown(card, { clientX: 0, clientY: 0, pointerId: 1, isPrimary: true, button: 0 });
    vi.setSystemTime(400);
    fireEvent.pointerMove(card, { clientX: 60, clientY: 0, pointerId: 1 });
    expect(card.style.getPropertyValue("--swipe-save-opacity")).toBe("0.5");
    expect(card.style.getPropertyValue("--swipe-pass-opacity")).toBe("0");
  });
});
