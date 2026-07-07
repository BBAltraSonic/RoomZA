import { describe, expect, it } from "vitest";

import { calculateTrueMonthlyCost } from "./true-monthly-cost";

const baseListing = {
  price: 7500,
  property_type: "apartment",
  bedrooms: 2,
  parking_count: 1,
  electricity_type: "prepaid",
  water_availability: "municipal",
  metadata: { amenities: { essentials: [], security: [], lifestyle: [], appliances: [] } },
};

describe("calculateTrueMonthlyCost", () => {
  it("uses landlord estimates before Pinpoints fallback estimates", () => {
    const estimate = calculateTrueMonthlyCost(
      {
        ...baseListing,
        electricity_estimate: 850,
        water_estimate: 300,
        wifi_available: true,
        wifi_estimate: 699,
      },
      { householdSize: 1, transportMethod: "none" },
    );

    expect(estimate.rows.find((row) => row.category === "electricity")).toMatchObject({
      amount: 850,
      source: "landlord estimate",
    });
    expect(estimate.rows.find((row) => row.category === "water")).toMatchObject({
      amount: 300,
      source: "landlord estimate",
    });
    expect(estimate.rows.find((row) => row.category === "wifi")).toMatchObject({
      amount: 699,
      source: "landlord estimate",
    });
  });

  it("sets included categories to zero", () => {
    const estimate = calculateTrueMonthlyCost(
      {
        ...baseListing,
        electricity_included: true,
        water_included: true,
        wifi_included: true,
        parking_included: true,
      },
      { householdSize: 2, transportMethod: "none" },
    );

    expect(estimate.rows.filter((row) => row.source === "included").map((row) => row.category)).toEqual([
      "electricity",
      "water",
      "wifi",
      "parking",
    ]);
    expect(estimate.rows.filter((row) => row.source === "included").every((row) => row.amount === 0)).toBe(true);
  });

  it("increases usage-sensitive estimates with household size", () => {
    const single = calculateTrueMonthlyCost(baseListing, { householdSize: 1, transportMethod: "none" });
    const family = calculateTrueMonthlyCost(baseListing, { householdSize: 4, transportMethod: "none" });

    expect(family.rows.find((row) => row.category === "electricity")!.amount).toBeGreaterThan(
      single.rows.find((row) => row.category === "electricity")!.amount,
    );
    expect(family.rows.find((row) => row.category === "groceries")!.amount).toBeGreaterThan(
      single.rows.find((row) => row.category === "groceries")!.amount,
    );
  });

  it("uses a zero transport estimate until the renter enters a commute cost", () => {
    const estimate = calculateTrueMonthlyCost(baseListing, { householdSize: 1, transportMethod: "taxi" });

    expect(estimate.rows.find((row) => row.category === "transport")).toMatchObject({
      amount: 0,
      source: "Pinpoints estimate",
    });
  });

  it("adds a warning when transport materially changes affordability", () => {
    const estimate = calculateTrueMonthlyCost(baseListing, {
      householdSize: 1,
      transportMethod: "taxi",
      monthlyTransportCost: 2000,
    });

    expect(estimate.rows.find((row) => row.category === "transport")).toMatchObject({
      amount: 2000,
      source: "renter input",
    });
    expect(estimate.warnings).toContain("High transport costs may offset lower rent.");
  });
});
