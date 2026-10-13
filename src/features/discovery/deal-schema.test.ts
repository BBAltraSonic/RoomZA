import { describe, expect, it } from "vitest";
import { discountPercent, formatDealPrice, parseRandInput, requireMediaRights } from "./deal-schema";
import { offerContentSchema, offerDraftSchema } from "@/features/offers/schema";
import { entryDraftSchema } from "@/features/entries/schema";
import { specialTiming } from "./discovery-clock";
const content = { title: "Pizza", benefit: "Any large pizza", terms: "After 8pm", shopName: "Slice", areaId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", address: "Cape Town", latitude: -33.9, longitude: 18.4, startsAt: "2026-10-09T10:00:00Z", endsAt: "2026-10-09T14:00:00Z" };
describe("Special pricing and media contracts", () => {
 it("keeps legacy records valid and stores prices as exact cents", () => { expect(offerContentSchema.parse(content)).toEqual(content); expect(parseRandInput("19.99")).toBe(1999); expect(parseRandInput("0")).toBe(0); expect(parseRandInput("")).toBeUndefined(); expect(() => parseRandInput("1.001")).toThrow(); expect(() => parseRandInput("1e3")).toThrow(); });
 it("supports free prices and calculates rather than trusts discounts", () => { expect(formatDealPrice(0)).toBe("Free"); expect(formatDealPrice(9900)).toBe("R99"); expect(discountPercent(9900,15500)).toBe(36); expect(discountPercent(4500,7200)).toBe(38); expect(discountPercent(undefined,15500)).toBeNull(); });
 it("rejects invalid and unpaired prices across every Special", () => { for(const schema of [offerDraftSchema,entryDraftSchema]) { expect(schema.safeParse({ priceCents: -1 }).success).toBe(false); expect(schema.safeParse({ priceCents: 1.1 }).success).toBe(false); expect(schema.safeParse({ originalPriceCents: 100 }).success).toBe(false); expect(schema.safeParse({ priceCents: 100, originalPriceCents: 100 }).success).toBe(false); expect(schema.safeParse({ priceCents: 0, originalPriceCents: 100 }).success).toBe(true); } });
 it("requires photo rights only when photos are supplied", () => { expect(() => requireMediaRights({})).not.toThrow(); expect(() => requireMediaRights({ mediaIds: ["id"] })).toThrow(); expect(() => requireMediaRights({ mediaIds: ["id"], mediaRightsConfirmed: true })).not.toThrow(); });
});
describe("server-anchored time boundaries", () => {
 const start = "2026-10-09T10:00:00Z", end = "2026-10-09T14:00:00Z";
 it("uses strict one-hour and three-hour boundaries", () => { expect(specialTiming(start,end,Date.parse(end)-3600000).tone).toBe("soon"); expect(specialTiming(start,end,Date.parse(end)-3599999).tone).toBe("urgent"); expect(specialTiming(start,end,Date.parse(end)-10800000).tone).toBe("later"); });
 it("transitions upcoming events to live and expires at the exact end", () => { expect(specialTiming(start,end,Date.parse(start)-1).upcoming).toBe(true); expect(specialTiming(start,end,Date.parse(start)).upcoming).toBe(false); expect(specialTiming(start,end,Date.parse(end)).ended).toBe(true); expect(specialTiming(start,end,Date.parse(end)+1000).progress).toBe(0); });
});
