// @vitest-environment jsdom

/**
 * Task 11.1 — Confirm RSC root and Suspense streaming.
 *
 * Verifies the site-root route (`app/page.tsx` → `Home`) conforms to the design's
 * rendering strategy (Req 9.3, 9.4):
 *
 *   - `Home` is a server component (async function, no `"use client"` directive)
 *     that renders ONLY a `<Suspense fallback={<DiscoveryPageFallback />}>` boundary
 *     wrapping the client `DiscoveryPage` — nothing else, no sibling nodes.
 *   - The fallback is the server-rendered chrome (`DiscoveryPageFallback`), so the
 *     first paint streams instantly.
 *   - First paint does not block on listing data: rendering the fallback chrome
 *     issues no network request and shows the loading skeletons synchronously.
 *
 * This is a hardening/verification test over a conforming implementation — it
 * confirms behavior rather than driving new behavior.
 */

import { Suspense } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// The real workspace is the heavy client tree (map SDK, hooks, fetch). We only
// need to observe that the layout wraps it inside the Suspense boundary, so
// replace it with a light stub. The stub records the props the layout hands it.
vi.mock("@/features/discovery/discovery-workspace", () => ({
  DiscoveryWorkspace: (props: Record<string, unknown>) => (
    <div data-testid="discovery-page-client" data-props={JSON.stringify(props ?? {})} />
  ),
}));

import DiscoveryLayout from "@/app/(discovery)/layout";
import Home from "@/app/(discovery)/page";
import OffersPage from "@/app/(discovery)/offers/page";
import ServicesPage from "@/app/(discovery)/services/page";
import { DiscoveryWorkspace } from "@/features/discovery/discovery-workspace";
import { DiscoveryPageFallback } from "@/features/map-discovery/discovery-page-fallback";

afterEach(cleanup);

describe("Discovery layout (RSC) — structure", () => {
  it.each(["layout.tsx", "page.tsx", "offers/page.tsx", "services/page.tsx"])("keeps %s a prerenderable server component", (file) => {
    const source = readFileSync(resolve(process.cwd(), "src/app/(discovery)", file), "utf8");
    expect(source).not.toMatch(/^\s*["']use client["']/m);
  });

  it("renders ONLY a <Suspense> boundary wrapping the client workspace", () => {
    const tree = DiscoveryLayout({ children: null });

    // Top-level node is a single Suspense boundary (not a fragment/array of nodes).
    expect(tree.type).toBe(Suspense);
    expect(Array.isArray(tree)).toBe(false);

    // Its fallback is the server-rendered chrome skeleton.
    expect(tree.props.fallback.type).toBe(DiscoveryPageFallback);

    // Its single child is the client workspace — no other siblings.
    const child = tree.props.children;
    expect(Array.isArray(child)).toBe(false);
    expect(child.type).toBe(DiscoveryWorkspace);
  });

  it("passes the MapTiler API key through to the workspace", () => {
    const child = DiscoveryLayout({ children: null }).props.children;
    // The prop is forwarded (value is env-derived and may be undefined in test).
    expect(Object.keys(child.props)).toContain("mapApiKey");
  });

  it("leaves rendering to the layout so a route change cannot remount discovery", () => {
    expect(Home()).toBeNull();
    expect(OffersPage()).toBeNull();
    expect(ServicesPage()).toBeNull();
  });
});

describe("DiscoveryPageFallback — streamed chrome (first paint)", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn(() => {
      throw new Error("fallback chrome must not fetch listing data");
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("renders the chrome synchronously without blocking on listing data", () => {
    render(<DiscoveryPageFallback />);

    // Chrome landmark + heading are present immediately (no async boundary).
    expect(screen.getByRole("main")).toBeInTheDocument();
    const routeHeading = screen.getByRole("heading", { name: /homes in view/i });
    expect(routeHeading).toBeInTheDocument();
    expect(routeHeading).toHaveAttribute("tabindex", "-1");

    // Loading affordances stand in for the not-yet-loaded map + listings.
    expect(screen.getByLabelText("Loading listings")).toBeInTheDocument();
    expect(screen.getByText(/loading map/i)).toBeInTheDocument();

    // First paint does not depend on any network round-trip.
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
