// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

import { pikoLine } from "@/features/piko/lines";

import { AssistantPanel, type AssistantListing } from "./assistant-panel";

const fetchMock = vi.fn();
// Memory sync has its own endpoint; signed-out visitors get 401 and memory stays on the device.
const memoryFetch = vi.fn(async () => new Response(JSON.stringify({ ok: false }), { status: 401 }));

function setup(query = "", overrides: Partial<Parameters<typeof AssistantPanel>[0]> = {}) {
  const onSearchChange = vi.fn();
  const onOpenListing = vi.fn();
  const onClose = vi.fn();
  const view = render(
    <AssistantPanel
      open
      onClose={onClose}
      listingMode="rent"
      searchParams={new URLSearchParams(query)}
      onSearchChange={onSearchChange}
      resultCount={12}
      topPicks={[]}
      onOpenListing={onOpenListing}
      {...overrides}
    />,
  );
  const lastQuery = () => {
    const calls = onSearchChange.mock.calls;
    return (calls.at(-1)?.[0] as URLSearchParams | undefined)?.toString() ?? null;
  };
  return { view, onSearchChange, onOpenListing, onClose, lastQuery };
}

async function ask(text: string) {
  const input = screen.getByRole("textbox", { name: "Message Piko" });
  fireEvent.change(input, { target: { value: text } });
  await act(async () => {
    fireEvent.submit(input.closest("form")!);
  });
}

const conversation = () => screen.getByRole("log", { name: "Conversation" });
const replies = () => screen.getByRole("list", { name: "Suggested replies" });
const replyLabels = () => within(replies()).getAllByRole("button").map((button) => button.textContent);

const openListing = {
  id: "l1", title: "Sunny room", listing_type: "rent" as const, price: 3800, bedrooms: 1, bathrooms: 1,
  parking_type: "covered", parking_count: 1, parking_included: true, electricity_type: "prepaid",
  water_availability: "municipal", lease_duration: "12_months", availability_date: null, metadata: null,
};

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  fetchMock.mockReset();
  memoryFetch.mockClear();
  vi.stubGlobal("fetch", (url: string, init?: RequestInit) =>
    String(url).startsWith("/api/assistant/memory") ? memoryFetch() : fetchMock(url, init));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("AssistantPanel chat", () => {
  it("should_open_with_a_welcome_card_and_the_rentals_starters_as_suggested_replies", () => {
    setup();
    expect(screen.getByRole("dialog", { name: "Piko" })).toHaveTextContent("Homes to rent");
    expect(screen.getByRole("region", { name: "Welcome" })).toBeInTheDocument();
    expect(replyLabels()).toEqual(["Rooms near campus", "NSFAS approved", "Under R4,000", "Furnished"]);
  });

  it("should_show_what_was_typed_and_what_pinpoint_searched_for_without_calling_the_server", async () => {
    const { lastQuery } = setup("view=map");
    await ask("Furnished room under R4,000 near UWC, NSFAS approved");
    expect(fetchMock).not.toHaveBeenCalled();
    const params = new URLSearchParams(lastQuery()!);
    expect(params.get("view")).toBe("map");
    expect(params.get("maxPrice")).toBe("4000");
    expect(params.get("q")).toBe("UWC");
    expect(params.get("quick")).toBe("furnished,nsfas-approved");
    const log = conversation();
    expect(within(log).getByText("Furnished room under R4,000 near UWC, NSFAS approved")).toBeInTheDocument();
    expect(within(log).getByRole("list", { name: "Searching for" })).toHaveTextContent("≤ R4,000");
  });

  it("should_pin_the_current_search_with_chips_that_can_be_removed", () => {
    const { lastQuery } = setup("maxPrice=4000&type=room");
    const pinned = screen.getByRole("list", { name: "Current search" });
    expect(within(pinned).getByText("≤ R4,000")).toBeInTheDocument();
    fireEvent.click(within(pinned).getByRole("button", { name: "Remove Room" }));
    expect(lastQuery()).toBe("maxPrice=4000");
  });

  it("should_show_grey_chips_for_things_pinpoint_cannot_search_yet", async () => {
    setup();
    await ask("room with pets");
    expect(within(conversation()).getByText("Pets: can't search this yet")).toBeInTheDocument();
  });

  it("should_offer_quick_filters_as_replies_once_searching_and_add_several", () => {
    const { lastQuery } = setup("quick=furnished");
    expect(replyLabels()).not.toContain("Furnished");
    fireEvent.click(within(replies()).getByRole("button", { name: "NSFAS approved" }));
    expect(lastQuery()).toBe("quick=furnished%2Cnsfas-approved");
    expect(within(conversation()).getByText("NSFAS approved", { selector: "span" })).toBeInTheDocument();
  });

  it("should_hide_nsfas_when_buying", () => {
    setup("mode=buy&type=house", { listingMode: "buy" });
    expect(replyLabels()).not.toContain("NSFAS approved");
  });

  it("should_say_english_only_in_the_conversation", async () => {
    setup();
    await ask("Ek soek 'n kamer naby die kampus");
    expect(conversation()).toHaveTextContent("I can only understand English for now.");
    // Piko says it with the face for that note's mood.
    expect(conversation().querySelector('[data-piko-mood="thinking"]')).not.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("should_ask_the_server_for_words_the_rules_cannot_place_and_apply_its_answer", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      data: { query: "maxPrice=3000&type=room", gaps: [], source: "ai", notEnglish: false, remaining: 9 },
    })));
    const { lastQuery, onSearchChange } = setup("type=room");
    await ask("something cosy, call me on 082 123 4567");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/assistant/search");
    const body = JSON.parse(String(init.body));
    expect(body.text).not.toContain("082");
    expect(body.current).toBe("type=room");
    expect(lastQuery()).toBe("maxPrice=3000&type=room");
    // The rules' result adds a Back step; the AI's refinement of it replaces that step.
    expect(onSearchChange.mock.calls.map(([, options]) => options)).toEqual([{ replace: false }, { replace: true }]);
    expect(within(conversation()).getByRole("list", { name: "Searching for" })).toHaveTextContent("≤ R3,000");
    // Contact details never reach the thread kept for the visit either.
    expect(JSON.stringify(window.sessionStorage)).not.toContain("082");
  });

  it("should_keep_working_when_the_daily_allowance_is_used", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      data: { query: "quick=furnished", gaps: [], source: "rules", notEnglish: false, notice: "allowance_used" },
    })));
    setup();
    await ask("cosy furnished place");
    expect(conversation()).toHaveTextContent("today's AI searches");
  });

  it("should_show_top_picks_with_a_why_it_matches_line", () => {
    const picks: AssistantListing[] = [{
      id: "l1", title: "Sunny room", area: "Bellville", priceValue: 3800, beds: 1, furnished: true,
      nsfasApproved: false, propertyType: "room",
    }];
    const { onOpenListing } = setup("maxPrice=4000&quick=furnished", { topPicks: picks });
    const card = screen.getByRole("button", { name: /^Sunny room/ });
    expect(card).toHaveTextContent("R3,800, under your R4,000 · Furnished");
    fireEvent.click(card);
    expect(onOpenListing).toHaveBeenCalledWith("l1");
  });

  it("should_keep_the_conversation_for_the_visit_but_remember_only_chips", async () => {
    const first = setup();
    await ask("furnished room");
    first.view.unmount();
    setup();
    expect(within(conversation()).getByText("furnished room")).toBeInTheDocument();
    expect(window.localStorage.getItem("pinpoint:assistant-memory:v1")).not.toContain("furnished room");
  });

  it("should_welcome_back_and_resume_a_remembered_search_on_a_new_visit", async () => {
    const first = setup();
    await ask("furnished room");
    first.view.unmount();
    window.sessionStorage.clear();
    const { lastQuery } = setup("view=map");
    expect(screen.getByText(pikoLine("welcome_back"))).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Resume" }));
    expect(new URLSearchParams(lastQuery()!).get("quick")).toBe("furnished");
  });

  it("should_start_a_new_chat_on_request", async () => {
    setup();
    await ask("furnished room");
    fireEvent.click(screen.getByRole("button", { name: "New chat" }));
    expect(within(conversation()).queryByText("furnished room")).toBeNull();
    expect(window.sessionStorage.getItem("pinpoint:assistant-thread:v1:homes")).toBeNull();
  });

  it("should_forget_everything_on_request", async () => {
    setup();
    await ask("furnished room");
    fireEvent.click(screen.getByRole("button", { name: "What I remember" }));
    fireEvent.click(screen.getByRole("button", { name: "Forget everything" }));
    expect(window.localStorage.getItem("pinpoint:assistant-memory:v1")).toBeNull();
    expect(screen.getByText("Nothing remembered yet.")).toBeInTheDocument();
  });

  it("should_answer_a_question_about_the_open_listing_from_its_fields_without_ai", async () => {
    const { onSearchChange } = setup("type=room", { openListing });
    expect(screen.getByRole("dialog", { name: "Piko" })).toHaveTextContent("Sunny room");
    await ask("Does it have parking?");
    const fact = within(conversation()).getByRole("region", { name: "Listing fact" });
    expect(fact).toHaveTextContent("Yes: 1 covered parking bay, included in the rent.");
    expect(fact).toHaveTextContent("From the listing.");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(onSearchChange).not.toHaveBeenCalled();
  });

  it("should_offer_preset_questions_about_the_open_listing_and_answer_them_from_its_fields", () => {
    const { onSearchChange } = setup("type=room", { openListing });
    expect(replyLabels()).toEqual(["Is there parking?", "Are pets allowed?", "How much is the deposit?", "When can I move in?"]);
    fireEvent.click(within(screen.getByRole("list", { name: "Suggested replies" })).getByRole("button", { name: "Is there parking?" }));
    expect(conversation()).toHaveTextContent("Is there parking?");
    expect(within(conversation()).getByRole("region", { name: "Listing fact" })).toHaveTextContent("Yes: 1 covered parking bay, included in the rent.");
    expect(onSearchChange).not.toHaveBeenCalled();
  });

  it("should_open_the_contact_sheet_when_the_listing_does_not_say", async () => {
    const opened = vi.fn();
    window.addEventListener("pinpoint:open-contact", opened);
    setup("", { openListing: { ...openListing, parking_type: "none", parking_count: 0, parking_included: null } });
    await ask("Are pets allowed?");
    const fact = within(conversation()).getByRole("region", { name: "Listing fact" });
    expect(fact).toHaveTextContent("The listing doesn't say.");
    fireEvent.click(within(fact).getByRole("button", { name: "Ask landlord" }));
    expect((opened.mock.calls[0]?.[0] as CustomEvent).detail).toEqual({ listingId: "l1" });
    window.removeEventListener("pinpoint:open-contact", opened);
  });

  it("should_put_message_the_landlord_by_the_message_box_when_a_listing_is_open", () => {
    const opened = vi.fn();
    window.addEventListener("pinpoint:open-contact", opened);
    setup("", { openListing });
    fireEvent.click(screen.getByRole("button", { name: "Message landlord" }));
    expect((opened.mock.calls[0]?.[0] as CustomEvent).detail).toEqual({ listingId: "l1" });
    window.removeEventListener("pinpoint:open-contact", opened);
  });

  it("should_not_show_message_buttons_for_a_search_alone", () => {
    setup("type=room");
    expect(screen.queryByRole("button", { name: /^Message (landlord|the seller)$/ })).toBeNull();
  });

  it("should_compare_two_top_picks_side_by_side_in_the_conversation", async () => {
    const picks: AssistantListing[] = [
      { id: "a", title: "Room A", area: "Bellville", priceValue: 3800, beds: 1, furnished: true, nsfasApproved: false, propertyType: "room" },
      { id: "b", title: "Room B", area: "Bellville", priceValue: 3500, beds: 2, furnished: false, nsfasApproved: false, propertyType: "room" },
    ];
    const detail = (id: string, price: number, bedrooms: number) => ({
      id, title: `Room ${id.toUpperCase()}`, listing_type: "rent", price, display_price: price, bedrooms, bathrooms: 1,
      parking_type: "none", parking_count: 0, electricity_type: "prepaid", water_availability: "municipal",
      lease_duration: "12_months", availability_date: null, metadata: null,
    });
    fetchMock.mockImplementation(async (url: string) => {
      const id = url.split("/").pop()!;
      return new Response(JSON.stringify({ ok: true, data: id === "a" ? detail("a", 3800, 1) : detail("b", 3500, 2) }));
    });
    setup("type=room", { topPicks: picks });
    fireEvent.click(screen.getByRole("button", { name: "Compare Room A" }));
    expect(screen.getByRole("button", { name: "Compare 1" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Compare Room B" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Compare 2" }));
    });
    const table = await within(conversation()).findByRole("table");
    expect(within(table).getByRole("row", { name: /Price/ })).toHaveTextContent("R3,800 a monthR3,500 a month (best)");
  });

  it("should_offer_a_higher_budget_when_few_homes_match", async () => {
    const countMatches = vi.fn(async () => 9);
    const { lastQuery } = setup("maxPrice=4000&type=room", { resultCount: 2, countMatches });
    const relax = await screen.findByRole("region", { name: "Relax suggestion" });
    expect(relax).toHaveTextContent("7 more if you go to R4,500");
    expect(countMatches).toHaveBeenCalledWith("maxPrice=4500&type=room");
    fireEvent.click(within(relax).getByRole("button", { name: "Yes" }));
    expect(new URLSearchParams(lastQuery()!).get("maxPrice")).toBe("4500");
  });

  it("should_save_the_search_and_list_it_in_what_i_remember", () => {
    setup("maxPrice=4000&type=room");
    fireEvent.click(screen.getByRole("button", { name: "Save search" }));
    expect(screen.getByRole("button", { name: "Saved" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "What I remember" }));
    expect(screen.getByText("Saved searches")).toBeInTheDocument();
  });

  it("should_close_on_escape", () => {
    const { onClose } = setup();
    fireEvent.keyDown(screen.getByRole("dialog", { name: "Piko" }), { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});

describe("AssistantPanel welcome back with new matches", () => {
  async function remember() {
    const first = setup();
    await ask("furnished room");
    first.view.unmount();
    window.sessionStorage.clear();
  }

  it("should_say_how_many_new_places_match_the_last_search", async () => {
    await remember();
    const countNewMatches = vi.fn(async () => 3);
    setup("view=map", { countNewMatches });
    expect(await screen.findByText("Welcome back. 3 new places match your last search.")).toBeInTheDocument();
    const [query, since] = countNewMatches.mock.calls[0] as unknown as [string, string];
    expect(new URLSearchParams(query).get("quick")).toBe("furnished");
    expect(Number.isFinite(Date.parse(since))).toBe(true);
    expect(screen.getByRole("button", { name: "Resume" })).toBeInTheDocument();
  });

  it("should_use_the_plain_welcome_back_line_when_nothing_is_new", async () => {
    await remember();
    setup("view=map", { countNewMatches: vi.fn(async () => 0) });
    await act(async () => {});
    expect(screen.getByText(pikoLine("welcome_back"))).toBeInTheDocument();
    expect(screen.queryByText(/new places? match/)).toBeNull();
  });
});

describe("AssistantPanel tip", () => {
  it("should_open_on_a_listing_with_its_tip", () => {
    setup("", { openListing, openTip: "R600 below similar rooms nearby" });
    expect(within(conversation()).getByRole("note", { name: "Piko's tip" })).toHaveTextContent("R600 below similar rooms nearby");
  });

  it("should_not_show_a_tip_without_an_open_listing", () => {
    setup("", { openTip: "New this week" });
    expect(screen.queryByRole("note", { name: "Piko's tip" })).toBeNull();
  });
});
