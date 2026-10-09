import { describe, expect, it } from "vitest";
import { publicOfferActionSchema, publicOfferDetailSchema, publicOfferFeedSchema } from "./public-contract";

const id = "00000000-0000-4000-8000-000000000001";
const now = "2026-10-02T10:00:00Z";
const live = {
  status: "live", offerId: id, revisionId: id, confirmedAt: now, startsAt: now,
  endsAt: "2026-10-03T10:00:00Z", areaId: id,
  content: { title: "Offer", benefit: "Benefit", terms: "Terms", shopName: "Shop", areaId: id, address: "Public shop address", latitude: -33.96, longitude: 18.47, startsAt: now, endsAt: "2026-10-03T10:00:00Z" },
  place: { id, name: "Place", region: "Region", fullAddress: "Place, South Africa" },
  poster: null,
};
describe("public offer boundary", () => {
  it("rejects private evidence and contact fields instead of forwarding them", () => {
    expect(publicOfferDetailSchema.safeParse({ ...live, serverNow: now, actorId: id }).success).toBe(false);
    expect(publicOfferDetailSchema.safeParse({ ...live, serverNow: now, content: { ...live.content, sourceReference: "private permission" } }).success).toBe(false);
    expect(publicOfferDetailSchema.safeParse({ ...live, serverNow: now, poster: { username: "poster", displayName: "Public name", email: "private@example.com" } }).success).toBe(false);
  });
  it("accepts only minimal unknown and content-free inactive states", () => {
    expect(publicOfferDetailSchema.parse({ status: "unavailable", serverNow: now }).status).toBe("unavailable");
    expect(publicOfferDetailSchema.safeParse({ status: "unavailable", serverNow: now, offerId: id }).success).toBe(false);
    for (const status of ["scheduled", "expired"]) {
      expect(publicOfferDetailSchema.safeParse({ ...live, status, serverNow: now }).success).toBe(false);
      expect(publicOfferDetailSchema.safeParse({ ...live, status, content: null, place: null, poster: null, serverNow: now }).success).toBe(true);
    }
  });
  it("keeps inactive offers and overlong pages out of the Feed contract", () => {
    const feed = { areaId: id, serverNow: now, totalCount: 21, items: Array(20).fill(live), nextCursor: { confirmedAt: now, offerId: id } };
    expect(publicOfferFeedSchema.safeParse(feed).success).toBe(true);
    expect(publicOfferFeedSchema.safeParse({ ...feed, items: Array(21).fill(live) }).success).toBe(false);
    expect(publicOfferFeedSchema.safeParse({ ...feed, items: [{ ...live, status: "expired", content: null, place: null }] }).success).toBe(false);
  });
  it("constrains action destinations to finite coordinates and public shop facts", () => {
    const action = { offerId: id, revisionId: id, serverNow: now, endsAt: live.endsAt, shopName: "Shop", address: "Address", latitude: -33.96, longitude: 18.47 };
    expect(publicOfferActionSchema.parse(null)).toBe(null);
    expect(publicOfferActionSchema.safeParse(action).success).toBe(true);
    expect(publicOfferActionSchema.safeParse({ ...action, latitude: Infinity }).success).toBe(false);
    expect(publicOfferActionSchema.safeParse({ ...action, destination: "https://unreviewed.invalid" }).success).toBe(false);
  });
});
