import { describe, expect, it } from "vitest";

import { LISTING_HANDOFF_KEY, saveListingHandoff, takeListingHandoff } from "./listing-handoff";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
  };
}

const SUGGESTION = { title: "2-bedroom apartment in Bellville", description: "A 2-bedroom apartment to rent.", propertyType: "apartment" as const, listingType: "rent" as const, price: 8500, features: ["wifi", "balcony"] };

describe("listing handoff", () => {
  it("should_be_read_once", () => {
    const storage = memoryStorage();
    saveListingHandoff(SUGGESTION, storage, 1000);
    expect(takeListingHandoff(storage, 2000)).toEqual({ ...SUGGESTION, savedAt: 1000 });
    expect(takeListingHandoff(storage, 2000)).toBeNull();
  });

  it("should_expire_after_an_hour", () => {
    const storage = memoryStorage();
    saveListingHandoff(SUGGESTION, storage, 0);
    expect(takeListingHandoff(storage, 60 * 60_000 + 1)).toBeNull();
  });

  it("should_drop_unknown_features_and_reject_bad_shapes", () => {
    const storage = memoryStorage();
    saveListingHandoff({ ...SUGGESTION, features: ["wifi", "helipad", "wifi"] }, storage, 0);
    expect(takeListingHandoff(storage, 1)?.features).toEqual(["wifi"]);
    storage.values.set(LISTING_HANDOFF_KEY, JSON.stringify({ title: "", savedAt: 0 }));
    expect(takeListingHandoff(storage, 1)).toBeNull();
    storage.values.set(LISTING_HANDOFF_KEY, "not json");
    expect(takeListingHandoff(storage, 1)).toBeNull();
  });
});

describe("listing handoff property type", () => {
  it("should_keep_the_suggestion_when_the_type_is_not_one_the_form_offers", () => {
    const storage = memoryStorage();
    saveListingHandoff({ ...SUGGESTION, propertyType: "castle" }, storage, 0);
    expect(takeListingHandoff(storage, 1)).toMatchObject({ title: SUGGESTION.title, propertyType: null });
  });
});
