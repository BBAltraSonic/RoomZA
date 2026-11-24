import { describe, expect, it } from "vitest";

import { buildToday, type TodayCounts } from "./today";

const zero: TodayCounts = {
  enquiriesWaiting: 0,
  applicationsToReview: 0,
  viewingRequests: 0,
  bookingRequests: 0,
  followUps: 0,
  listingsNeedingInfo: 0,
  expiringSpecials: 0,
};
const landlord = { rentals: true, sales: false, services: false, specials: false };

describe("buildToday", () => {
  it("should_show_counts_with_plural_wording", () => {
    const today = buildToday({ ...zero, enquiriesWaiting: 4, applicationsToReview: 1, listingsNeedingInfo: 1 }, landlord);
    expect(today.items.map((item) => item.label)).toEqual(["4 enquiries waiting on you", "1 application to review", "1 listing missing important info"]);
    expect(today.items.at(-1)!.action).toBe("Fix");
  });

  it("should_say_a_count_failed_instead_of_showing_zero", () => {
    const today = buildToday({ ...zero, applicationsToReview: null }, landlord);
    expect(today.items).toEqual([]);
    expect(today.notes).toEqual([{ key: "applicationsToReview", message: "Applications couldn't load, try again" }]);
  });

  it("should_only_show_what_the_lister_has", () => {
    const provider = { rentals: false, sales: false, services: true, specials: false };
    const today = buildToday({ ...zero, applicationsToReview: 3, bookingRequests: 2, expiringSpecials: null }, provider);
    expect(today.items.map((item) => item.key)).toEqual(["bookingRequests"]);
    expect(today.notes).toEqual([]);
  });

  it("should_badge_things_waiting_on_the_lister_not_listing_fixes", () => {
    expect(buildToday({ ...zero, enquiriesWaiting: 2, viewingRequests: 1, listingsNeedingInfo: 5 }, landlord).badge).toBe(3);
  });
});
