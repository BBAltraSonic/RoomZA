import { describe, expect, it } from "vitest";

import {
  DEFAULT_BUSY_WINDOW_MS,
  LIVE_FRESHNESS_MS,
  isFresh,
  presenceBadgeLabel,
  resolvePresenceBadge,
  type AvailabilityMode,
} from "./presence-status";

const NOW = 1_700_000_000_000;
const fresh = NOW - 10_000; // within 90s
const recent = NOW - 5 * 60_000; // within 20 min busy window, not fresh
const stale = NOW - 60 * 60_000; // outside every window

function resolve(overrides: Partial<Parameters<typeof resolvePresenceBadge>[0]>) {
  return resolvePresenceBadge({
    availabilityMode: "auto",
    liveOnline: false,
    lastSeenAt: null,
    now: NOW,
    ...overrides,
  });
}

describe("isFresh", () => {
  it("is false for null last-seen", () => {
    expect(isFresh(null, NOW)).toBe(false);
  });

  it("is true at the freshness boundary and false just past it", () => {
    expect(isFresh(NOW - LIVE_FRESHNESS_MS, NOW)).toBe(true);
    expect(isFresh(NOW - LIVE_FRESHNESS_MS - 1, NOW)).toBe(false);
  });
});

describe("resolvePresenceBadge — invisible", () => {
  it("is always offline regardless of liveness or recency", () => {
    for (const liveOnline of [true, false]) {
      for (const lastSeenAt of [fresh, recent, stale, null]) {
        expect(resolve({ availabilityMode: "invisible", liveOnline, lastSeenAt })).toBe("offline");
      }
    }
  });
});

describe("resolvePresenceBadge — pinned available/busy", () => {
  const modes: AvailabilityMode[] = ["available", "busy"];

  it("honors the pin while live via the channel", () => {
    for (const mode of modes) {
      expect(resolve({ availabilityMode: mode, liveOnline: true, lastSeenAt: null })).toBe(mode);
    }
  });

  it("honors the pin while fresh by heartbeat", () => {
    for (const mode of modes) {
      expect(resolve({ availabilityMode: mode, lastSeenAt: fresh })).toBe(mode);
    }
  });

  it("honors the pin while within the busy window but not fresh", () => {
    for (const mode of modes) {
      expect(resolve({ availabilityMode: mode, lastSeenAt: recent })).toBe(mode);
    }
  });

  it("degrades to offline when stale and not live", () => {
    for (const mode of modes) {
      expect(resolve({ availabilityMode: mode, lastSeenAt: stale })).toBe("offline");
      expect(resolve({ availabilityMode: mode, lastSeenAt: null })).toBe("offline");
    }
  });
});

describe("resolvePresenceBadge — auto", () => {
  it("is available when live and not in a call/viewing", () => {
    expect(resolve({ liveOnline: true, inActiveCallOrViewing: false })).toBe("available");
    expect(resolve({ lastSeenAt: fresh })).toBe("available");
  });

  it("is busy when live but in a call/viewing", () => {
    expect(resolve({ liveOnline: true, inActiveCallOrViewing: true })).toBe("busy");
    expect(resolve({ lastSeenAt: fresh, inActiveCallOrViewing: true })).toBe("busy");
  });

  it("is busy when not live but seen within the busy window", () => {
    expect(resolve({ lastSeenAt: recent })).toBe("busy");
  });

  it("is offline when stale or never seen", () => {
    expect(resolve({ lastSeenAt: stale })).toBe("offline");
    expect(resolve({ lastSeenAt: null })).toBe("offline");
  });

  it("treats the busy-window boundary inclusively", () => {
    expect(resolve({ lastSeenAt: NOW - DEFAULT_BUSY_WINDOW_MS })).toBe("busy");
    expect(resolve({ lastSeenAt: NOW - DEFAULT_BUSY_WINDOW_MS - 1 })).toBe("offline");
  });

  it("respects a custom busy window", () => {
    expect(resolve({ lastSeenAt: NOW - 2 * 60_000, busyWindowMs: 60_000 })).toBe("offline");
    expect(resolve({ lastSeenAt: NOW - 30_000, busyWindowMs: 60_000 })).toBe("available"); // still fresh
  });
});

describe("presenceBadgeLabel", () => {
  it("maps every badge to copy", () => {
    expect(presenceBadgeLabel("available")).toBe("Available now");
    expect(presenceBadgeLabel("busy")).toBe("Recently active");
    expect(presenceBadgeLabel("offline")).toBe("Offline");
  });
});
