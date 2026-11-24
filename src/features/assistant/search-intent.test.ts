import { describe, expect, it } from "vitest";

import {
  applyChipsToParams,
  chipId,
  chipLabel,
  chipsFromParams,
  mergeChips,
  parseSearchText,
  type SearchChip,
} from "./search-intent";

function ids(chips: readonly SearchChip[]) {
  return chips.map(chipId).sort();
}

describe("parseSearchText", () => {
  it("should_understand_the_proposal_example_without_ai", () => {
    const result = parseSearchText("Furnished room under R4,000 near UWC, NSFAS approved");
    expect(ids(result.chips)).toEqual(
      ["maxPrice:4000", "near:UWC", "quick:furnished", "quick:nsfas-approved", "type:room"].sort(),
    );
    expect(result.needsAi).toBe(false);
  });

  it("should_read_prices_written_as_k_spaces_and_ranges", () => {
    expect(ids(parseSearchText("under 4k").chips)).toEqual(["maxPrice:4000"]);
    expect(ids(parseSearchText("below R4 500").chips)).toEqual(["maxPrice:4500"]);
    expect(ids(parseSearchText("max 3.5k").chips)).toEqual(["maxPrice:3500"]);
    expect(ids(parseSearchText("between R3,000 and R5,000").chips)).toEqual(["maxPrice:5000", "minPrice:3000"]);
    expect(ids(parseSearchText("R3000 - R5000").chips)).toEqual(["maxPrice:5000", "minPrice:3000"]);
    expect(ids(parseSearchText("over R10 000").chips)).toEqual(["minPrice:10000"]);
  });

  it("should_read_bedrooms_bathrooms_and_property_types", () => {
    expect(ids(parseSearchText("two-bedroom apartment in Bellville").chips)).toEqual(
      ["beds:2", "near:Bellville", "type:apartment"],
    );
    expect(ids(parseSearchText("3 bed 2 bath house").chips)).toEqual(["baths:2", "beds:3", "type:house"]);
    expect(ids(parseSearchText("bachelor flat").chips)).toEqual(["type:studio"]);
    expect(ids(parseSearchText("flats").chips)).toEqual(["type:apartment"]);
  });

  it("should_read_buy_mode_and_drop_nsfas_when_buying", () => {
    const result = parseSearchText("house for sale with NSFAS");
    expect(ids(result.chips)).toEqual(["mode:buy", "type:house"]);
  });

  it("should_read_flags_that_have_filters", () => {
    expect(ids(parseSearchText("available now").chips)).toEqual(["flag:availableNow"]);
    expect(ids(parseSearchText("newly listed rooms").chips)).toEqual(["quick:recently-listed", "type:room"]);
    expect(ids(parseSearchText("with a live tour").chips)).toEqual(["flag:liveTours"]);
  });

  it("should_show_honest_gaps_for_things_pinpoint_cannot_search_yet", () => {
    const result = parseSearchText("pet friendly room with wifi and parking");
    expect(ids(result.chips)).toEqual(["type:room"]);
    expect(result.gaps.map((gap) => gap.key).sort()).toEqual(["parking", "pets", "wifi"]);
    expect(result.needsAi).toBe(false);
  });

  it("should_treat_a_move_in_date_as_a_gap_not_a_place", () => {
    const result = parseSearchText("room to move in from January");
    expect(ids(result.chips)).toEqual(["type:room"]);
    expect(result.gaps.map((gap) => gap.key)).toEqual(["move-in"]);
  });

  it("should_ask_the_ai_only_when_words_are_left_over", () => {
    expect(parseSearchText("something cosy and quiet for a student").needsAi).toBe(true);
    expect(parseSearchText("I need a furnished room please").needsAi).toBe(false);
  });

  it("should_flag_requests_that_are_not_in_english", () => {
    expect(parseSearchText("Ek soek 'n kamer naby die kampus").notEnglish).toBe(true);
    expect(parseSearchText("Ngifuna igumbi eduze kwasekolishi").notEnglish).toBe(true);
    expect(parseSearchText("room near campus").notEnglish).toBe(false);
  });

  it("should_refine_current_chips_with_cheaper_and_bigger", () => {
    const current: SearchChip[] = [{ kind: "maxPrice", value: 4000 }, { kind: "beds", value: 1 }];
    const cheaper = parseSearchText("cheaper", current);
    expect(ids(cheaper.chips)).toEqual(["beds:1", "maxPrice:3500"]);
    const bigger = parseSearchText("bigger", current);
    expect(ids(bigger.chips)).toEqual(["beds:2", "maxPrice:4000"]);
  });

  it("should_show_closer_as_a_gap_because_distance_is_not_searchable", () => {
    const result = parseSearchText("closer", [{ kind: "near", value: "UWC" }]);
    expect(ids(result.chips)).toEqual(["near:UWC"]);
    expect(result.gaps.map((gap) => gap.key)).toEqual(["distance"]);
  });

  it("should_keep_current_chips_when_adding_new_words", () => {
    const result = parseSearchText("furnished", [{ kind: "maxPrice", value: 4000 }]);
    expect(ids(result.chips)).toEqual(["maxPrice:4000", "quick:furnished"]);
  });
});

describe("chip labels", () => {
  it("should_format_rand_amounts_the_south_african_way", () => {
    expect(chipLabel({ kind: "maxPrice", value: 4000 })).toBe("≤ R4,000");
    expect(chipLabel({ kind: "minPrice", value: 12500 })).toBe("≥ R12,500");
    expect(chipLabel({ kind: "near", value: "UWC" })).toBe("Near UWC");
    expect(chipLabel({ kind: "quick", value: "nsfas-approved" })).toBe("NSFAS approved");
    expect(chipLabel({ kind: "beds", value: 2 })).toBe("2+ beds");
  });
});

describe("mergeChips", () => {
  it("should_replace_chips_of_the_same_single_value_kind", () => {
    const merged = mergeChips(
      [{ kind: "maxPrice", value: 4000 }, { kind: "type", value: "room" }],
      [{ kind: "maxPrice", value: 3000 }, { kind: "type", value: "studio" }],
    );
    expect(ids(merged)).toEqual(["maxPrice:3000", "type:room", "type:studio"]);
  });

  it("should_drop_the_area_when_a_new_place_is_named", () => {
    const merged = mergeChips([{ kind: "area", value: "Rondebosch, Cape Town" }], [{ kind: "near", value: "UWC" }]);
    expect(ids(merged)).toEqual(["near:UWC"]);
  });
});

describe("URL round trip", () => {
  it("should_write_chips_into_the_discovery_address_and_keep_unrelated_params", () => {
    const base = new URLSearchParams("mode=rent&minPrice=100&listingId=abc&area=Rondebosch&areaId=x");
    const params = applyChipsToParams(base, [
      { kind: "maxPrice", value: 4000 },
      { kind: "type", value: "room" },
      { kind: "quick", value: "furnished" },
      { kind: "quick", value: "nsfas-approved" },
      { kind: "near", value: "UWC" },
      { kind: "flag", value: "availableNow" },
    ]);
    expect(params.get("maxPrice")).toBe("4000");
    expect(params.has("minPrice")).toBe(false);
    expect(params.get("type")).toBe("room");
    expect(params.get("quick")).toBe("furnished,nsfas-approved");
    expect(params.get("q")).toBe("UWC");
    expect(params.get("availableNow")).toBe("1");
    expect(params.has("mode")).toBe(false);
    expect(params.has("area")).toBe(false);
    expect(params.has("areaId")).toBe(false);
    expect(params.get("listingId")).toBeNull();
  });

  it("should_keep_the_chosen_area_while_its_chip_is_kept", () => {
    const base = new URLSearchParams("area=Rondebosch&areaId=x");
    const chips = chipsFromParams(base);
    expect(ids(chips)).toEqual(["area:Rondebosch"]);
    const params = applyChipsToParams(base, [...chips, { kind: "beds", value: 2 }]);
    expect(params.get("area")).toBe("Rondebosch");
    expect(params.get("areaId")).toBe("x");
  });

  it("should_read_chips_back_from_the_address", () => {
    const chips = chipsFromParams(
      new URLSearchParams("mode=buy&maxPrice=900000&beds=3&type=house,townhouse&quick=furnished&q=Bellville&liveTours=1"),
    );
    expect(ids(chips)).toEqual(
      ["beds:3", "flag:liveTours", "maxPrice:900000", "mode:buy", "near:Bellville", "quick:furnished", "type:house", "type:townhouse"].sort(),
    );
  });

  it("should_ignore_invalid_values_in_the_address", () => {
    const chips = chipsFromParams(new URLSearchParams("maxPrice=abc&beds=-1&type=castle&quick=nope"));
    expect(chips).toEqual([]);
  });
});
