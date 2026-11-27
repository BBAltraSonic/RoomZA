import { describe, expect, it } from "vitest";

import {
  coverImageFor,
  initialsFor,
  orderedVerifications,
  ownerChecklist,
  responseTimeLabel,
  specialHref,
  tenure,
} from "./public-profile-format";

const NOW = Date.parse("2026-11-22T10:00:00Z");

describe("public profile formatting", () => {
  it("shows time on Pinpoint in the largest honest unit", () => {
    expect(tenure("2026-11-10T00:00:00Z", NOW)).toEqual({ value: "New", label: "On Pinpoint" });
    expect(tenure("2026-09-15T00:00:00Z", NOW)).toEqual({ value: "2", label: "Months on Pinpoint" });
    expect(tenure("2025-10-01T00:00:00Z", NOW)).toEqual({ value: "1", label: "Year on Pinpoint" });
    expect(tenure("2023-01-01T00:00:00Z", NOW)).toEqual({ value: "3", label: "Years on Pinpoint" });
  });

  it("leads with the strongest verification and drops duplicates", () => {
    expect(orderedVerifications(["email", "phone", "identity", "landlord", "email"])).toEqual([
      "identity",
      "landlord",
      "phone",
      "email",
    ]);
  });

  it("hides response time unless there is real data", () => {
    expect(responseTimeLabel(null)).toBeNull();
    expect(responseTimeLabel(0)).toBeNull();
    expect(responseTimeLabel(20)).toBe("within about 1 min");
    expect(responseTimeLabel(840)).toBe("within about 14 min");
    expect(responseTimeLabel(3 * 3600)).toBe("within about 3 hours");
    expect(responseTimeLabel(2 * 86400)).toBe("within about 2 days");
  });

  it("builds initials for any name shape", () => {
    expect(initialsFor("Thandiwe Mokoena")).toBe("TM");
    expect(initialsFor("  cher ")).toBe("C");
    expect(initialsFor("   ")).toBe("P");
  });

  it("routes shopping specials and places/events to their own detail pages", () => {
    expect(specialHref({ id: "a", kind: "shopping" })).toBe("/offers/a");
    expect(specialHref({ id: "b", kind: "event" })).toBe("/specials/b");
    expect(specialHref({ id: "c", kind: "tourism" })).toBe("/specials/c");
  });

  it("uses the newest photo it can find for the cover", () => {
    const empty = { status: "ready" as const, specials: [] };
    expect(coverImageFor({ activeListings: [], catalogue: empty })).toBeNull();
    expect(
      coverImageFor({
        activeListings: [],
        catalogue: {
          ...empty,
          specials: [{ id: "s", kind: "event", title: "", venueName: "", address: "", priceCents: null, originalPriceCents: null, startsAt: "2026-11-29T09:00:00Z", endsAt: "2026-11-29T13:00:00Z", state: "upcoming", imageUrl: "https://x.supabase.co/a.jpg" }],
        },
      }),
    ).toBe("https://x.supabase.co/a.jpg");
  });

  it("lists only what the owner has left to do", () => {
    const remaining = ownerChecklist({ avatarUrl: "x", bio: "  ", languages: ["English"], verificationBadges: ["email"] })
      .filter((item) => !item.done)
      .map((item) => item.key);
    expect(remaining).toEqual(["bio", "identity"]);
  });
});
