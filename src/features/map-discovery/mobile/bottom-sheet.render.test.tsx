// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import path from "node:path";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MobileBottomSheet } from "./bottom-sheet";

afterEach(cleanup);

describe("MobileBottomSheet interaction", () => {
  it("settles with transform-only motion and a fixed expanded layout box", () => {
    const { container } = render(
      <MobileBottomSheet snap="collapsed" onSnapChange={() => {}}>
        Listings
      </MobileBottomSheet>,
    );

    const sheet = container.querySelector<HTMLElement>("[data-snap='collapsed']");
    expect(sheet).not.toBeNull();
    expect(sheet?.style.transition).toContain("transform");
    expect(sheet?.style.transition).not.toContain("height");

    // jsdom drops modern dvh/min() inline values, so verify those declarations
    // in source while the rendered node covers the transition contract.
    const source = readFileSync(path.resolve(process.cwd(), "src/features/map-discovery/mobile/bottom-sheet.tsx"), "utf8");
    expect(source).toContain('const EXPANDED_HEIGHT = "min(92dvh, calc(100dvh - 120px))"');
    expect(source).toContain("height: EXPANDED_HEIGHT");
    expect(source).toContain("translate3d");
    expect(source).not.toContain('const SNAP_TRANSITION = "height');
  });

  it("offers click and arrow-key alternatives to dragging", () => {
    const onSnapChange = vi.fn();
    render(
      <MobileBottomSheet snap="collapsed" onSnapChange={onSnapChange}>
        Listings
      </MobileBottomSheet>,
    );

    const handle = screen.getByRole("button", { name: "Resize listings sheet" });
    fireEvent.click(handle);
    expect(onSnapChange).toHaveBeenLastCalledWith("half");

    fireEvent.keyDown(handle, { key: "ArrowUp" });
    expect(onSnapChange).toHaveBeenLastCalledWith("half");
  });

  it("settles an interrupted drag when pointer capture is lost", () => {
    const onSnapChange = vi.fn();
    const { container } = render(
      <MobileBottomSheet snap="collapsed" onSnapChange={onSnapChange}>
        Listings
      </MobileBottomSheet>,
    );
    const sheet = container.querySelector<HTMLElement>("[data-motion-sheet]");
    expect(sheet).not.toBeNull();

    fireEvent.pointerDown(sheet!, { button: 0, pointerId: 7, clientX: 100, clientY: 700, timeStamp: 0 });
    fireEvent.pointerMove(sheet!, { buttons: 1, pointerId: 7, clientX: 100, clientY: 620, timeStamp: 16 });
    expect(sheet).toHaveAttribute("data-dragging");

    fireEvent.lostPointerCapture(sheet!, { pointerId: 7 });

    expect(sheet).not.toHaveAttribute("data-dragging");
    expect(onSnapChange).toHaveBeenCalledTimes(1);
  });
});
