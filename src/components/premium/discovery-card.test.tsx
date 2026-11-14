// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DiscoveryCard } from "./discovery-card";

afterEach(cleanup);

const photos = ["https://example.supabase.co/one.jpg", "https://example.supabase.co/two.jpg"];

function renderCard(props: Partial<Parameters<typeof DiscoveryCard>[0]> = {}) {
  return render(<DiscoveryCard category="property" cardId="home-1" slotPrefix="property-card" title="Garden cottage" location="Melville"
    emphasis="R 6 500" emphasisSuffix="/month" features={<span>2 beds</span>}
    media={{ imageUrls: photos, imageAlt: "Garden cottage", placeholder: <span>No photo</span>, action: <button type="button">Save listing</button> }}
    {...props} />);
}

describe("compact discovery card", () => {
  it("lays the photo beside the facts so more results fit in the panel", () => {
    const { container } = renderCard({ presentation: "compact" });

    const card = container.querySelector('[data-slot="property-card"]')!;
    const media = container.querySelector('[data-slot="property-card-media"]')!;
    const content = container.querySelector('[data-slot="property-card-content"]')!;
    expect(card).toHaveAttribute("data-layout", "row");
    expect(card).toHaveClass("flex");
    expect(media).toHaveClass("w-28", "shrink-0", "self-stretch");
    expect(content).toHaveClass("min-w-0", "flex-1");
    expect(media.compareDocumentPosition(content)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("keeps the save action off the small photo and counts the photos instead", () => {
    const { container } = renderCard({ presentation: "compact" });

    const media = container.querySelector('[data-slot="property-card-media"]')!;
    const save = screen.getByRole("button", { name: "Save listing" });
    expect(media).not.toContainElement(save);
    expect(container.querySelector('[data-slot="property-card-content"]')).toContainElement(save);
    expect(media).toHaveTextContent("2");
    expect(screen.getByText("2 photos")).toHaveClass("sr-only");
  });

  it("still opens details from the card body and never from its controls", () => {
    const open = vi.fn();
    const { container } = renderCard({ presentation: "compact", onSelect: open });

    fireEvent.click(screen.getByRole("button", { name: "Save listing" }));
    expect(open).not.toHaveBeenCalled();
    fireEvent.click(container.querySelector('[data-slot="property-card-location"]')!);
    expect(open).toHaveBeenCalledOnce();
  });

  it("keeps the stacked photo card for surfaces that ask for it", () => {
    const { container } = renderCard({ presentation: "standard" });

    const card = container.querySelector('[data-slot="property-card"]')!;
    expect(card).toHaveAttribute("data-layout", "stack");
    expect(container.querySelector('[data-slot="property-card-media"]')).toContainElement(screen.getByRole("button", { name: "Save listing" }));
  });
});
