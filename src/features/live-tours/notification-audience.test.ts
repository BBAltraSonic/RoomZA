import { describe, expect, it } from "vitest";

import { selectTourAlertAudience } from "./notification-audience";

const listing = {
  id: "listing-1",
  title: "Braamfontein studio",
  address: "90 De Korte Street",
  latitude: -26.192,
  longitude: 28.034,
  price: 7_200,
  salePrice: null,
  listingType: "rent" as const,
  bedrooms: 1,
  bathrooms: 1,
  propertyType: "apartment",
};

const matchingBounds = {
  bounding_box_west: 28,
  bounding_box_south: -26.3,
  bounding_box_east: 28.1,
  bounding_box_north: -26.1,
};

describe("scheduled live-tour alert audience", () => {
  it("deduplicates saved users and matching authenticated alerts", () => {
    const audience = selectTourAlertAudience({
      listing,
      savedListings: [{ user_id: "user-1" }],
      searchAlerts: [
        {
          ...matchingBounds,
          user_id: "user-1",
          email: "one@example.com",
          filters: { mode: "rent", price: { max: 8_000 } },
        },
        {
          ...matchingBounds,
          user_id: "user-2",
          email: "two@example.com",
          filters: { beds: 1 },
        },
      ],
    });

    expect(audience.recipientIds.sort()).toEqual(["user-1", "user-2"]);
    expect(audience.anonymousEmails).toEqual([]);
  });

  it("honours alert filters, bounds, and disabled search-alert preferences", () => {
    const audience = selectTourAlertAudience({
      listing,
      savedListings: [],
      searchAlerts: [
        {
          ...matchingBounds,
          user_id: "disabled-user",
          email: "disabled@example.com",
          filters: null,
        },
        {
          ...matchingBounds,
          user_id: null,
          email: "MATCH@example.com",
          filters: { type: "apartment", q: "Braamfontein" },
        },
        {
          ...matchingBounds,
          user_id: null,
          email: "too-expensive@example.com",
          filters: { maxPrice: 6_000 },
        },
        {
          bounding_box_west: 18,
          bounding_box_south: -34,
          bounding_box_east: 19,
          bounding_box_north: -33,
          user_id: null,
          email: "cape-town@example.com",
          filters: null,
        },
      ],
      searchAlertsDisabledFor: ["disabled-user"],
    });

    expect(audience.recipientIds).toEqual([]);
    expect(audience.anonymousEmails).toEqual(["match@example.com"]);
  });
});
