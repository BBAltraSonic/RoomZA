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
