import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { aiResultToSearch, interpretSearchWithAi, type AiSearchResult } from "./ai-search";
import { chipId } from "./search-intent";

const empty: AiSearchResult = {
  english: true,
  mode: "unchanged",
  minPrice: null,
  maxPrice: null,
  beds: null,
  baths: null,
  propertyTypes: [],
  quickFilters: [],
  flags: [],
  place: null,
  unsupported: [],
};

describe("aiResultToSearch (Pinpoint checks what the AI picked)", () => {
  it("should_turn_valid_fields_into_chips", () => {
    const result = aiResultToSearch({ ...empty, maxPrice: 3500, propertyTypes: ["room"], quickFilters: ["furnished"] }, "cosy room");
    expect(result.chips.map(chipId).sort()).toEqual(["maxPrice:3500", "quick:furnished", "type:room"]);
  });

  it("should_drop_a_place_that_the_person_did_not_type", () => {
    const result = aiResultToSearch({ ...empty, place: "Sandton" }, "quiet spot close to the station");
    expect(result.chips).toEqual([]);
  });

  it("should_keep_a_place_that_appears_in_the_typed_words", () => {
    const result = aiResultToSearch({ ...empty, place: "Observatory" }, "something quiet around observatory");
    expect(result.chips.map(chipId)).toEqual(["near:Observatory"]);
  });

  it("should_turn_unsupported_requests_into_grey_gap_chips", () => {
    const result = aiResultToSearch({ ...empty, unsupported: ["pets", "other"] }, "my cat");
    expect(result.gaps.map((gap) => gap.key)).toEqual(["pets", "other"]);
  });

  it("should_report_non_english_requests", () => {
    expect(aiResultToSearch({ ...empty, english: false }, "x").notEnglish).toBe(true);
  });

  it("should_reject_out_of_range_numbers", () => {
    const result = aiResultToSearch({ ...empty, maxPrice: -5, beds: 40 }, "x");
    expect(result.chips).toEqual([]);
  });
});

describe("interpretSearchWithAi", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function completion(content: string, status = 200) {
    return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status });
  }

  const config = { apiKey: "test-key", models: ["model-a", "model-b", "model-c"], dataCollection: "deny" as const };

  it("should_send_only_the_typed_words_and_current_chip_labels", async () => {
    fetchMock.mockResolvedValue(completion(JSON.stringify({ ...empty, maxPrice: 4000 })));
    await interpretSearchWithAi({ text: "cosy and quiet", currentChipLabels: ["Room"] }, config);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe("model-a");
    expect(body.provider).toMatchObject({ data_collection: "deny", require_parameters: true });
    expect(body.response_format.type).toBe("json_schema");
    expect(body.user).toBeUndefined();
    const userMessage = body.messages.at(-1).content as string;
    expect(userMessage).toContain("cosy and quiet");
    expect(userMessage).toContain("Room");
  });

  it("should_try_the_next_model_when_one_fails_or_returns_junk", async () => {
    fetchMock
      .mockResolvedValueOnce(completion("", 429))
      .mockResolvedValueOnce(completion("not json"))
      .mockResolvedValueOnce(completion(JSON.stringify({ ...empty, beds: 2 })));
    const result = await interpretSearchWithAi({ text: "space for two", currentChipLabels: [] }, config);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result).toEqual({ ok: true, model: "model-c", result: { ...empty, beds: 2 } });
  });

  it("should_report_busy_when_every_model_fails", async () => {
    fetchMock.mockResolvedValue(completion("", 503));
    const result = await interpretSearchWithAi({ text: "anything", currentChipLabels: [] }, config);
    expect(result).toEqual({ ok: false, reason: "unavailable" });
  });

  it("should_survive_network_errors", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    const result = await interpretSearchWithAi({ text: "anything", currentChipLabels: [] }, config);
    expect(result).toEqual({ ok: false, reason: "unavailable" });
  });
});
