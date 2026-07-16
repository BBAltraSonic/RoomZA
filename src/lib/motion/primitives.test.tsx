// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PendingGlyph, Skeleton, SuccessFeedback } from "./primitives";

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("motion primitives", () => {
  it.each(["card", "map", "profile", "gallery", "form", "list"] as const)(
    "renders the semantic %s skeleton",
    (variant) => {
      const { container } = render(<Skeleton variant={variant} />);
      expect(container.querySelector(`[data-skeleton="${variant}"]`)).toBeInTheDocument();
    },
  );

  it("keeps pending text available to assistive technology", () => {
    render(<PendingGlyph label="Saving property" />);
    expect(screen.getByRole("status", { name: "Saving property" })).toBeInTheDocument();
  });

  it("does not replay a celebration for the same event key", () => {
    const { container, rerender } = render(
      <SuccessFeedback eventKey="application-1" title="Application submitted" />,
    );
    expect(container.querySelectorAll(".pointer-events-none")).toHaveLength(7);

    act(() => vi.advanceTimersByTime(901));
    expect(container.querySelectorAll(".pointer-events-none")).toHaveLength(0);

    rerender(<SuccessFeedback eventKey="application-1" title="Application submitted" />);
    expect(container.querySelectorAll(".pointer-events-none")).toHaveLength(0);

    rerender(<SuccessFeedback eventKey="application-2" title="Application submitted" />);
    expect(container.querySelectorAll(".pointer-events-none")).toHaveLength(7);
  });
});
