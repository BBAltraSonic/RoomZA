// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DiscoveryLocationAction } from "./location-action";
import { DiscoveryDescription } from "./discovery-description";
import { LocationSelector } from "@/features/map-discovery/location-selector";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Discovery actions", () => {
  it("opens the existing location chooser from the first-visit action and supports Escape", () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    render(<><LocationSelector idPrefix="start" onSelect={vi.fn()} /><DiscoveryLocationAction idPrefix="start" /></>);
    fireEvent.click(screen.getByRole("button", { name: "Choose location" }));
    const input = screen.getByRole("combobox", { name: "Search South African locations" });
    expect(input).toHaveFocus();
    expect(fetcher).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Location: Choose a location" })).toHaveFocus();
  });

  it("distinguishes a map viewport from a selected place", () => {
    const ui = render(<LocationSelector idPrefix="area" viewingArea="Cape Town Ward 114" onSelect={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Map area: Cape Town Ward 114/ })).toHaveTextContent("Map area");
    ui.rerender(<LocationSelector idPrefix="area" viewingArea="Cape Town Ward 114" selectedLocation="Rondebosch" onSelect={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Location: Rondebosch" })).toHaveTextContent("Rondebosch");
  });

  it("keeps a long description available without overwhelming the result card", () => {
    const text = "An experience worth exploring. ".repeat(30) + "Final booking detail.";
    render(<DiscoveryDescription text={text} />);
    expect(screen.queryByText(text)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Read full description" }));
    expect(screen.getByText(text)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Show less" }));
    expect(screen.queryByText(text)).not.toBeInTheDocument();
  });
});
