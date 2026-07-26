// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/presence/availability-toggle", () => ({
  AvailabilityToggle: () => <div>Availability control</div>,
}));

vi.mock("@/features/live-tours/go-live-button", () => ({
  LiveTourControls: () => <div>Live tour controls</div>,
}));

import { InstantConnectPublisher } from "./instant-connect-publisher";

describe("InstantConnectPublisher", () => {
  afterEach(cleanup);

  it("explains earned renter signals without unlocking tours on a draft", () => {
    render(
      <InstantConnectPublisher
        availabilityMode="auto"
        listingId="listing-1"
        listingStatus="draft"
      />,
    );

    expect(screen.getByText("Available now")).toBeTruthy();
    expect(screen.getByText("Instant viewing")).toBeTruthy();
    expect(screen.getByText("Replies under 5 minutes")).toBeTruthy();
    expect(screen.getByText(/Publish this listing to unlock live tours/i)).toBeTruthy();
    expect(screen.queryByText("Live tour controls")).toBeNull();
  });

  it("exposes live-tour controls for a published listing", () => {
    render(
      <InstantConnectPublisher
        availabilityMode="available"
        listingId="listing-1"
        listingStatus="published"
      />,
    );

    expect(screen.getByText("Live tour controls")).toBeTruthy();
  });
});
