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

const replies = () => screen.getByRole("list", { name: "Suggested replies" });
const replyLabels = () => within(replies()).getAllByRole("button").map((button) => button.textContent);
const conversation = () => screen.getByRole("log", { name: "Conversation" });

function ask(text: string) {
  const input = screen.getByRole("textbox", { name: "Message the assistant" });
  fireEvent.change(input, { target: { value: text } });
  fireEvent.submit(input.closest("form")!);
  settle();
}

beforeEach(() => {
  window.sessionStorage.clear();
  window.history.replaceState(null, "", "/?section=service&west=18&south=-34&east=19&north=-33");
});

afterEach(() => {
  cleanup();
});

describe("SectionAssistantPanel chat", () => {
  it("should_offer_the_section's_starters_as_suggested_replies_and_say_how_many_match", () => {
    render(<SectionAssistantPanel category="service" onClose={vi.fn()} resultCount={7} />);
    expect(screen.getByRole("dialog", { name: "Pinpoint Assistant" })).toHaveTextContent("Services");
    expect(replyLabels()).toEqual(["Plumber", "Cleaner", "Open now"]);
    expect(screen.getByRole("status")).toHaveTextContent("7 matches in this map area.");
  });

  it("should_write_typed_requests_into_the_address_and_keep_the_map_area", () => {
    render(<SectionAssistantPanel category="service" onClose={vi.fn()} />);
    ask("plumber open now");
    expect(search().get("serviceType")).toBe("Plumbing");
    expect(search().get("quick")).toBe("open-now");
    expect(search().get("west")).toBe("18");
    expect(within(conversation()).getByText("plumber open now")).toBeInTheDocument();
    expect(within(conversation()).getByRole("list", { name: "Searching for" })).toHaveTextContent("Plumbing");
    expect(within(screen.getByRole("list", { name: "Current search" })).getByRole("button", { name: "Remove Plumbing" })).toBeInTheDocument();
  });

  it("should_strip_contact_details_from_typed_text", () => {
    render(<SectionAssistantPanel category="shopping" onClose={vi.fn()} />);
    ask("pizza call 082 555 1234");
    expect(window.location.search).not.toContain("555");
    expect(conversation()).not.toHaveTextContent("555");
    expect(JSON.stringify(window.sessionStorage)).not.toContain("555");
  });

  it("should_add_several_quick_filters_from_replies_and_remove_one_from_the_current_search", () => {
    window.history.replaceState(null, "", "/?section=event");
    render(<SectionAssistantPanel category="event" onClose={vi.fn()} />);
    ask("tonight");
    expect(replyLabels()).not.toContain("Tonight");
    fireEvent.click(within(replies()).getByRole("button", { name: "Free" }));
    settle();
    expect(search().get("quick")?.split(",").sort()).toEqual(["free", "tonight"]);
    fireEvent.click(screen.getByRole("button", { name: "Remove Tonight" }));
    settle();
    expect(search().get("quick")).toBe("free");
  });

  it("should_keep_each_section's_conversation_for_the_visit", () => {
    const first = render(<SectionAssistantPanel category="service" onClose={vi.fn()} />);
    ask("plumber");
    first.unmount();
    render(<SectionAssistantPanel category="service" onClose={vi.fn()} />);
    expect(within(conversation()).getByText("plumber")).toBeInTheDocument();
    cleanup();
    render(<SectionAssistantPanel category="event" onClose={vi.fn()} />);
    expect(within(conversation()).queryByText("plumber")).toBeNull();
  });

  it("should_close_on_escape", () => {
    const onClose = vi.fn();
    render(<SectionAssistantPanel category="tourism" onClose={onClose} />);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});
