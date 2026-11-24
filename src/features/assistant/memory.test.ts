import { describe, expect, it } from "vitest";

import {
  emptyMemory,
  forgetEverything,
  forgetPreference,
  forgetSearch,
  parseMemory,
  preferenceOffer,
  recordSearch,
  rememberPreference,
  declinePreference,
  isMemoryEmpty,
  isSaved,
  mergeMemories,
  resumeQuery,
  sanitizeMemory,
  saveSearch,
  searchQuery,
  unsaveSearch,
} from "./memory";
import { chipId, chipsFromParams } from "./search-intent";

const now = new Date("2026-11-24T10:00:00.000Z");
const day = 86_400_000;

describe("assistant memory", () => {
  it("should_store_chips_as_an_address_not_what_was_typed", () => {
    const memory = recordSearch(emptyMemory(), new URLSearchParams("type=room&maxPrice=4000&listingId=x&foo=1"), now);
    expect(memory.recent).toEqual([{ query: "maxPrice=4000&type=room", at: now.toISOString() }]);
  });

  it("should_not_store_an_empty_search", () => {
    expect(recordSearch(emptyMemory(), new URLSearchParams("listingId=x"), now).recent).toEqual([]);
  });

  it("should_move_a_repeated_search_to_the_top_without_duplicating_it", () => {
    let memory = recordSearch(emptyMemory(), new URLSearchParams("type=room"), new Date(now.getTime() - 1000));
    memory = recordSearch(memory, new URLSearchParams("beds=2"), new Date(now.getTime() - 500));
    memory = recordSearch(memory, new URLSearchParams("type=room"), now);
    expect(memory.recent.map((entry) => entry.query)).toEqual(["type=room", "beds=2"]);
  });

  it("should_drop_searches_older_than_about_90_days_when_loaded", () => {
    const stored = JSON.stringify({
      version: 1,
      recent: [
        { query: "type=room", at: new Date(now.getTime() - 10 * day).toISOString() },
        { query: "beds=2", at: new Date(now.getTime() - 100 * day).toISOString() },
      ],
      preferences: [],
      declined: [],
    });
    expect(parseMemory(stored, now).recent.map((entry) => entry.query)).toEqual(["type=room"]);
  });

  it("should_survive_corrupt_storage", () => {
    expect(parseMemory("{not json", now)).toEqual(emptyMemory());
    expect(parseMemory(JSON.stringify({ version: 1, recent: "x", preferences: [{}] }), now)).toEqual(emptyMemory());
  });

  it("should_offer_to_remember_a_need_that_keeps_coming_up", () => {
    let memory = recordSearch(emptyMemory(), new URLSearchParams("quick=nsfas-approved&maxPrice=4000"), now);
    expect(preferenceOffer(memory, new URLSearchParams("quick=nsfas-approved"))).toBeNull();
    memory = recordSearch(memory, new URLSearchParams("quick=nsfas-approved&type=room"), now);
    const offer = preferenceOffer(memory, new URLSearchParams("quick=nsfas-approved"));
    expect(offer && chipId(offer)).toBe("quick:nsfas-approved");
  });

  it("should_only_offer_needs_not_property_types", () => {
    let memory = recordSearch(emptyMemory(), new URLSearchParams("type=room"), now);
    memory = recordSearch(memory, new URLSearchParams("type=room&beds=1"), now);
    expect(preferenceOffer(memory, new URLSearchParams("type=room"))).toBeNull();
  });

  it("should_not_offer_again_after_remember_or_not_now", () => {
    let memory = recordSearch(emptyMemory(), new URLSearchParams("quick=furnished"), now);
    memory = recordSearch(memory, new URLSearchParams("quick=furnished&beds=1"), now);
    const remembered = rememberPreference(memory, { kind: "quick", value: "furnished" });
    expect(remembered.preferences.map(chipId)).toEqual(["quick:furnished"]);
    expect(preferenceOffer(remembered, new URLSearchParams("quick=furnished"))).toBeNull();
    const declined = declinePreference(memory, { kind: "quick", value: "furnished" });
    expect(preferenceOffer(declined, new URLSearchParams("quick=furnished"))).toBeNull();
  });

  it("should_forget_one_item_or_everything", () => {
    let memory = recordSearch(emptyMemory(), new URLSearchParams("type=room"), now);
    memory = rememberPreference(memory, { kind: "quick", value: "furnished" });
    expect(forgetSearch(memory, "type=room").recent).toEqual([]);
    expect(forgetPreference(memory, "quick:furnished").preferences).toEqual([]);
    expect(forgetEverything()).toEqual(emptyMemory());
  });

  it("should_resume_a_stored_search_over_the_current_address", () => {
    const params = resumeQuery(new URLSearchParams("q=Sandton&beds=3&view=map&listingId=y"), "maxPrice=4000&area=Rondebosch&areaId=a1");
    expect(params.get("view")).toBe("map");
    expect(params.has("q")).toBe(false);
    expect(params.has("beds")).toBe(false);
    expect(params.has("listingId")).toBe(false);
    expect(params.get("areaId")).toBe("a1");
    expect(chipsFromParams(params).map(chipId).sort()).toEqual(["area:Rondebosch", "maxPrice:4000"]);
  });

  it("should_keep_area_id_with_the_stored_search", () => {
    expect(searchQuery(new URLSearchParams("area=Rondebosch&areaId=a1&beds=2"))).toBe("beds=2&area=Rondebosch&areaId=a1");
  });
});

describe("saved searches", () => {
  it("should_save_a_search_once_and_unsave_it", () => {
    let memory = saveSearch(emptyMemory(), new URLSearchParams("type=room&maxPrice=4000&listingId=x"), now);
    memory = saveSearch(memory, new URLSearchParams("maxPrice=4000&type=room"), now);
    expect(memory.saved).toEqual([{ query: "maxPrice=4000&type=room", at: now.toISOString() }]);
    expect(isSaved(memory, new URLSearchParams("type=room&maxPrice=4000"))).toBe(true);
    expect(unsaveSearch(memory, "maxPrice=4000&type=room").saved).toEqual([]);
  });

  it("should_keep_saved_searches_past_90_days", () => {
    const stored = JSON.stringify({ version: 1, recent: [], preferences: [], declined: [], saved: [{ query: "beds=2", at: new Date(now.getTime() - 200 * day).toISOString() }] });
    expect(parseMemory(stored, now).saved.map((entry) => entry.query)).toEqual(["beds=2"]);
  });

  it("should_read_memory_written_before_saved_searches_existed", () => {
    const stored = JSON.stringify({ version: 1, recent: [], preferences: ["quick:furnished"], declined: [] });
    expect(parseMemory(stored, now)).toEqual({ ...emptyMemory(), preferences: [{ kind: "quick", value: "furnished" }] });
  });
});

describe("account memory", () => {
  it("should_sanitise_what_the_server_receives", () => {
    const memory = sanitizeMemory(
      { version: 1, recent: [{ query: "type=room&q=" + "x".repeat(600), at: now.toISOString() }, { query: "beds=2", at: "nope" }], preferences: ["quick:furnished", "mode:buy", 7], declined: ["quick:nsfas-approved"], saved: "x" },
      now,
    );
    expect(memory.recent).toEqual([]);
    expect(memory.preferences).toEqual([{ kind: "quick", value: "furnished" }]);
    expect(memory.declined).toEqual(["quick:nsfas-approved"]);
    expect(memory.saved).toEqual([]);
  });

  it("should_merge_guest_memory_into_the_account_newest_first_without_duplicates", () => {
    const account = { ...emptyMemory(), recent: [{ query: "type=room", at: "2026-11-20T10:00:00.000Z" }], preferences: [{ kind: "quick" as const, value: "furnished" as const }] };
    const guest = {
      ...emptyMemory(),
      recent: [{ query: "beds=2", at: "2026-11-23T10:00:00.000Z" }, { query: "type=room", at: "2026-11-22T10:00:00.000Z" }],
      preferences: [{ kind: "quick" as const, value: "nsfas-approved" as const }],
      saved: [{ query: "beds=2", at: "2026-11-23T10:00:00.000Z" }],
      declined: ["quick:furnished"],
    };
    const merged = mergeMemories(account, guest);
    expect(merged.recent).toEqual([{ query: "beds=2", at: "2026-11-23T10:00:00.000Z" }, { query: "type=room", at: "2026-11-22T10:00:00.000Z" }]);
    expect(merged.preferences.map(chipId)).toEqual(["quick:furnished", "quick:nsfas-approved"]);
    expect(merged.saved.map((entry) => entry.query)).toEqual(["beds=2"]);
    // A remembered preference wins over a "Not now" from another device.
    expect(merged.declined).toEqual([]);
  });

  it("should_tell_when_memory_is_empty", () => {
    expect(isMemoryEmpty(emptyMemory())).toBe(true);
    expect(isMemoryEmpty({ ...emptyMemory(), declined: ["quick:furnished"] })).toBe(false);
  });
});
