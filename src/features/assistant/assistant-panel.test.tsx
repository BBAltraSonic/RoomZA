// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

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
  const input = screen.getByRole("textbox", { name: "What are you looking for?" });
  fireEvent.change(input, { target: { value: text } });
  await act(async () => {
    fireEvent.submit(input.closest("form")!);
  });
}

beforeEach(() => {
  window.localStorage.clear();
  fetchMock.mockReset();
  memoryFetch.mockClear();
  vi.stubGlobal("fetch", (url: string, init?: RequestInit) =>
    String(url).startsWith("/api/assistant/memory") ? memoryFetch() : fetchMock(url, init));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("AssistantPanel", () => {
  it("should_show_the_rentals_starter_chips_when_nothing_is_searched", () => {
    setup();
    const starters = screen.getByRole("list", { name: "Try asking" });
    expect(within(starters).getAllByRole("button").map((button) => button.textContent)).toEqual([
      "Rooms near campus",
      "NSFAS approved",
      "Under R4,000",
      "Furnished",
    ]);
  });

  it("should_apply_what_the_rules_understand_without_calling_the_server", async () => {
    const { lastQuery } = setup("view=map");
    await ask("Furnished room under R4,000 near UWC, NSFAS approved");
    expect(fetchMock).not.toHaveBeenCalled();
    const params = new URLSearchParams(lastQuery()!);
    expect(params.get("view")).toBe("map");
    expect(params.get("maxPrice")).toBe("4000");
    expect(params.get("q")).toBe("UWC");
    expect(params.get("quick")).toBe("furnished,nsfas-approved");
  });

  it("should_show_understood_chips_that_can_be_removed", () => {
    const { lastQuery } = setup("maxPrice=4000&type=room");
    const understood = screen.getByRole("list", { name: "Understood" });
    expect(within(understood).getByText("≤ R4,000")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove Room" }));
    expect(lastQuery()).toBe("maxPrice=4000");
  });

  it("should_show_grey_chips_for_things_pinpoint_cannot_search_yet", async () => {
    setup();
    await ask("room with pets");
    expect(screen.getByText("Pets: can't search this yet")).toBeInTheDocument();
  });

  it("should_toggle_several_quick_filters_at_once", () => {
    const { lastQuery } = setup("quick=furnished");
    const quick = screen.getByRole("list", { name: "Quick filters" });
    fireEvent.click(within(quick).getByRole("button", { name: "NSFAS approved" }));
    expect(lastQuery()).toBe("quick=furnished%2Cnsfas-approved");
  });

  it("should_hide_nsfas_when_buying", () => {
    setup("mode=buy", { listingMode: "buy" });
    const quick = screen.getByRole("list", { name: "Quick filters" });
    expect(within(quick).queryByRole("button", { name: "NSFAS approved" })).toBeNull();
  });

  it("should_say_english_only_for_other_languages", async () => {
    setup();
    await ask("Ek soek 'n kamer naby die kampus");
    expect(screen.getByRole("status")).toHaveTextContent("I can only help in English for now.");
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
  });

  it("should_keep_working_when_the_daily_allowance_is_used", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      data: { query: "quick=furnished", gaps: [], source: "rules", notEnglish: false, notice: "allowance_used" },
    })));
    setup();
    await ask("cosy furnished place");
    expect(screen.getByRole("status")).toHaveTextContent("today's AI searches");
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

  it("should_remember_recent_searches_on_this_device_and_offer_resume", async () => {
    const first = setup();
    await ask("furnished room");
    first.view.unmount();
    const { lastQuery } = setup("view=map");
    expect(screen.getByText("Welcome back")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Resume" }));
    expect(new URLSearchParams(lastQuery()!).get("quick")).toBe("furnished");
    expect(window.localStorage.getItem("pinpoint:assistant-memory:v1")).not.toContain("furnished room");
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
    const openListing = {
      id: "l1", title: "Sunny room", listing_type: "rent" as const, price: 3800, bedrooms: 1, bathrooms: 1,
      parking_type: "covered", parking_count: 1, parking_included: true, electricity_type: "prepaid",
      water_availability: "municipal", lease_duration: "12_months", availability_date: null, metadata: null,
    };
    const { onSearchChange } = setup("type=room", { openListing });
    await ask("Does it have parking?");
    const fact = screen.getByRole("region", { name: "Listing fact" });
    expect(fact).toHaveTextContent("Yes: 1 covered parking bay, included in the rent.");
    expect(fact).toHaveTextContent("From the listing.");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(onSearchChange).not.toHaveBeenCalled();
  });

  it("should_open_the_contact_sheet_when_the_listing_does_not_say", async () => {
    const openListing = {
      id: "l1", title: "Sunny room", listing_type: "rent" as const, price: 3800, bedrooms: 1, bathrooms: 1,
      parking_type: "none", parking_count: 0, electricity_type: "prepaid", water_availability: "municipal",
      lease_duration: "12_months", availability_date: null, metadata: null,
    };
    const opened = vi.fn();
    window.addEventListener("pinpoint:open-contact", opened);
    setup("", { openListing });
    await ask("Are pets allowed?");
    expect(screen.getByRole("region", { name: "Listing fact" })).toHaveTextContent("The listing doesn't say.");
    fireEvent.click(screen.getByRole("button", { name: "Ask landlord" }));
    expect((opened.mock.calls[0]?.[0] as CustomEvent).detail).toEqual({ listingId: "l1" });
    window.removeEventListener("pinpoint:open-contact", opened);
  });

  it("should_compare_two_top_picks_side_by_side", async () => {
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
    const table = await screen.findByRole("table");
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
    fireEvent.keyDown(screen.getByRole("dialog", { name: "Pinpoint Assistant" }), { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});
