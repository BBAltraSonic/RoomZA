import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { emptyAmenities, listingSchema } from "./schema";
import { duplicateTitle, hasBlockingApplications, validateImageUpload, type ApplicationStatus } from "./types";

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

describe("listing helpers", () => {
  it("P2 image validation accepts only allowed mime types and sizes", () => {
    fc.assert(
      fc.property(fc.string(), fc.integer({ min: -1, max: 12 * 1024 * 1024 }), (type, size) => {
        const result = validateImageUpload(type, size);
        const expected = ["image/jpeg", "image/png", "image/webp"].includes(type) && size > 0 && size <= 10 * 1024 * 1024;
        expect(result.valid).toBe(expected);
      }),
    );
  });

  it("P4 duplicate title trims and appends copy suffix", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 80 }), (title) => {
        const duplicated = duplicateTitle(title);
        expect(duplicated.endsWith(" (Copy)")).toBe(true);
        expect(duplicated.startsWith(title.trim() || "Untitled listing")).toBe(true);
      }),
    );
  });

  it("P12 listing schema parse round-trip keeps valid primitive fields", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100_000 }), fc.float({ min: -90, max: 90, noNaN: true }), fc.float({ min: -180, max: 180, noNaN: true }), (price, latitude, longitude) => {
        const result = listingSchema.safeParse({ ...completeListing, price, latitude, longitude, metadata: { amenities: emptyAmenities } });
        expect(result.success).toBe(true);
      }),
    );
  });

  it("P13 detects active applications that block deletion", () => {
    const statuses: ApplicationStatus[] = ["submitted", "under_review", "shortlisted", "rejected", "approved", "withdrawn"];
    fc.assert(
      fc.property(fc.array(fc.constantFrom(...statuses), { maxLength: 20 }), (items) => {
        expect(hasBlockingApplications(items)).toBe(items.some((status) => ["submitted", "under_review", "shortlisted", "approved"].includes(status)));
      }),
    );
  });
});
