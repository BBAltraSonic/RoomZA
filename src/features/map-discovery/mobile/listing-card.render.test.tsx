// @vitest-environment jsdom

/**
 * ListingCard — image optimization + reduced-motion animation render tests.
 *
 * Task 11.3 (discovery-page-experience). Confirms the rendering guarantees the
 * design attributes to listing imagery and card entrance motion:
 *
 *  - Req 11.5: listing imagery is rendered through `next/image` with explicit
 *    dimensions (`fill` + `sizes`) so the layout box is reserved before the
 *    image loads (protects CLS), and is served in AVIF/WebP at the framework
 *    level (configured in next.config.ts).
 *  - Req 12.6: a listing image that fails to load falls back to a placeholder
 *    in place of the failed image.
 *  - Req 10.3: entrance / settle motion animates GPU-accelerated `transform`
 *    and `opacity` only — never layout-triggering properties.
 *  - Req 10.5: with `prefers-reduced-motion: reduce`, motion collapses to the
 *    final resting state (no motion).
 *
 * These are example-based render tests (not property tests). The `next/image`
 * mock faithfully forwards `fill`, `sizes`, and `onError` onto a real <img> so
 * the component's contract with `next/image` is observable and the failed-load
 * fallback is deterministically triggerable. The AVIF/WebP and motion-property
 * guarantees live at the config/stylesheet level, so those are asserted by
 * reading next.config.ts and globals.css respectively.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

// --- Module mocks --------------------------------------------------------

// Faithful next/image stub: records the props the component passed and renders
// a real <img>, forwarding the props that matter to this spec (fill, sizes,
// onError, src). This lets us both confirm the next/image contract and fire a
// deterministic load error to exercise the placeholder fallback.
type CapturedImageProps = {
  src: unknown;
  alt?: string;
  sizes?: string;
  fill?: boolean;
  className?: string;
  onError?: (event: unknown) => void;
};

const capturedImageProps: CapturedImageProps[] = [];

vi.mock("next/image", () => ({
  __esModule: true,
  default: (props: CapturedImageProps) => {
    capturedImageProps.push(props);
    const { src, alt, sizes, fill, className, onError } = props;
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        alt={alt ?? ""}
        src={typeof src === "string" ? src : ""}
        sizes={sizes}
        className={className}
        data-fill={fill ? "true" : undefined}
        onError={onError}
      />
    );
  },
}));

// The favorites hook pulls in the Supabase browser client + toasts, which are
// orthogonal to rendering; stub it to a static, side-effect-free shape.
vi.mock("../hooks/use-favorites", () => ({
  useFavorites: () => ({
    favorites: new Set<string>(),
    isFavorite: () => false,
    toggleFavorite: vi.fn(),
  }),
}));

// PropertyCard imports the chat video-call button at module scope; it is never
// rendered here (showVideoCall={false}) so stub it to a no-op node.
vi.mock("@/features/chat/listing-video-call-button", () => ({
  ListingVideoCallButton: () => null,
}));

import { ListingCard } from "./listing-card";
import type { ListingCardModel } from "../lib/types";

// --- helpers -------------------------------------------------------------

function card(overrides: Partial<ListingCardModel> = {}): ListingCardModel {
  return {
    id: "l1",
    title: "Sea Point Studio",
    imageUrls: ["https://images.example.com/a.jpg"],
    price: 12000,
    bedrooms: 2,
    bathrooms: 1,
    rating: null,
    reviewCount: null,
    distanceKm: 1.4,
    agent: null,
    ...overrides,
  };
}

function readRepoFile(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

/** Extracts a `@keyframes <name> { ... }` body from a stylesheet string. */
function extractKeyframes(css: string, name: string): string {
  const start = css.indexOf(`@keyframes ${name}`);
  expect(start, `expected @keyframes ${name} in globals.css`).toBeGreaterThanOrEqual(0);
  // Walk braces from the first `{` after the name to its matching `}`.
  const open = css.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === "{") depth += 1;
    else if (css[i] === "}") {
      depth -= 1;
      if (depth === 0) return css.slice(open, i + 1);
    }
  }
  throw new Error(`unterminated @keyframes ${name}`);
}

afterEach(() => {
  cleanup();
  capturedImageProps.length = 0;
  vi.clearAllMocks();
});

// --- tests ---------------------------------------------------------------

describe("ListingCard image optimization (Req 11.5)", () => {
  it("renders listing imagery through next/image with fill + explicit sizes to reserve layout", () => {
    render(<ListingCard card={card()} onActivate={() => {}} variant="grid" />);

    const img = screen.getByAltText(/Sea Point Studio - Image 1/);
    expect(img).toBeInTheDocument();

    // Reserved layout box: `fill` fills the (aspect-ratio-sized) parent, and a
    // non-empty `sizes` gives the browser the box to reserve before load.
    expect(img).toHaveAttribute("data-fill", "true");
    const sizes = img.getAttribute("sizes");
    expect(sizes, "next/image should receive an explicit sizes value").toBeTruthy();

    // Confirm the component itself passed the props (not just our stub).
    const listingImage = capturedImageProps.find((p) => p.src === "https://images.example.com/a.jpg");
    expect(listingImage).toBeDefined();
    expect(listingImage?.fill).toBe(true);
    expect(typeof listingImage?.sizes).toBe("string");
  });

  it("is configured to serve AVIF/WebP at the framework level", () => {
    const nextConfig = readRepoFile("next.config.ts");
    expect(nextConfig).toContain('"image/avif"');
    expect(nextConfig).toContain('"image/webp"');
  });
});

describe("ListingCard failed-image fallback (Req 12.6)", () => {
  it("swaps a failed image for a placeholder in its place", () => {
    render(<ListingCard card={card()} onActivate={() => {}} variant="grid" />);

    const img = screen.getByAltText(/Sea Point Studio - Image 1/);
    expect(img).toBeInTheDocument();
    expect(screen.queryByTestId("listing-image-placeholder")).not.toBeInTheDocument();

    // Simulate the image failing to load.
    fireEvent.error(img);

    // The placeholder replaces the failed image; the failed <img> is gone.
    expect(screen.getByTestId("listing-image-placeholder")).toBeInTheDocument();
    expect(screen.queryByAltText(/Sea Point Studio - Image 1/)).not.toBeInTheDocument();
  });

  it("renders the placeholder when a listing has no imagery at all", () => {
    render(<ListingCard card={card({ imageUrls: [] })} onActivate={() => {}} variant="grid" />);

    expect(screen.getByTestId("listing-image-placeholder")).toBeInTheDocument();
  });
});

describe("ListingCard entrance motion (Req 10.3, 10.5)", () => {
  it("applies the one-time reveal class when a reveal index is supplied", () => {
    const { container } = render(
      <ListingCard card={card()} onActivate={() => {}} variant="grid" revealIndex={0} />,
    );
    expect(container.querySelector(".discovery-card-reveal")).not.toBeNull();
  });

  it("uses the horizontal reveal variant for the carousel", () => {
    const { container } = render(
      <ListingCard card={card()} onActivate={() => {}} variant="carousel" revealIndex={0} />,
    );
    expect(container.querySelector(".discovery-card-reveal-x")).not.toBeNull();
  });

  it("plays no entrance animation when no reveal index is supplied", () => {
    const { container } = render(<ListingCard card={card()} onActivate={() => {}} variant="grid" />);
    expect(container.querySelector(".discovery-card-reveal")).toBeNull();
    expect(container.querySelector(".discovery-card-reveal-x")).toBeNull();
  });

  it("animates only transform and opacity (no layout-triggering properties)", () => {
    const css = readRepoFile("src/app/globals.css");
    const layoutProps = /(?:^|[;{\s])(top|left|right|bottom|width|height|margin|padding)\s*:/;

    for (const name of ["discovery-card-in", "discovery-card-in-x"]) {
      const body = extractKeyframes(css, name);
      expect(body).toMatch(/transform\s*:/);
      expect(body).toMatch(/opacity\s*:/);
      expect(body, `${name} must not animate layout-triggering properties`).not.toMatch(layoutProps);
    }
  });

  it("collapses motion to the final resting state under prefers-reduced-motion: reduce", () => {
    const css = readRepoFile("src/app/globals.css");

    // A global reduced-motion safeguard neutralizes animation/transition timing.
    const mediaStart = css.indexOf("@media (prefers-reduced-motion: reduce)");
    expect(mediaStart).toBeGreaterThanOrEqual(0);
    const mediaBlock = css.slice(mediaStart, mediaStart + 400);
    expect(mediaBlock).toMatch(/animation-duration:\s*0\.01ms\s*!important/);
    expect(mediaBlock).toMatch(/transition-duration:\s*0\.01ms\s*!important/);

    // The keyframes' `to` state is the resting/final state, so collapsing the
    // duration lands the card in its final position with no motion.
    for (const name of ["discovery-card-in", "discovery-card-in-x"]) {
      const body = extractKeyframes(css, name);
      const toState = body.slice(body.indexOf("to"));
      expect(toState).toMatch(/opacity:\s*1/);
      expect(toState).toMatch(/transform:\s*translate3d\(0,\s*0,\s*0\)/);
    }
  });
});
