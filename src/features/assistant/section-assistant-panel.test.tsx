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
  const input = screen.getByRole("textbox", { name: "Message Piko" });
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
    expect(screen.getByRole("dialog", { name: "Piko" })).toHaveTextContent("Services");
    expect(replyLabels()).toEqual(["Plumber", "Cleaner", "Open now"]);
    expect(screen.getByRole("status")).toHaveTextContent("Wait, I found something! 7 matches in this map area.");
  });

  it("should_say_calmly_when_nothing_matches_in_the_map_area", () => {
    render(<SectionAssistantPanel category="service" onClose={vi.fn()} resultCount={0} />);
    expect(screen.getByRole("status")).toHaveTextContent("I couldn't find anything that matches here.");
    expect(screen.getByRole("status")).not.toHaveTextContent("Wait, I found something!");
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

describe("SectionAssistantPanel asked about one item", () => {
  const special = {
    kind: "special" as const,
    id: "s1",
    title: "Two burgers for one",
    by: "Mzansi Grill",
    address: "12 Main Road, Rondebosch",
    startsAt: "2026-11-20T08:00:00Z",
    endsAt: "2099-11-24T15:00:00Z",
    priceCents: 8900,
    originalPriceCents: 17800,
    conditions: "Dine-in only.",
  };

  it("should_name_the_item_and_offer_its_preset_questions", () => {
    render(<SectionAssistantPanel category="shopping" onClose={vi.fn()} openItem={special} />);
    expect(screen.getByRole("dialog", { name: "Piko" })).toHaveTextContent("Two burgers for one");
    expect(replyLabels()).toEqual(["How much is it?", "When does it end?", "Where is it?", "Any conditions?"]);
  });

  it("should_answer_a_preset_question_from_the_item_without_changing_the_search", () => {
    render(<SectionAssistantPanel category="shopping" onClose={vi.fn()} openItem={special} />);
    const before = window.location.search;
    fireEvent.click(within(replies()).getByRole("button", { name: "How much is it?" }));
    expect(conversation()).toHaveTextContent("How much is it?");
    expect(within(conversation()).getByRole("region", { name: "Item fact" })).toHaveTextContent("R89, down from R178 (50% off).");
    expect(window.location.search).toBe(before);
  });

  it("should_answer_a_typed_question_and_say_so_when_the_item_does_not_say", () => {
    render(<SectionAssistantPanel category="shopping" onClose={vi.fn()} openItem={{ ...special, conditions: undefined }} />);
    ask("any t&cs?");
    expect(within(conversation()).getByRole("region", { name: "Item fact" })).toHaveTextContent("The special doesn't say. Mzansi Grill can tell you.");
  });

  it("should_still_search_when_the_person_types_a_search", () => {
    render(<SectionAssistantPanel category="service" onClose={vi.fn()} openItem={{ kind: "service", id: "v1", title: "Taps fixed", by: "Sipho", address: "Bellville", serviceType: "Plumbing" }} />);
    ask("cleaner");
    expect(search().get("serviceType")).toBe("Cleaning");
  });
});

describe("SectionAssistantPanel top results", () => {
  const plumber = (id: string, title: string) => ({ kind: "service" as const, id, title, by: `${title} Co`, address: "Bellville", serviceType: "Plumbing", priceFromCents: 35000, priceUnit: "job" as const });
  const picks = [plumber("v1", "Taps fixed"), plumber("v2", "Geysers"), plumber("v3", "Drains"), plumber("v4", "Pipes")];
  const topPicks = () => screen.getByRole("region", { name: "Top picks" });

  it("should_show_the_top_three_results_as_cards_with_what_they_offer", () => {
    render(<SectionAssistantPanel category="service" onClose={vi.fn()} resultCount={4} topPicks={picks} onOpenItem={vi.fn()} />);
    const cards = within(topPicks()).getAllByRole("button");
    expect(cards).toHaveLength(3);
    expect(cards[0]).toHaveTextContent("Taps fixed");
    expect(cards[0]).toHaveTextContent("Taps fixed Co");
    expect(cards[0]).toHaveTextContent("Plumbing · From R350 per job");
    expect(topPicks()).toHaveTextContent("The full list stays in the results.");
    expect(screen.getByRole("status")).toHaveTextContent("Wait, I found something! 4 matches in this map area.");
  });

  it("should_open_a_result_when_its_card_is_tapped", () => {
    const onOpenItem = vi.fn();
    render(<SectionAssistantPanel category="service" onClose={vi.fn()} resultCount={4} topPicks={picks} onOpenItem={onOpenItem} />);
    fireEvent.click(within(topPicks()).getByRole("button", { name: /Geysers/ }));
    expect(onOpenItem).toHaveBeenCalledWith("v2");
  });

  it("should_show_the_results_under_the_latest_search", () => {
    render(<SectionAssistantPanel category="service" onClose={vi.fn()} resultCount={4} topPicks={picks} onOpenItem={vi.fn()} />);
    ask("plumber");
    ask("open now");
    const log = conversation();
    const searches = within(log).getAllByRole("list", { name: "Searching for" });
    const last = searches.at(-1)!;
    expect(last.compareDocumentPosition(topPicks()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(searches[0]!.compareDocumentPosition(within(log).getByText("open now")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(log).getByText("open now").compareDocumentPosition(topPicks()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("should_show_no_cards_when_nothing_matches", () => {
    render(<SectionAssistantPanel category="service" onClose={vi.fn()} resultCount={0} topPicks={[]} onOpenItem={vi.fn()} />);
    expect(screen.queryByRole("region", { name: "Top picks" })).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("I couldn't find anything that matches here.");
  });

  it("should_leave_the_results_out_while_an_item_is_open", () => {
    render(<SectionAssistantPanel category="service" onClose={vi.fn()} resultCount={4} topPicks={picks} onOpenItem={vi.fn()} openItem={picks[0]} />);
    expect(screen.queryByRole("region", { name: "Top picks" })).toBeNull();
  });
});

describe("SectionAssistantPanel no-results rescue", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/?section=event&quick=tonight,free&q=jazz");
  });

  it("should_offer_the_change_that_finds_the_most_and_apply_it", async () => {
    const countMatches = vi.fn(async (next: { quick: string[]; text: string }) => (next.quick.includes("tonight") && next.text ? 0 : next.text ? 1 : 6));
    render(<SectionAssistantPanel category="event" onClose={vi.fn()} resultCount={0} countMatches={countMatches} />);
    const rescue = await screen.findByRole("region", { name: "Try this" });
    expect(rescue).toHaveTextContent("6 matches without “jazz”.");
    fireEvent.click(within(rescue).getByRole("button", { name: "Apply" }));
    settle();
    expect(search().get("q")).toBeNull();
    expect(search().get("quick")?.split(",").sort()).toEqual(["free", "tonight"]);
    expect(within(conversation()).getAllByRole("list", { name: "Searching for" }).at(-1)).not.toHaveTextContent("jazz");
  });

  it("should_say_nothing_more_when_no_change_finds_anything", async () => {
    const countMatches = vi.fn(async () => 0);
    render(<SectionAssistantPanel category="event" onClose={vi.fn()} resultCount={0} countMatches={countMatches} />);
    await act(async () => {});
    expect(countMatches).toHaveBeenCalledTimes(3);
    expect(screen.queryByRole("region", { name: "Try this" })).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("I couldn't find anything that matches here.");
  });

  it("should_not_look_for_a_rescue_when_there_are_results", async () => {
    const countMatches = vi.fn(async () => 9);
    render(<SectionAssistantPanel category="event" onClose={vi.fn()} resultCount={2} countMatches={countMatches} />);
    await act(async () => {});
    expect(countMatches).not.toHaveBeenCalled();
  });
});

describe("SectionAssistantPanel tip", () => {
  const item = { kind: "service" as const, id: "v1", title: "Taps fixed", by: "Sipho", address: "Bellville", serviceType: "Plumbing" };

  it("should_open_on_an_item_with_its_tip", () => {
    render(<SectionAssistantPanel category="service" onClose={vi.fn()} openItem={item} openItemTip="New this week" />);
    expect(within(conversation()).getByRole("note", { name: "Piko's tip" })).toHaveTextContent("New this week");
  });

  it("should_not_show_a_tip_without_an_open_item", () => {
    render(<SectionAssistantPanel category="service" onClose={vi.fn()} openItemTip="New this week" />);
    expect(screen.queryByRole("note", { name: "Piko's tip" })).toBeNull();
  });
});
