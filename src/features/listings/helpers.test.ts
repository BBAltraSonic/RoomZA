import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { emptyAmenities, listingSchema } from "./schema";
import {
  duplicateTitle,
  hasBlockingApplications,
  MAX_LISTING_IMAGE_SIZE_BYTES,
  MAX_LISTING_IMAGES,
  validateImageUpload,
  validateListingImageCount,
  type ApplicationStatus,
} from "./types";

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
        const expected = ["image/jpeg", "image/png", "image/webp"].includes(type) && size > 0 && size <= MAX_LISTING_IMAGE_SIZE_BYTES;
        expect(result.valid).toBe(expected);
      }),
      { numRuns: 100 },
    );
  });

  it("Property 15: File-upload bound enforcement", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: MAX_LISTING_IMAGES + 5 }),
        fc.integer({ min: 0, max: MAX_LISTING_IMAGES + 5 }),
        fc.constantFrom("image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"),
        fc.integer({ min: 0, max: MAX_LISTING_IMAGE_SIZE_BYTES + 1024 }),
        (existing, incoming, type, size) => {
          const countResult = validateListingImageCount(existing, incoming);
          const fileResult = validateImageUpload(type, size);
          const normalizedExisting = Math.max(0, Math.floor(Number.isFinite(existing) ? existing : 0));
          const normalizedIncoming = Math.max(0, Math.floor(Number.isFinite(incoming) ? incoming : 0));
          const countAllowed = normalizedIncoming >= 1 && normalizedExisting + normalizedIncoming <= MAX_LISTING_IMAGES;
          const fileAllowed = ["image/jpeg", "image/png", "image/webp"].includes(type) && size > 0 && size <= MAX_LISTING_IMAGE_SIZE_BYTES;
          const stored = countResult.valid && fileResult.valid;

          expect(countResult.valid).toBe(countAllowed);
          expect(fileResult.valid).toBe(fileAllowed);
          expect(stored).toBe(countAllowed && fileAllowed);

          if (normalizedIncoming < 1) {
            expect(countResult).toEqual({ valid: false, error: "Upload at least 1 image." });
          } else if (normalizedExisting + normalizedIncoming > MAX_LISTING_IMAGES) {
            expect(countResult).toEqual({ valid: false, error: `Listing images are limited to ${MAX_LISTING_IMAGES} total.` });
          }
          if (!["image/jpeg", "image/png", "image/webp"].includes(type)) {
            expect(fileResult).toEqual({ valid: false, error: "Only JPEG, PNG, and WebP images are allowed." });
          }
          if (["image/jpeg", "image/png", "image/webp"].includes(type) && size > MAX_LISTING_IMAGE_SIZE_BYTES) {
            expect(fileResult).toEqual({ valid: false, error: "Image must be smaller than 10 MB." });
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("P4 duplicate title trims and appends copy suffix", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 80 }), (title) => {
        const duplicated = duplicateTitle(title);
        expect(duplicated.endsWith(" (Copy)")).toBe(true);
        expect(duplicated.startsWith(title.trim() || "Untitled listing")).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it("P12 listing schema parse round-trip keeps valid primitive fields", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100_000 }), fc.float({ min: -90, max: 90, noNaN: true }), fc.float({ min: -180, max: 180, noNaN: true }), (price, latitude, longitude) => {
        const result = listingSchema.safeParse({ ...completeListing, price, latitude, longitude, metadata: { amenities: emptyAmenities } });
        expect(result.success).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it("P13 detects active applications that block deletion", () => {
    const statuses: ApplicationStatus[] = ["submitted", "under_review", "shortlisted", "rejected", "approved", "withdrawn"];
    fc.assert(
      fc.property(fc.array(fc.constantFrom(...statuses), { maxLength: 20 }), (items) => {
        expect(hasBlockingApplications(items)).toBe(items.some((status) => ["submitted", "under_review", "shortlisted", "approved"].includes(status)));
      }),
      { numRuns: 100 },
    );
  });
});
