// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import path from "node:path";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MobileBottomSheet } from "./bottom-sheet";

afterEach(cleanup);

describe("MobileBottomSheet interaction", () => {
  it("settles with a physics spring and a fixed full-list layout box", () => {
    const { container } = render(
      <MobileBottomSheet snap="peek" onSnapChange={() => {}}>
        Listings
      </MobileBottomSheet>,
    );

    const sheet = container.querySelector<HTMLElement>("[data-snap='peek']");
    expect(sheet).not.toBeNull();
    expect(sheet?.style.transition).not.toContain("height");

    // jsdom drops modern dvh/min() inline values, so verify those declarations
    // in source while the rendered node covers the transition contract.
    const source = readFileSync(path.resolve(process.cwd(), "src/features/map-discovery/mobile/bottom-sheet.tsx"), "utf8");
    expect(source).toContain('const FULL_HEIGHT = "min(95dvh, calc(100dvh - 48px))"');
    expect(source).toContain("height: FULL_HEIGHT");
    expect(source).toContain("translate3d");
    expect(source).toContain("animate(fromOffset, targetOffset");
    expect(source).toContain("MOTION_SPRING.medium");
  });

  it("offers click and arrow-key alternatives to dragging", () => {
    const onSnapChange = vi.fn();
    render(
      <MobileBottomSheet snap="peek" onSnapChange={onSnapChange}>
        Listings
      </MobileBottomSheet>,
    );

    const handle = screen.getByRole("button", { name: "Resize listings sheet" });
    fireEvent.click(handle);
    expect(onSnapChange).toHaveBeenLastCalledWith("browse");

    fireEvent.keyDown(handle, { key: "ArrowUp" });
    expect(onSnapChange).toHaveBeenLastCalledWith("browse");
  });

  it("keeps Peek lightweight and exposes a direct Browse action", () => {
    render(
      <MobileBottomSheet
        snap="peek"
        onSnapChange={() => {}}
        resultCount={247}
        peek={<div>Cape Town</div>}
        header={<div>Filters</div>}
      >
        Listing cards
      </MobileBottomSheet>,
    );

    expect(screen.getByText("Cape Town")).toBeVisible();
    expect(screen.getByRole("button", { name: "↑ 247 homes" })).toBeVisible();
    expect(screen.queryByText("Filters")).not.toBeInTheDocument();
    expect(screen.queryByText("Listing cards")).not.toBeInTheDocument();
  });

  it("promotes Browse to Full List when continued scrolling reaches the end", () => {
    const onSnapChange = vi.fn();
    const { container } = render(
      <MobileBottomSheet snap="browse" onSnapChange={onSnapChange}>
        Listing cards
      </MobileBottomSheet>,
    );
    const scroller = container.querySelector<HTMLElement>(".scroll-contained");
    expect(scroller).not.toBeNull();
    Object.defineProperties(scroller!, {
      scrollHeight: { configurable: true, value: 1_000 },
      clientHeight: { configurable: true, value: 500 },
      scrollTop: { configurable: true, writable: true, value: 470 },
    });

    fireEvent.scroll(scroller!);
    expect(onSnapChange).toHaveBeenCalledWith("full");
  });

  it("settles an interrupted drag when pointer capture is lost", () => {
    const onSnapChange = vi.fn();
    const { container } = render(
      <MobileBottomSheet snap="peek" onSnapChange={onSnapChange}>
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
    expect(screen.getByRole("button", { name: "Resize listings sheet" })).toHaveClass("opacity-25");
  });
});
