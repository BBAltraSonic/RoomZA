import { describe, expect, it } from "vitest";

import {
  appendToThread,
  clearThread,
  loadThread,
  MAX_THREAD_ENTRIES,
  NOTE_KEYS,
  saveThread,
  threadStorageKey,
  type NewThreadEntry,
  type ThreadEntry,
} from "./chat-thread";
import { PIKO_LINES } from "@/features/piko/lines";

function memoryStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  return {
    store,
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  };
}

const brokenStorage = {
  getItem: () => { throw new Error("blocked"); },
  setItem: () => { throw new Error("blocked"); },
  removeItem: () => { throw new Error("blocked"); },
};

describe("chat thread", () => {
  it("should_give_each_appended_entry_its_own_id", () => {
    const thread = appendToThread([], { from: "person", text: "Room near UWC" }, { from: "pinpoint", kind: "note", note: "english_only" });
    expect(thread).toHaveLength(2);
    expect(new Set(thread.map((entry) => entry.id)).size).toBe(2);
  });

  it("should_keep_only_the_latest_entries_when_the_thread_grows", () => {
    let thread: ThreadEntry[] = [];
    for (let index = 0; index < MAX_THREAD_ENTRIES + 5; index += 1) {
      thread = appendToThread(thread, { from: "person", text: `message ${index}` });
    }
    expect(thread).toHaveLength(MAX_THREAD_ENTRIES);
    expect(thread[0]).toMatchObject({ text: "message 5" });
    expect(thread.at(-1)).toMatchObject({ text: `message ${MAX_THREAD_ENTRIES + 4}` });
  });

  it("should_save_and_load_a_thread_for_the_visit", () => {
    const storage = memoryStorage();
    const thread = appendToThread(
      [],
      { from: "person", text: "Furnished room" },
      { from: "pinpoint", kind: "search", chips: ["Room", "Furnished"], gaps: [] },
    );
    saveThread("homes", thread, storage);
    expect(storage.store.has(threadStorageKey("homes"))).toBe(true);
    expect(loadThread("homes", storage)).toEqual(thread);
    expect(loadThread("section-event", storage)).toEqual([]);
  });

  it("should_read_a_malformed_or_tampered_thread_as_empty", () => {
    const key = threadStorageKey("homes");
    expect(loadThread("homes", memoryStorage({ [key]: "not json" }))).toEqual([]);
    expect(loadThread("homes", memoryStorage({ [key]: JSON.stringify({ entries: "nope" }) }))).toEqual([]);
    // A note is only ever one of Pinpoint's own sentences, picked by key.
    const tampered = JSON.stringify({ version: 1, entries: [{ id: "a", from: "pinpoint", kind: "note", note: "<b>anything</b>" }] });
    expect(loadThread("homes", memoryStorage({ [key]: tampered }))).toEqual([]);
  });

  it("should_keep_working_when_storage_is_unavailable", () => {
    expect(loadThread("homes", brokenStorage)).toEqual([]);
    expect(() => saveThread("homes", [], brokenStorage)).not.toThrow();
    expect(() => clearThread("homes", brokenStorage)).not.toThrow();
  });

  it("should_clear_the_thread", () => {
    const storage = memoryStorage();
    saveThread("homes", appendToThread([], { from: "person", text: "hi" }), storage);
    clearThread("homes", storage);
    expect(loadThread("homes", storage)).toEqual([]);
  });

  it("should_give_every_note_one_of_pikos_own_lines", () => {
    for (const key of NOTE_KEYS) expect(PIKO_LINES[key].lines.length, key).toBeGreaterThan(0);
  });

  it("should_rotate_pikos_searching_line_without_repeating_the_last_one", () => {
    const search: NewThreadEntry = { from: "pinpoint", kind: "search", chips: ["Room"], gaps: [] };
    let thread = appendToThread([], search);
    thread = appendToThread(thread, { from: "person", text: "cheaper" }, search);
    const versions = thread.filter((entry) => entry.kind === "search").map((entry) => entry.v);
    expect(versions).toEqual([0, 1]);
  });

  it("should_keep_the_line_a_person_saw_when_the_thread_reloads", () => {
    const storage = memoryStorage();
    const search: NewThreadEntry = { from: "pinpoint", kind: "search", chips: ["Room"], gaps: [] };
    const thread = appendToThread(appendToThread([], search), search);
    saveThread("homes", thread, storage);
    expect(loadThread("homes", storage).map((entry) => (entry.kind === "search" ? entry.v : null))).toEqual([0, 1]);
  });

  it("should_read_an_older_thread_without_line_versions", () => {
    const key = threadStorageKey("homes");
    const older = JSON.stringify({ version: 1, entries: [{ id: "a", from: "pinpoint", kind: "note", note: "busy" }] });
    expect(loadThread("homes", memoryStorage({ [key]: older }))).toEqual([{ id: "a", from: "pinpoint", kind: "note", note: "busy" }]);
  });

  it("should_reject_a_tampered_line_version", () => {
    const key = threadStorageKey("homes");
    const tampered = JSON.stringify({ version: 1, entries: [{ id: "a", from: "pinpoint", kind: "note", note: "busy", v: 9999 }] });
    expect(loadThread("homes", memoryStorage({ [key]: tampered }))).toEqual([]);
  });
});
