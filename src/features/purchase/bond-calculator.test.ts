import { describe, expect, it } from "vitest";

import { calculateMonthlyBond } from "./bond-calculator";

describe("calculateMonthlyBond", () => {
  it("calculates a rounded repayment with default assumptions", () => {
    const estimate = calculateMonthlyBond({ purchasePrice: 2_000_000 });

    expect(estimate.deposit).toBe(200_000);
    expect(estimate.principal).toBe(1_800_000);
    expect(estimate.monthlyRepayment).toBeGreaterThan(19_000);
    expect(estimate.monthlyRepayment).toBeLessThan(20_500);
  });

  it("handles zero-interest loans", () => {
    expect(
      calculateMonthlyBond({
        purchasePrice: 1_200_000,
        deposit: 200_000,
        annualInterestRate: 0,
        loanTermYears: 10,
      }).monthlyRepayment,
    ).toBe(8333);
  });
});
