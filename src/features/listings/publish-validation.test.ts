import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { MIN_LISTING_IMAGES } from "./schema";
import { evaluatePublishReadiness, outstandingConditions } from "./publish-validation";

const completeListing = {
  title: "Modern apartment in Cape Town",
  property_type: "apartment",
  price: 8500,
  address: "123 Long Street, Cape Town",
  latitude: -33.9249,
  longitude: 18.4241,
  bedrooms: 2,
  bathrooms: 1,
  parking_type: "covered",
  parking_count: 1,
  electricity_type: "prepaid",
  water_availability: "municipal",
  lease_duration: "12_months",
  availability_date: "2026-06-01",
};

describe("publish validation", () => {
  it("marks complete listings with enough images as ready", () => {
    const readiness = evaluatePublishReadiness(completeListing, MIN_LISTING_IMAGES);
    expect(readiness.ready).toBe(true);
    expect(outstandingConditions(readiness)).toEqual([]);
  });

  it("reports field and image failures together", () => {
    const readiness = evaluatePublishReadiness({ ...completeListing, address: "", price: -1 }, 1);
    expect(readiness.ready).toBe(false);
    expect(outstandingConditions(readiness).length).toBeGreaterThanOrEqual(3);
  });

  it("keeps lightweight drafts private until deferred fields are complete", () => {
    const readiness = evaluatePublishReadiness({
      ...completeListing,
      bedrooms: null,
      bathrooms: null,
      parking_type: null,
      parking_count: null,
      electricity_type: null,
      water_availability: null,
      lease_duration: null,
      availability_date: null,
    }, MIN_LISTING_IMAGES);

    expect(readiness.ready).toBe(false);
    expect(readiness.fieldErrors).toEqual(expect.arrayContaining([
      "Bedrooms: Enter the number of bedrooms",
      "Available from: Choose the date the property is available",
    ]));
    expect(readiness.fieldErrorsByField.bedrooms).toEqual(["Enter the number of bedrooms"]);
    expect(readiness.fieldErrorsByField.parking_count).toEqual([
      "Enter the number of parking bays, or 0 if there are none",
    ]);
  });

  it("uses actionable photo guidance", () => {
    const readiness = evaluatePublishReadiness(completeListing, 1);

    expect(readiness.imageError).toBe("Add at least 3 photos. You currently have 1.");
  });

  it("P1 readiness reflects field validity and image threshold", () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.integer({ min: 0, max: MIN_LISTING_IMAGES + 4 }),
        (mutateRequiredField, imageCount) => {
          const listing = mutateRequiredField ? { ...completeListing, title: "" } : completeListing;
          const readiness = evaluatePublishReadiness(listing, imageCount);

          expect(readiness.ready).toBe(!mutateRequiredField && imageCount >= MIN_LISTING_IMAGES);
        },
      ),
    );
  });
});
