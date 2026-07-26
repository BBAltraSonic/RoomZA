import { describe, expect, it } from "vitest";

import {
  NON_TERMINAL,
  TERMINAL,
  WINDOW_MINUTES,
  expiryFor,
  isExpired,
  isLive,
  isTerminal,
  nextStatus,
  showingStatusLabel,
  type ShowingAction,
  type ShowingStatus,
  type ShowingWindow,
} from "./showing-status";

const ALL_STATUSES: ShowingStatus[] = [
  "requested",
  "accepted",
  "checked_in",
  "declined",
  "completed",
  "cancelled",
  "expired",
];
const ALL_ACTIONS: ShowingAction[] = ["accept", "decline", "check_in", "complete", "cancel"];

describe("terminal/live classification", () => {
  it("partitions every status into exactly one of terminal/non-terminal", () => {
    for (const status of ALL_STATUSES) {
      expect(isTerminal(status)).toBe(TERMINAL.includes(status));
      expect(isLive(status)).toBe(NON_TERMINAL.includes(status));
      expect(isTerminal(status)).not.toBe(isLive(status));
    }
  });
});

describe("nextStatus", () => {
  it("absorbs every action from a terminal status", () => {
    for (const status of TERMINAL) {
      for (const action of ALL_ACTIONS) {
        expect(nextStatus(status, action)).toBeNull();
      }
    }
  });

  it("accepts and declines only from requested", () => {
    expect(nextStatus("requested", "accept")).toBe("accepted");
    expect(nextStatus("requested", "decline")).toBe("declined");
    expect(nextStatus("accepted", "accept")).toBeNull();
    expect(nextStatus("checked_in", "decline")).toBeNull();
  });

  it("checks in only from accepted", () => {
    expect(nextStatus("accepted", "check_in")).toBe("checked_in");
    expect(nextStatus("requested", "check_in")).toBeNull();
    expect(nextStatus("checked_in", "check_in")).toBeNull();
  });

  it("completes only from checked_in", () => {
    expect(nextStatus("checked_in", "complete")).toBe("completed");
    expect(nextStatus("accepted", "complete")).toBeNull();
    expect(nextStatus("requested", "complete")).toBeNull();
  });

  it("cancels from any non-terminal status", () => {
    for (const status of NON_TERMINAL) {
      expect(nextStatus(status, "cancel")).toBe("cancelled");
    }
  });

  it("never produces a status outside the enum", () => {
    for (const status of ALL_STATUSES) {
      for (const action of ALL_ACTIONS) {
        const next = nextStatus(status, action);
        if (next !== null) {
          expect(ALL_STATUSES).toContain(next);
        }
      }
    }
  });
});

describe("expiry", () => {
  const base = 1_700_000_000_000;

  it("maps each window to its minute budget", () => {
    const cases: [ShowingWindow, number][] = [
      ["now", 15],
      ["within_15", 15],
      ["within_30", 30],
      ["today", 720],
    ];
    for (const [window, minutes] of cases) {
      expect(WINDOW_MINUTES[window]).toBe(minutes);
      expect(expiryFor(window, base)).toBe(base + minutes * 60_000);
    }
  });

  it("treats a requested row past its window as expired", () => {
    const expiresAtMs = base + 15 * 60_000;
    expect(isExpired({ status: "requested", expiresAtMs }, expiresAtMs - 1)).toBe(false);
    expect(isExpired({ status: "requested", expiresAtMs }, expiresAtMs + 1)).toBe(true);
  });

  it("only expires requested rows, never accepted/checked_in", () => {
    const nowMs = base + 999_999_999;
    for (const status of ["accepted", "checked_in", "completed", "declined"] as ShowingStatus[]) {
      expect(isExpired({ status, expiresAtMs: base }, nowMs)).toBe(false);
    }
  });
});

describe("showingStatusLabel", () => {
  it("labels every status", () => {
    for (const status of ALL_STATUSES) {
      expect(showingStatusLabel(status).length).toBeGreaterThan(0);
    }
  });
});
