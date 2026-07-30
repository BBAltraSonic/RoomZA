import { describe, expect, it } from "vitest";

import { calculatePersonaCompletion } from "./completion";

const completeSharedProfile = {
  displayName: "Alex",
  avatarUrl: "https://example.com/avatar.jpg",
  bio: "Looking for a long-term home.",
  languages: ["English"],
};

describe("persona completion", () => {
  it("uses only the explicit equal-weight renter registry", () => {
    expect(
      calculatePersonaCompletion("renter", completeSharedProfile, {
        occupation: "Designer",
        rentBudgetMin: 8_000,
        rentBudgetMax: 12_000,
        preferredAreas: ["Rosebank"],
        moveInDate: "2026-09-01",
        householdSize: 1,
        monthlyIncome: 100_000,
        verified: true,
      }),
    ).toBe(100);
  });

  it("does not let optional or verified fields inflate an incomplete profile", () => {
    expect(
      calculatePersonaCompletion(
        "buyer",
        { displayName: "Sam" },
        {
          verified: true,
          mortgageProvider: "Example Bank",
          propertyGoals: ["investment"],
        },
      ),
    ).toBe(10);
  });

  it("treats zero and false as completed values where they are valid", () => {
    expect(
      calculatePersonaCompletion("landlord", completeSharedProfile, {
        businessName: "Home Owner",
        portfolioSize: 0,
        yearsManaging: 0,
        ownerType: "private_owner",
        officeLocation: "Johannesburg",
      }),
    ).toBe(100);
  });
});
