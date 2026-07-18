import { describe, expect, it } from "vitest";

import { amenitiesSchema, listingDraftSchema, listingSchema } from "./schema";

const validListing = {
  title: "Sunny two bedroom flat",
  description: "Close to transit.",
  property_type: "apartment",
  price: "12500",
  address: "12 Market Street",
  latitude: "-26.2041",
  longitude: "28.0473",
  bedrooms: "2",
  bathrooms: "1",
  parking_type: "covered",
  parking_count: "1",
  electricity_type: "prepaid",
  water_availability: "municipal",
  electricity_included: "true",
  electricity_estimate: "",
  water_included: "false",
  water_estimate: undefined,
  wifi_available: "",
  wifi_included: "true",
  wifi_estimate: "450",
  parking_included: "false",
  parking_estimate: "0",
  security_fee_estimate: "",
  lease_duration: "12_months",
  availability_date: "2026-08-01",
};

describe("listing schemas", () => {
  it("parses a valid listing and coerces form string fields", () => {
    const result = listingSchema.parse(validListing);

    expect(result.price).toBe(12500);
    expect(result.latitude).toBe(-26.2041);
    expect(result.electricity_included).toBe(true);
    expect(result.water_included).toBe(false);
    expect(result.electricity_estimate).toBeNull();
    expect(result.security_fee_estimate).toBeNull();
    expect(result.wifi_estimate).toBe(450);
  });

  it("rejects invalid enum, coordinate, and money boundaries", () => {
    expect(listingSchema.safeParse({ ...validListing, property_type: "castle" }).success).toBe(false);
    expect(listingSchema.safeParse({ ...validListing, latitude: "-91" }).success).toBe(false);
    expect(listingSchema.safeParse({ ...validListing, longitude: "181" }).success).toBe(false);
    expect(listingSchema.safeParse({ ...validListing, price: "0" }).success).toBe(false);
    expect(listingSchema.safeParse({ ...validListing, wifi_estimate: "-1" }).success).toBe(false);
  });

  it("accepts only the essential quick-draft fields", () => {
    const result = listingDraftSchema.parse({
      listing_type: "rent",
      title: "Sunny flat in Rosebank",
      property_type: "apartment",
      price: "12000",
      sale_price: "",
      address: "12 Market Street",
      latitude: "-26.2041",
      longitude: "28.0473",
    });

    expect(result.price).toBe(12000);
    expect(result.sale_price).toBeNull();
  });

  it("requires the matching price and a real map pin for quick drafts", () => {
    const base = {
      listing_type: "sale",
      title: "Townhouse in Pretoria",
      property_type: "townhouse",
      price: "",
      sale_price: "",
      address: "1 Church Street",
      latitude: "-25.7479",
      longitude: "28.2293",
    };

    const missingPrice = listingDraftSchema.safeParse(base);
    expect(missingPrice.success).toBe(false);
    if (!missingPrice.success) {
      expect(missingPrice.error.flatten().fieldErrors.sale_price).toBeDefined();
    }

    const missingPin = listingDraftSchema.safeParse({ ...base, sale_price: "1850000", latitude: "", longitude: "" });
    expect(missingPin.success).toBe(false);
    if (!missingPin.success) {
      expect(missingPin.error.flatten().fieldErrors.latitude).toBeDefined();
      expect(missingPin.error.flatten().fieldErrors.longitude).toBeDefined();
    }
  });

  it("defaults amenity categories to empty arrays and rejects unknown amenities", () => {
    expect(amenitiesSchema.parse({})).toEqual({
      essentials: [],
      security: [],
      lifestyle: [],
      appliances: [],
    });
    expect(amenitiesSchema.safeParse({ essentials: ["wifi", "helipad"] }).success).toBe(false);
  });
});
