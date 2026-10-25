// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { PropertyCard, SaveIconButton } from "@/components/premium/property-card";
import { OfferFeedCard } from "@/features/offers/offer-feed-card";
import { EntryFeedCard } from "@/features/entries/entry-feed-card";
import { ServiceFeedCard } from "@/features/services/service-feed-card";
import type { PublicLiveOffer } from "@/features/offers/public-contract";
import type { PublicEntry } from "@/features/entries/public-contract";
import type { ServiceFeed } from "@/features/services/schema";

const areaId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const id = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const startsAt = "2026-10-08T08:00:00Z";
const endsAt = "2026-10-08T14:00:00Z";
const coordinates = { areaId, address: "10 Fixture Road", latitude: -33.9, longitude: 18.4 };
const offer: PublicLiveOffer = {
  offerId: id, revisionId: id, confirmedAt: startsAt, startsAt, endsAt, areaId, status: "live",
  content: { ...coordinates, title: "Lunch special", benefit: "Two lunches for R100", terms: "While supplies last", shopName: "Fixture shop", startsAt, endsAt },
  place: { id: areaId, name: "Fixture", region: "ZA", fullAddress: "Fixture, ZA" }, poster: null,
};
const entry: PublicEntry = {
  entryId: id, category: "event", approvedAt: startsAt, state: "upcoming",
  content: { ...coordinates, title: "Music in the park", description: "An afternoon concert", venueName: "Fixture park", startsAt, endsAt },
};
const service: ServiceFeed["items"][number] = {
  id, area_id: areaId, approved_at: startsAt,
  content: { ...coordinates, title: "Tap repairs", description: "Local plumbing repairs", providerName: "Fixture plumber", serviceType: "Plumbing", phone: "+27 21 555 0100" },
};

vi.mock("@/lib/motion/primitives", () => ({ BlurImage: ({ src, alt }: { src: string; alt: string }) => <span role="img" aria-label={alt} data-src={src} /> }));

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("shared discovery card behavior", () => {
  it("keeps saving separate from Property's primary detail action", () => {
    const open = vi.fn(), save = vi.fn();
    render(<PropertyCard property={{ id, title: "Fixture home", price: 6000 }}
      onSelect={open} action={<SaveIconButton onClick={save} />} />);
    fireEvent.click(screen.getByRole("button", { name: "Save listing" }));
    expect(save).toHaveBeenCalledOnce();
    expect(open).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "View details for Fixture home" }));
    expect(open).toHaveBeenCalledOnce();
  });

  it("retains the Shopping detail link, benefit and SAST expiry separately from map selection", () => {
    const select = vi.fn();
    const { container, rerender } = render(<OfferFeedCard item={offer} onShowOnMap={select} />);
    expect(screen.getByRole("link", { name: offer.content.title })).toHaveAttribute("href", "/offers/" + id);
    expect(screen.queryByText(offer.content.benefit)).not.toBeInTheDocument();
    expect(screen.getByText(/Ends .*16:00 SAST/)).toHaveClass("sr-only");
    expect(screen.queryByText("/month")).not.toBeInTheDocument();
    expect(container.querySelector('[data-slot="discovery-card-media"]')).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Show on map" }));
    expect(select).toHaveBeenCalledOnce();
    rerender(<OfferFeedCard item={offer} selected onShowOnMap={select} />);
    expect(screen.getByRole("button", { name: "Show on map" })).toHaveAttribute("aria-pressed", "true");
    expect(container.querySelector("article")).toHaveClass("border-selection", "ring-2");
  });

  it.each(["event", "tourism"] as const)("keeps %s venue dates and lifecycle labels in context", (category) => {
    const item = { ...entry, category, state: category === "event" ? "upcoming" as const : "live" as const };
    const { container } = render(<EntryFeedCard item={item} />);
    expect(screen.getByRole("link", { name: item.content.title })).toHaveAttribute("href", "/specials/" + id);
    expect(screen.getByText(item.content.venueName)).toBeVisible();
    expect(screen.getByText(category === "event" ? "Upcoming" : "Available now")).toBeVisible();
    expect(screen.getByText(/10:00 SAST.*16:00 SAST/)).toHaveClass("sr-only");
    expect(screen.queryByText("/month")).not.toBeInTheDocument();
    expect(container.querySelector('[data-slot="discovery-card-media"]')).toBeNull();
  });

  it("keeps Services phone and map actions independent and permits full descriptions", () => {
    const select = vi.fn();
    const description = "A detailed service description. ".repeat(20);
    render(<ServiceFeedCard item={{ ...service, content: { ...service.content, description } }} onShowOnMap={select} />);
    expect(screen.getByText("Plumbing")).toBeVisible();
    expect(screen.getByText(service.content.providerName)).toBeVisible();
    expect(screen.getByRole("link", { name: "Call" })).toHaveAttribute("href", "tel:+27215550100");
    fireEvent.click(screen.getByRole("button", { name: "Read full description" }));
    expect(screen.getByRole("button", { name: "Show less" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(description.trim())).toBeVisible();
    expect(select).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Show on map" }));
    expect(select).toHaveBeenCalledOnce();
  });
  it("uses Property's ordered gallery and reserved media space for Services", () => {
    const media = [{ id: areaId, url: "https://example.com/first.jpg" }, { id, url: "https://example.com/second.jpg" }];
    const { container, rerender } = render(<ServiceFeedCard item={{ ...service, media }} distance="1.2 km away" />);
    expect(screen.getAllByRole("img").map(image => image.getAttribute("data-src"))).toEqual(media.map(image => image.url));
    expect(screen.getByText("10 Fixture Road · 1.2 km away")).toBeVisible();
    expect(container.querySelector('[data-slot="discovery-card-media"]')).toBeInTheDocument();
    rerender(<ServiceFeedCard item={service} />);
    expect(container.querySelector('[data-slot="discovery-card-media"]')).toBeInTheDocument(); expect(screen.queryAllByRole("img")).toHaveLength(0);
  });
});
