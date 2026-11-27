// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { useGuestSaveIds, usePassedListingIds } from "./feed-marks";
import { addGuestSave, GUEST_SAVES_KEY, mergeGuestSaves, removeGuestSave } from "./guest-saves";
import { writeSessionPasses } from "./session-passes";

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
  window.localStorage.clear();
});

describe("usePassedListingIds", () => {
  it("should_start_with_the_passes_already_in_this_session", () => {
    writeSessionPasses(["a"]);
    const { result } = renderHook(() => usePassedListingIds());
    expect([...result.current]).toEqual(["a"]);
  });

  it("should_update_when_the_feed_records_a_pass", () => {
    const { result } = renderHook(() => usePassedListingIds());
    expect(result.current.size).toBe(0);
    act(() => writeSessionPasses(["a", "b"]));
    expect([...result.current]).toEqual(["a", "b"]);
  });

  it("should_keep_the_same_set_when_nothing_changed", () => {
    writeSessionPasses(["a"]);
    const { result, rerender } = renderHook(() => usePassedListingIds());
    const first = result.current;
    act(() => writeSessionPasses(["a"]));
    rerender();
    expect(result.current).toBe(first);
  });
});

describe("useGuestSaveIds", () => {
  it("should_update_when_a_guest_saves_or_unsaves", () => {
    const { result } = renderHook(() => useGuestSaveIds());
    act(() => addGuestSave({ id: "a", listingType: "rent" }));
    expect([...result.current]).toEqual(["a"]);
    act(() => removeGuestSave("a"));
    expect(result.current.size).toBe(0);
  });

  it("should_empty_after_the_saves_merge_into_favourites", async () => {
    addGuestSave({ id: "a" });
    const { result } = renderHook(() => useGuestSaveIds());
    await act(async () => { await mergeGuestSaves(async () => true); });
    expect(result.current.size).toBe(0);
  });

  it("should_follow_saves_made_in_another_tab", () => {
    const { result } = renderHook(() => useGuestSaveIds());
    act(() => {
      window.localStorage.setItem(GUEST_SAVES_KEY, JSON.stringify([{ id: "b" }]));
      window.dispatchEvent(new StorageEvent("storage", { key: GUEST_SAVES_KEY }));
    });
    expect([...result.current]).toEqual(["b"]);
  });
});
