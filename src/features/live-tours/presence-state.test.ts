import { describe, expect, it } from "vitest";

import {
  getViewerQueue,
  getViewerRoster,
  readTourPresence,
} from "./presence-state";

describe("live tour presence queue", () => {
  it("orders the host first and viewers by join time", () => {
    const entries = readTourPresence({
      viewerB: [{ role: "viewer", joinedAt: "2026-07-23T18:02:00.000Z", presence_ref: "b" }],
      host: [{ role: "host", joinedAt: "2026-07-23T18:00:00.000Z", presence_ref: "h" }],
      viewerA: [{ role: "viewer", joinedAt: "2026-07-23T18:01:00.000Z", presence_ref: "a" }],
    });

    expect(entries.map((entry) => entry.key)).toEqual([
      "host",
      "viewerA",
      "viewerB",
    ]);
    expect(getViewerQueue(entries, "viewerB")).toEqual({
      viewerCount: 2,
      queuePosition: 2,
    });
  });

  it("ignores malformed presence payloads", () => {
    expect(readTourPresence({
      invalid: [{ role: "viewer", joinedAt: "not-a-date", presence_ref: "x" }],
    })).toEqual([]);
  });

  it("deduplicates the bounded viewer roster by authenticated user", () => {
    const roster = getViewerRoster([
      {
        key: "tab-1",
        role: "viewer",
        joinedAt: "2026-07-23T18:00:00.000Z",
        userId: "user-1",
      },
      {
        key: "tab-2",
        role: "viewer",
        joinedAt: "2026-07-23T18:01:00.000Z",
        userId: "user-1",
      },
      {
        key: "tab-3",
        role: "viewer",
        joinedAt: "2026-07-23T18:02:00.000Z",
        userId: "user-2",
      },
    ]);

    expect(roster.map((entry) => entry.key)).toEqual(["tab-1", "tab-3"]);
  });
});
