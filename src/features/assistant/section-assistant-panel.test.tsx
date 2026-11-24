// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

import { SectionAssistantPanel } from "./section-assistant-panel";

function search() {
  return new URLSearchParams(window.location.search);
}

/** The discovery page re-reads the address after a change; the panel follows the same event. */
function settle() {
  act(() => {
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
}

beforeEach(() => {
  window.history.replaceState(null, "", "/?section=service&west=18&south=-34&east=19&north=-33");
});

afterEach(() => {
  cleanup();
});

describe("SectionAssistantPanel", () => {
  it("should_offer_the_section's_starters_and_quick_filters", () => {
    render(<SectionAssistantPanel category="service" onClose={vi.fn()} resultCount={7} />);
    expect(within(screen.getByRole("list", { name: "Try asking" })).getAllByRole("button").map((button) => button.textContent)).toEqual(["Plumber", "Cleaner", "Open now"]);
    expect(within(screen.getByRole("list", { name: "Quick filters" })).getAllByRole("button").map((button) => button.textContent)).toEqual(["Open now", "Below nearby price"]);
    expect(screen.getByRole("status")).toHaveTextContent("7 matches in this map area.");
  });

  it("should_write_typed_requests_into_the_address_and_keep_the_map_area", () => {
    render(<SectionAssistantPanel category="service" onClose={vi.fn()} />);
    const input = screen.getByRole("textbox", { name: "What services are you looking for?" });
    fireEvent.change(input, { target: { value: "plumber open now" } });
    fireEvent.submit(input.closest("form")!);
    settle();
    expect(search().get("serviceType")).toBe("Plumbing");
    expect(search().get("quick")).toBe("open-now");
    expect(search().get("west")).toBe("18");
    expect(screen.getByRole("button", { name: "Remove Plumbing" })).toBeInTheDocument();
  });

  it("should_strip_contact_details_from_typed_text", () => {
    render(<SectionAssistantPanel category="shopping" onClose={vi.fn()} />);
    const input = screen.getByRole("textbox", { name: "What specials are you looking for?" });
    fireEvent.change(input, { target: { value: "pizza call 082 555 1234" } });
    fireEvent.submit(input.closest("form")!);
    settle();
    expect(window.location.search).not.toContain("555");
  });

  it("should_toggle_several_quick_filters_at_once_and_remove_one", () => {
    window.history.replaceState(null, "", "/?section=event");
    render(<SectionAssistantPanel category="event" onClose={vi.fn()} />);
    fireEvent.click(within(screen.getByRole("list", { name: "Quick filters" })).getByRole("button", { name: "Tonight" }));
    settle();
    fireEvent.click(within(screen.getByRole("list", { name: "Quick filters" })).getByRole("button", { name: "Free" }));
    settle();
    expect(search().get("quick")?.split(",").sort()).toEqual(["free", "tonight"]);
    fireEvent.click(screen.getByRole("button", { name: "Remove Tonight" }));
    settle();
    expect(search().get("quick")).toBe("free");
  });

  it("should_close_on_escape", () => {
    const onClose = vi.fn();
    render(<SectionAssistantPanel category="tourism" onClose={onClose} />);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});
