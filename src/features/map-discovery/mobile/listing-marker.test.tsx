// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { ListingMarker } from "./listing-marker";

afterEach(cleanup);

describe("ListingMarker", () => {
  it("shows only the price while retaining the area in its accessible name", () => {
    render(
      <ListingMarker
        title="Sandton apartment"
        price="R14.1k"
        area="20 N Division Street, Sandton, Johannesburg"
      />,
    );

    expect(screen.getByText("R14.1k")).toBeInTheDocument();
    expect(screen.queryByText("20 N Division Street")).not.toBeInTheDocument();
    expect(screen.queryByText("Sandton, Johannesburg")).not.toBeInTheDocument();
    expect(screen.getByRole("button")).toHaveAccessibleName(
      "Sandton apartment - R14.1k in 20 N Division Street, Sandton, Johannesburg",
    );
  });

  it("renders a neutral dot without a visible price in density mode", () => {
    render(
      <ListingMarker
        title="City apartment"
        price="R9.5k"
        area="12 Market Street"
        displayMode="dot"
      />,
    );

    expect(screen.queryByText("R9.5k")).not.toBeInTheDocument();
    expect(screen.queryByText("12 Market Street")).not.toBeInTheDocument();
    expect(screen.getByRole("button")).toHaveAccessibleName(
      "City apartment - R9.5k in 12 Market Street",
    );
  });

  it("announces the live-tour marker state without relying on colour", () => {
    render(
      <ListingMarker
        title="Live Sandton tour"
        price="R12k"
        liveState="live-tour"
      />,
    );

    expect(screen.getByRole("button")).toHaveAccessibleName(
      "Live Sandton tour - R12k, live video tour happening now",
    );
  });

  it("keeps a live home readable when other pins are density dots", () => {
    render(<ListingMarker title="Live tour" price="R12k" liveState="live-tour" displayMode="dot" />);

    expect(screen.getByText("R12k")).toBeInTheDocument();
    expect(screen.getByText("Live")).toBeInTheDocument();
  });

  it("marks the available landlord with a visible status dot", () => {
    const { container } = render(<ListingMarker title="Home" price="R12k" liveState="available" />);

    expect(container.querySelector("[data-pin-status='available']")).toHaveClass("bg-[var(--pin-available)]");
  });

  it("shows bedrooms, distance and the saving once the pin has room", () => {
    render(<ListingMarker title="Home" price="R9k" displayMode="details" beds={2} distance="1.2 km" belowNearbyPercent={12} />);

    expect(screen.getByText("2 bed · 1.2 km")).toBeInTheDocument();
    expect(screen.getByText("12% below nearby")).toBeInTheDocument();
    expect(screen.getByRole("button")).toHaveAccessibleName("Home - R9k, 2 bed, 1.2 km from you, 12% below nearby");
  });

  it("shortens the saving at neighbourhood zoom", () => {
    render(<ListingMarker title="Home" price="R9k" belowNearbyPercent={12} />);

    expect(screen.getByText("↓12%")).toBeInTheDocument();
    expect(screen.queryByText("12% below nearby")).not.toBeInTheDocument();
  });

  it("pulses only when the map grants this pin motion", () => {
    const { container, rerender } = render(<ListingMarker title="Home" price="R9k" liveState="live-tour" />);
    expect(container.querySelector(".map-pin-pulse")).not.toBeInTheDocument();

    rerender(<ListingMarker title="Home" price="R9k" liveState="live-tour" animated />);
    expect(container.querySelector(".map-pin-pulse")).toBeInTheDocument();
  });

  it("previews for pointer hover and focus but ignores touch hover", () => {
    const onPreviewChange = vi.fn();
    render(
      <ListingMarker
        title="Gardens apartment"
        price="R11k"
        onPreviewChange={onPreviewChange}
      />,
    );

    const marker = screen.getByRole("button");
    fireEvent.pointerEnter(marker, { pointerType: "touch" });
    expect(onPreviewChange).not.toHaveBeenCalled();

    fireEvent.pointerEnter(marker, { pointerType: "mouse" });
    fireEvent.pointerLeave(marker, { pointerType: "mouse" });
    fireEvent.focus(marker);
    fireEvent.blur(marker);
    expect(onPreviewChange.mock.calls).toEqual([[true], [false], [true], [false]]);
  });
});
