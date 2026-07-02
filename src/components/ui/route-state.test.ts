import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { EmptyState, ErrorState, LoadingSkeleton } from "./route-state";

describe("route-state primitives", () => {
  it("renders skeleton rows with the requested loading label", () => {
    const html = renderToStaticMarkup(
      React.createElement(LoadingSkeleton, { title: "Loading listings", rows: 3 }),
    );

    expect(html).toContain('aria-label="Loading listings"');
    expect(html).toContain('aria-busy="true"');
    expect((html.match(/animate-pulse/g) ?? []).length).toBeGreaterThanOrEqual(5);
  });

  it("requires and renders an empty-state action", () => {
    const html = renderToStaticMarkup(
      React.createElement(EmptyState, {
        title: "No saved homes",
        description: "Saved listings will appear here.",
        action: React.createElement("a", { href: "/listings" }, "Explore listings"),
      }),
    );

    expect(html).toContain("No saved homes");
    expect(html).toContain("Explore listings");
    expect(html).toContain('href="/listings"');
  });

  it("retains prior data while exposing retry on error", () => {
    const onRetry = vi.fn();
    const element = React.createElement(ErrorState, {
      message: "Could not refresh listings.",
      onRetry,
      priorData: React.createElement("div", { "data-testid": "prior" }, "Existing listing"),
    });

    const html = renderToStaticMarkup(element);

    expect(html).toContain("Existing listing");
    expect(html).toContain("Could not refresh listings.");
    expect(html).toContain("Try again");
    expect(html).toContain('role="alert"');
  });
});
