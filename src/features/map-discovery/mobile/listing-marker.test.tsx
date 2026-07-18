// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { ListingMarker } from "./listing-marker";

afterEach(cleanup);

describe("ListingMarker", () => {
  it("shows the street and remaining address beneath the price", () => {
    render(
      <ListingMarker
        title="Sandton apartment"
        price="R14.1k"
        area="20 N Division Street, Sandton, Johannesburg"
      />,
    );

    expect(screen.getByText("R14.1k")).toBeInTheDocument();
    expect(screen.getByText("20 N Division Street")).toBeInTheDocument();
    expect(screen.getByText("Sandton, Johannesburg")).toBeInTheDocument();
    expect(screen.getByRole("button")).toHaveAccessibleName(
      "Sandton apartment - R14.1k in 20 N Division Street, Sandton, Johannesburg",
    );
  });

  it("still shows a single-line address when no locality is available", () => {
    render(
      <ListingMarker
        title="City apartment"
        price="R9.5k"
        area="12 Market Street"
      />,
    );

    expect(screen.getByText("12 Market Street")).toBeInTheDocument();
    expect(screen.queryByText(/undefined/i)).not.toBeInTheDocument();
  });
});
