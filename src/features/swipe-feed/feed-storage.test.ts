import { describe, expect, it, vi } from "vitest";

import { addGuestSave, mergeGuestSaves, readGuestSaves, removeGuestSave, GUEST_SAVES_KEY } from "./guest-saves";
import { readSessionPasses, writeSessionPasses, SESSION_PASSES_KEY, SESSION_PASSES_LIMIT } from "./session-passes";

function memoryStorage(seed: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(seed));
  return {
    get length() { return data.size; },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => { data.delete(key); },
    setItem: (key, value) => { data.set(key, String(value)); },
  };
}

function throwingStorage(): Storage {
  const fail = () => { throw new Error("SecurityError"); };
  return { length: 0, clear: fail, getItem: fail, key: fail, removeItem: fail, setItem: fail };
}

describe("session passes", () => {
  it("should_round_trip_passed_ids", () => {
    const storage = memoryStorage();
    writeSessionPasses(["a", "b"], storage);
    expect(readSessionPasses(storage)).toEqual(["a", "b"]);
  });

  it("should_return_nothing_when_storage_is_empty_corrupt_or_the_wrong_shape", () => {
    expect(readSessionPasses(memoryStorage())).toEqual([]);
    expect(readSessionPasses(memoryStorage({ [SESSION_PASSES_KEY]: "{not json" }))).toEqual([]);
    expect(readSessionPasses(memoryStorage({ [SESSION_PASSES_KEY]: JSON.stringify({ a: 1 }) }))).toEqual([]);
  });

  it("should_drop_entries_that_are_not_strings", () => {
    const storage = memoryStorage({ [SESSION_PASSES_KEY]: JSON.stringify(["a", 4, null, "b"]) });
    expect(readSessionPasses(storage)).toEqual(["a", "b"]);
  });

  it("should_keep_only_the_most_recent_passes_when_over_the_limit", () => {
    const storage = memoryStorage();
    const ids = Array.from({ length: SESSION_PASSES_LIMIT + 5 }, (_, index) => `id-${index}`);
    writeSessionPasses(ids, storage);
    const stored = readSessionPasses(storage);
    expect(stored).toHaveLength(SESSION_PASSES_LIMIT);
    expect(stored[0]).toBe("id-5");
  });

  it("should_not_throw_when_storage_is_blocked", () => {
    expect(readSessionPasses(throwingStorage())).toEqual([]);
    expect(() => writeSessionPasses(["a"], throwingStorage())).not.toThrow();
  });

  it("should_not_throw_without_a_storage", () => {
    expect(readSessionPasses(null)).toEqual([]);
    expect(() => writeSessionPasses(["a"], null)).not.toThrow();
  });
});

describe("guest saves", () => {
  it("should_add_and_remove_saves_without_duplicates", () => {
    const storage = memoryStorage();
    addGuestSave({ id: "a", listingType: "rent" }, storage);
    addGuestSave({ id: "a", listingType: "rent" }, storage);
    addGuestSave({ id: "b" }, storage);
    expect(readGuestSaves(storage)).toEqual([{ id: "a", listingType: "rent" }, { id: "b" }]);
    removeGuestSave("a", storage);
    expect(readGuestSaves(storage)).toEqual([{ id: "b" }]);
  });

  it("should_ignore_corrupt_or_invalid_entries", () => {
    const storage = memoryStorage({ [GUEST_SAVES_KEY]: JSON.stringify([{ id: "a" }, { id: 3 }, "b", { id: "c", listingType: "lease" }]) });
    expect(readGuestSaves(storage)).toEqual([{ id: "a" }, { id: "c" }]);
    expect(readGuestSaves(memoryStorage({ [GUEST_SAVES_KEY]: "nope" }))).toEqual([]);
  });

  it("should_not_throw_when_storage_is_blocked", () => {
    expect(readGuestSaves(throwingStorage())).toEqual([]);
    expect(() => addGuestSave({ id: "a" }, throwingStorage())).not.toThrow();
  });

  it("should_merge_every_save_after_sign_in_and_clear_the_merged_ones", async () => {
    const storage = memoryStorage();
    addGuestSave({ id: "a", listingType: "rent" }, storage);
    addGuestSave({ id: "b", listingType: "sale" }, storage);
    const save = vi.fn().mockResolvedValue(true);

    const result = await mergeGuestSaves(save, storage);

    expect(save).toHaveBeenCalledWith({ id: "a", listingType: "rent" });
    expect(save).toHaveBeenCalledWith({ id: "b", listingType: "sale" });
    expect(result).toEqual({ merged: ["a", "b"], failed: [] });
    expect(readGuestSaves(storage)).toEqual([]);
  });

  it("should_keep_saves_that_failed_to_merge_for_the_next_attempt", async () => {
    const storage = memoryStorage();
    addGuestSave({ id: "a" }, storage);
    addGuestSave({ id: "b" }, storage);
    const save = vi.fn(async ({ id }: { id: string }) => {
      if (id === "b") throw new Error("network");
      return true;
    });

    const result = await mergeGuestSaves(save, storage);

    expect(result).toEqual({ merged: ["a"], failed: ["b"] });
    expect(readGuestSaves(storage)).toEqual([{ id: "b" }]);
  });

  it("should_keep_a_save_the_server_refused", async () => {
    const storage = memoryStorage();
    addGuestSave({ id: "a" }, storage);
    const result = await mergeGuestSaves(vi.fn().mockResolvedValue(false), storage);
    expect(result).toEqual({ merged: [], failed: ["a"] });
    expect(readGuestSaves(storage)).toEqual([{ id: "a" }]);
  });
});
