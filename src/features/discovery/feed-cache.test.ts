import { beforeEach, describe, expect, it } from "vitest";
import { clearFeedCache, readFeedCache, reuseStable, writeFeedCache } from "./feed-cache";

beforeEach(() => clearFeedCache());

describe("feed cache", () => {
  it("should return nothing for an unknown key", () => {
    expect(readFeedCache("missing")).toBeUndefined();
  });

  it("should return the latest value for a key", () => {
    writeFeedCache("a", [1]);
    writeFeedCache("a", [2]);
    expect(readFeedCache("a")).toEqual([2]);
  });

  it("should evict the least recently used entry beyond capacity", () => {
    for (let index = 0; index < 40; index += 1) writeFeedCache("key" + index, index);
    expect(readFeedCache("key0")).toBeUndefined();
    expect(readFeedCache("key39")).toBe(39);
  });

  it("should treat a read as recent use", () => {
    writeFeedCache("keep", "kept");
    for (let index = 0; index < 31; index += 1) {
      readFeedCache("keep");
      writeFeedCache("key" + index, index);
    }
    expect(readFeedCache("keep")).toBe("kept");
  });

  it("should discard a stale entry", () => {
    writeFeedCache("old", 1, 1_000);
    expect(readFeedCache("old", 1_000 + 10 * 60 * 1000 + 1)).toBeUndefined();
  });
});

describe("reuseStable", () => {
  it("should return the previous array when every row is unchanged", () => {
    const previous = [{ id: "a", price: 1 }, { id: "b", price: 2 }];
    const next = [{ id: "a", price: 1 }, { id: "b", price: 2 }];
    expect(reuseStable(previous, next, row => row.id)).toBe(previous);
  });

  it("should keep unchanged row identity and replace only changed rows", () => {
    const previous = [{ id: "a", price: 1 }, { id: "b", price: 2 }];
    const next = [{ id: "a", price: 1 }, { id: "b", price: 3 }];
    const result = reuseStable(previous, next, row => row.id);
    expect(result).not.toBe(previous);
    expect(result[0]).toBe(previous[0]);
    expect(result[1]).toBe(next[1]);
  });

  it("should return a new array when order changes but keep row identity", () => {
    const previous = [{ id: "a" }, { id: "b" }];
    const next = [{ id: "b" }, { id: "a" }];
    const result = reuseStable(previous, next, row => row.id);
    expect(result).not.toBe(previous);
    expect(result[0]).toBe(previous[1]);
  });
});
