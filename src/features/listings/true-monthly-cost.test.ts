import { describe, expect, it } from "vitest";

import { calculateMoveInCost, calculateTrueMonthlyCost, listingMoveInCost } from "./true-monthly-cost";

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

describe("calculateMoveInCost", () => {
  it("returns each upfront charge and the total move-in amount", () => {
    expect(
      calculateMoveInCost({
        monthlyRent: 7500,
        deposit: 9000,
        adminFee: 650,
        parking: 500,
      }),
    ).toEqual({
      monthlyRent: 7500,
      deposit: 9000,
      adminFee: 650,
      parking: 500,
      total: 17650,
    });
  });

  it("uses one month's rent as the deposit and treats omitted optional charges as zero", () => {
    expect(calculateMoveInCost({ monthlyRent: 7500 })).toEqual({
      monthlyRent: 7500,
      deposit: 7500,
      adminFee: 0,
      parking: 0,
      total: 15000,
    });
  });

  it("does not allow negative advertised charges to reduce the total", () => {
    expect(calculateMoveInCost({ monthlyRent: -7500, deposit: -1, adminFee: -1, parking: -1 }).total).toBe(0);
  });
});

describe("listingMoveInCost", () => {
  it("should_use_the_published_deposit_and_admin_fee_when_the_lister_discloses_them", () => {
    expect(listingMoveInCost({ price: 6000, deposit_amount: 9000, admin_fee: 750 })).toEqual({
      monthlyRent: 6000,
      deposit: 9000,
      adminFee: 750,
      parking: 0,
      total: 15750,
      depositDisclosed: true,
      adminFeeDisclosed: true,
    });
  });

  it("should_mark_the_deposit_as_an_estimate_when_the_lister_has_not_published_one", () => {
    const cost = listingMoveInCost({ price: 6000 });

    expect(cost.deposit).toBe(6000);
    expect(cost.depositDisclosed).toBe(false);
    expect(cost.adminFeeDisclosed).toBe(false);
    expect(cost.total).toBe(12000);
  });

  it("should_treat_a_zero_admin_fee_as_a_disclosed_no_fee", () => {
    const cost = listingMoveInCost({ price: 6000, deposit_amount: 6000, admin_fee: 0 });

    expect(cost.adminFee).toBe(0);
    expect(cost.adminFeeDisclosed).toBe(true);
  });
});
