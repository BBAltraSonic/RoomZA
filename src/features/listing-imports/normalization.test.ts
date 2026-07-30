import { describe, expect, it } from "vitest";

import {
  addressFingerprint,
  mapRecord,
  normalizeDate,
  normalizeMoney,
  normalizeSouthAfricanPhone,
  validateCanonicalListing,
} from "./normalization";

describe("listing import normalization", () => {
  it("normalizes South African money, phone numbers, dates, and enums", () => {
    const listing = mapRecord(
      {
        rowNumber: 1,
        raw: {
          ref: " ZA-44 ",
          transaction: "Rental",
          price: "R 12,450.49",
          phone: "082 123 4567",
          available: "2026-08-15",
        },
      },
      {
        ref: "sourceReference",
        transaction: "listingType",
        price: "price",
        phone: "contactPhone",
        available: "availabilityDate",
      },
      {},
      { listingType: { rental: "rent" } },
    );
    expect(listing).toMatchObject({
      sourceReference: "ZA-44",
      listingType: "rent",
      price: 12450,
      contactPhone: "+27821234567",
      availabilityDate: "2026-08-15",
    });
    expect(normalizeMoney("(R 2,000)")).toBe(-2000);
    expect(normalizeSouthAfricanPhone("+27 (82) 123-4567")).toBe("+27821234567");
    expect(normalizeDate("15 Aug 2026")).toBe("2026-08-15");
  });

  it("classifies minimum draft blockers separately from publish blockers", () => {
    const issues = validateCanonicalListing({
      title: "A home",
      listingType: "rent",
      price: 8_000,
      address: "1 Main Road, Cape Town",
      responsibleAgentId: "member-1",
    });
    expect(issues.some((issue) => issue.severity === "blocking")).toBe(false);
    expect(issues.some((issue) => issue.severity === "publish_blocker" && issue.code === "ambiguous_geocode")).toBe(true);
  });

  it("creates stable normalized address fingerprints", () => {
    expect(addressFingerprint("12 Main Street, Cape Town")).toBe(addressFingerprint("12 main st cape-town"));
  });
});
