// @vitest-environment jsdom
import { useState } from "react";
import { renderToString } from "react-dom/server";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MotionProvider, RouteTransition, loadMotionFeatures } from "./provider";
import { AnimatedNumber, MotionList, MotionListItem, MotionReveal } from "./primitives";
let pathname = "/";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));
vi.mock("./features", () => { throw new Error("Animation chunk unavailable"); });
beforeEach(() => {
  pathname = "/";
  vi.stubGlobal("matchMedia", () => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
describe("visible application content", () => {
  it("renders route, reveals, list items and accurate counts before animation loads", () => {
    const html = renderToString(<MotionProvider><MotionReveal><MotionList><MotionListItem>Homes <AnimatedNumber value={42} /></MotionListItem></MotionList></MotionReveal></MotionProvider>);
    expect(html).toContain("42");
    expect(html).toContain("Homes");
    expect(html).not.toMatch(/opacity:0(?:;|")|visibility:hidden|blur\(/);
    expect(html).toContain('data-motion-route="stable"');
  });
  it("keeps shared child state and focus through shell updates", () => {
    function Editor() { const [value, setValue] = useState(0); return <button onClick={() => setValue(value + 1)}>Draft {value}</button>; }
    const { rerender } = render(<MotionProvider><Editor /></MotionProvider>);
    const button = screen.getByRole("button"); button.focus(); fireEvent.click(button);
    rerender(<MotionProvider><Editor /></MotionProvider>);
    expect(button.textContent).toBe("Draft 1"); expect(document.activeElement).toBe(button);
  });
  it("settles a failed optional feature load without a rejected promise", async () => {
    const fallback = await loadMotionFeatures();
    expect(typeof fallback.renderer).toBe("function");
  });
});

describe("non-blocking page arrivals", () => {
  function animationMock() {
    const cancel = vi.fn();
    const animate = vi.fn(() => ({ cancel }));
    Object.defineProperty(HTMLElement.prototype, "animate", { configurable: true, value: animate });
    return { animate, cancel };
  }

  afterEach(() => { Reflect.deleteProperty(HTMLElement.prototype, "animate"); });

  it("skips first load and animates only committed pathname changes without remounting, moving focus or resetting scroll", () => {
    const { animate, cancel } = animationMock();
    function Draft() { const [value, setValue] = useState(0); return <button onClick={() => setValue(value + 1)}>Draft {value}</button>; }
    const { rerender, container, unmount } = render(<RouteTransition><Draft /></RouteTransition>);
    const button = screen.getByRole("button");
    const wrapper = container.firstElementChild!;
    wrapper.scrollTop = 160;
    button.focus(); fireEvent.click(button);
    expect(animate).not.toHaveBeenCalled();
    pathname = "/profile";
    rerender(<RouteTransition><Draft /></RouteTransition>);
    expect(animate).toHaveBeenCalledExactlyOnceWith([{ opacity: 0.94 }, { opacity: 1 }], {
      duration: 120, easing: "cubic-bezier(0.16,1,0.3,1)",
    });
    expect(container.firstElementChild).toBe(wrapper);
    expect(wrapper.scrollTop).toBe(160);
    expect(button.textContent).toBe("Draft 1");
    expect(document.activeElement).toBe(button);
    // Search/filter/detail changes leave the pathname unchanged.
    rerender(<RouteTransition><Draft /></RouteTransition>);
    expect(animate).toHaveBeenCalledTimes(1);
    pathname = "/settings";
    rerender(<RouteTransition><Draft /></RouteTransition>);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(animate).toHaveBeenCalledTimes(2);
    unmount();
    expect(cancel).toHaveBeenCalledTimes(2);
  });

  it.each(["/", "/services", "/offers", "/services/", "/messages/123", "/viewings/123/live", "/live-tours/123", "/issue4-test"])("keeps %s free of page-wide motion", (destination) => {
    const { animate } = animationMock();
    pathname = "/profile";
    const { rerender } = render(<RouteTransition>Ready</RouteTransition>);
    pathname = destination;
    rerender(<RouteTransition>Ready</RouteTransition>);
    expect(animate).not.toHaveBeenCalled();
  });

  it("honors reduced motion, including changes during an active arrival", () => {
    const { animate, cancel } = animationMock();
    const preference = new EventTarget() as EventTarget & { matches: boolean };
    preference.matches = true;
    vi.stubGlobal("matchMedia", () => preference);
    const { rerender } = render(<RouteTransition>Ready</RouteTransition>);
    pathname = "/saved";
    rerender(<RouteTransition>Ready</RouteTransition>);
    expect(animate).not.toHaveBeenCalled();
    preference.matches = false;
    pathname = "/profile";
    rerender(<RouteTransition>Ready</RouteTransition>);
    expect(animate).toHaveBeenCalledTimes(1);
    preference.matches = true;
    preference.dispatchEvent(new Event("change"));
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("leaves navigation usable if browser animation support is missing or fails", () => {
    const { rerender } = render(<RouteTransition>First</RouteTransition>);
    pathname = "/terms";
    rerender(<RouteTransition>Terms</RouteTransition>);
    expect(screen.getByText("Terms")).toBeTruthy();
    const { animate } = animationMock();
    animate.mockImplementation(() => { throw new Error("Animation unavailable"); });
    pathname = "/privacy";
    rerender(<RouteTransition>Privacy</RouteTransition>);
    expect(screen.getByText("Privacy")).toBeTruthy();
  });
});
