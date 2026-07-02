import { describe, expect, it } from "vitest";

import { canJoinLiveViewing, liveViewingBackUrl } from "./live-viewing-access";

describe("live viewing access", () => {
  it("allows a booked video viewing from 10 minutes before start through 2 hours after end", () => {
    const startsAt = "2026-07-01T10:00:00.000Z";
    const endsAt = "2026-07-01T11:00:00.000Z";

    expect(canJoinLiveViewing({ status: "booked", mode: "video_call", startsAt, endsAt, now: new Date("2026-07-01T09:50:00.000Z") })).toBe(true);
    expect(canJoinLiveViewing({ status: "booked", mode: "video_call", startsAt, endsAt, now: new Date("2026-07-01T13:00:00.000Z") })).toBe(true);
    expect(canJoinLiveViewing({ status: "booked", mode: "video_call", startsAt, endsAt, now: new Date("2026-07-01T09:49:59.999Z") })).toBe(false);
    expect(canJoinLiveViewing({ status: "booked", mode: "video_call", startsAt, endsAt, now: new Date("2026-07-01T13:00:00.001Z") })).toBe(false);
  });

  it("rejects non-video or non-booked viewings", () => {
    const startsAt = "2026-07-01T10:00:00.000Z";
    const endsAt = "2026-07-01T11:00:00.000Z";
    const now = new Date("2026-07-01T10:15:00.000Z");

    expect(canJoinLiveViewing({ status: "proposed", mode: "video_call", startsAt, endsAt, now })).toBe(false);
    expect(canJoinLiveViewing({ status: "booked", mode: "in_person", startsAt, endsAt, now })).toBe(false);
  });

  it("sends landlords back to their listing applicant queue", () => {
    expect(liveViewingBackUrl({ listingId: "listing-1", landlordId: "user-1", userId: "user-1" })).toBe("/dashboard/listings/listing-1/applicants");
    expect(liveViewingBackUrl({ listingId: "listing-1", landlordId: "landlord-1", userId: "renter-1" })).toBe("/applications");
  });
});
