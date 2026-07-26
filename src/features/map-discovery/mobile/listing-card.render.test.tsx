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
 *  - Req 10.3: result replacement uses a restrained opacity fade only — no
 *    positional travel and never layout-triggering properties.
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
import { PropertyCard } from "@/components/premium/property-card";
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
  it("exposes one semantic detail action when the card has multiple images", () => {
    const onActivate = vi.fn();
    render(
      <ListingCard
        card={card({
          imageUrls: [
            "https://images.example.com/a.jpg",
            "https://images.example.com/b.jpg",
            "https://images.example.com/c.jpg",
          ],
        })}
        onActivate={onActivate}
        variant="grid"
      />,
    );

    const detailActions = screen.getAllByRole("button", {
      name: "View details for Sea Point Studio",
    });
    expect(detailActions).toHaveLength(1);

    fireEvent.click(detailActions[0]!);
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it("opens the listing when the card surface is clicked", () => {
    const onActivate = vi.fn();
    const { container } = render(
      <ListingCard card={card()} onActivate={onActivate} variant="grid" />,
    );

    fireEvent.click(container.querySelector('[data-slot="property-card-media"]')!);

    expect(onActivate).toHaveBeenCalledTimes(1);
  });

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

describe("ListingCard visual composition", () => {
  it("uses fixed compact media and places plain rent pricing below the image", () => {
    const { container } = render(<ListingCard card={card()} onActivate={() => {}} variant="grid" />);

    const propertyCard = container.querySelector('[data-slot="property-card"]');
    const media = container.querySelector('[data-slot="property-card-media"]');
    const imageScroller = media?.firstElementChild;
    const price = container.querySelector('[data-slot="property-card-price"]');
    const content = container.querySelector('[data-slot="property-card-content"]');

    expect(propertyCard).toHaveClass("rounded-xl", "shadow-[var(--property-card-shadow)]");
    expect(propertyCard).toHaveClass("motion-interactive", "property-card-pointer-glow", "hover:shadow-[var(--elevation-2)]");
    expect(media).toHaveClass("h-36", "sm:h-40", "rounded-t-xl");
    expect(imageScroller).not.toHaveClass("scroll-edge-fade");
    expect(price).not.toHaveClass("rounded-full", "shadow-[var(--property-card-shadow)]");
    expect(price).toHaveTextContent("R 12 000/month");
    expect(content).toHaveClass("px-3.5", "pb-3", "pt-3");
    expect(media!.compareDocumentPosition(content!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("keeps sale pricing suffix-free and removes secondary bond copy", () => {
    const { container } = render(
      <ListingCard
        card={card({ listingType: "sale", salePrice: 2_400_000, displayPrice: 2_400_000 })}
        onActivate={() => {}}
        variant="grid"
      />,
    );

    const price = container.querySelector('[data-slot="property-card-price"]');
    expect(price).toHaveTextContent("R 2 400 000");
    expect(price).not.toHaveTextContent("/month");
    expect(screen.queryByText(/Est\. bond R .*\/month/)).not.toBeInTheDocument();
  });

  it("shows the NEW and NSFAS trust badges together when both facts apply", () => {
    render(
      <ListingCard
        card={card({
          createdAt: new Date().toISOString(),
          nsfasApproved: true,
        })}
        onActivate={() => {}}
        variant="grid"
      />,
    );

    expect(screen.getByText("New")).toBeInTheDocument();
    expect(screen.getByText("NSFAS")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("keeps agent identity and contact details out of the scan-first card", () => {
    const { container } = render(
      <PropertyCard
        property={{
          id: "l-agent",
          title: "Gardens Apartment",
          price: 18_500,
          bedrooms: 2,
          bathrooms: 2,
          imageUrl: "https://images.example.com/agent-listing.jpg",
          agent: {
            id: "agent-1",
            name: "A deliberately long agent name that must remain contained",
            phone: "+27 82 555 0101",
            agency: "Cape Homes",
            isVerified: true,
          },
        }}
      />,
    );

    const price = container.querySelector('[data-slot="property-card-price"]');
    const agent = container.querySelector('[data-slot="property-card-agent"]');

    expect(price).not.toHaveTextContent("A deliberately long agent name");
    expect(agent).toBeNull();
    expect(screen.queryByText("A deliberately long agent name that must remain contained")).not.toBeInTheDocument();
    expect(screen.queryByText("Cape Homes")).not.toBeInTheDocument();
    expect(screen.queryByText("+27 82 555 0101")).not.toBeInTheDocument();
  });

  it("caps trust information in the compact signal row after the location", () => {
    const { container } = render(
      <PropertyCard
        property={{
          id: "l-trust",
          title: "Verified Gardens Apartment",
          address: "12 Long Street, Gardens",
          price: 18_500,
          bedrooms: 2,
          bathrooms: 2,
          landlordTrust: {
            medianFirstResponseSeconds: 18 * 60,
            phoneVerified: true,
            emailVerified: true,
          },
        }}
      />,
    );

    const location = container.querySelector('[data-slot="property-card-location"]');
    const signals = container.querySelector('[data-slot="property-card-signals"]');
    const features = container.querySelector('[data-slot="property-card-features"]');

    expect(location).not.toBeNull();
    expect(signals).not.toBeNull();
    expect(features).not.toBeNull();
    expect(screen.getByText("18 min response")).toBeInTheDocument();
    expect(signals!.children.length).toBeLessThanOrEqual(3);
    expect(location!.compareDocumentPosition(signals!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(features!.compareDocumentPosition(location!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("retains selected and saved states", () => {
    const { container } = render(
      <ListingCard card={card()} selected onActivate={() => {}} variant="grid" />,
    );

    expect(container.querySelector('[data-slot="property-card"]')).toHaveClass("border-forest", "ring-2");
    expect(screen.getByRole("button", { name: "Save listing" })).toBeInTheDocument();
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

  it("uses transform-and-opacity choreography without layout-driving animation", () => {
    const css = readRepoFile("src/app/globals.css");
    const layoutProps = /(?:^|[;{\s])(top|left|right|bottom|width|height|margin|padding)\s*:/;

    for (const name of ["discovery-card-in", "discovery-card-in-x"]) {
      const body = extractKeyframes(css, name);
      expect(body).toMatch(/opacity\s*:/);
      expect(body).toMatch(/transform\s*:/);
      expect(body, `${name} must not animate layout-triggering properties`).not.toMatch(layoutProps);
    }
  });

  it("collapses motion to the final resting state under prefers-reduced-motion: reduce", () => {
    const css = readRepoFile("src/app/globals.css");

    // A global reduced-motion safeguard neutralizes animation/transition timing.
    const mediaStart = css.lastIndexOf("@media (prefers-reduced-motion: reduce)");
    expect(mediaStart).toBeGreaterThanOrEqual(0);
    const mediaBlock = css.slice(mediaStart, mediaStart + 400);
    expect(mediaBlock).toMatch(/animation-duration:\s*0\.01ms\s*!important/);
    expect(mediaBlock).toMatch(/transition-duration:\s*0\.01ms\s*!important/);

    // The keyframes' `to` state is the resting/final state, so collapsing the
    // duration lands the card in its final visual state with no travel.
    for (const name of ["discovery-card-in", "discovery-card-in-x"]) {
      const body = extractKeyframes(css, name);
      const toState = body.slice(body.indexOf("to"));
      expect(toState).toMatch(/opacity:\s*1/);
      expect(toState).toMatch(/transform\s*:/);
    }
  });
});
