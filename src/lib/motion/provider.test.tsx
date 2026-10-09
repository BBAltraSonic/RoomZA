// @vitest-environment jsdom
import { useState } from "react";
import { renderToString } from "react-dom/server";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MotionProvider, loadMotionFeatures } from "./provider";
import { AnimatedNumber, MotionList, MotionListItem, MotionReveal } from "./primitives";
vi.mock("./features", () => { throw new Error("Animation chunk unavailable"); });
beforeEach(() => vi.stubGlobal("matchMedia", () => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() })));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
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
