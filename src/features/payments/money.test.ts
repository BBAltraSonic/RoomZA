import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { commissionCents, estimateCardFeeCents, randsToCents, refundBreakdown, releaseBreakdown } from "./money";

const amount = fc.integer({ min: 1, max: 100_000_000 });
const rateBps = fc.integer({ min: 0, max: 10_000 });

describe("randsToCents", () => {
  it("should convert whole rands to cents", () => {
    expect(randsToCents(8_000)).toBe(800_000);
  });

  it("should reject amounts that are not positive whole rands", () => {
    expect(() => randsToCents(0)).toThrow(RangeError);
    expect(() => randsToCents(-5)).toThrow(RangeError);
    expect(() => randsToCents(10.5)).toThrow(RangeError);
    expect(() => randsToCents(Number.NaN)).toThrow(RangeError);
  });
});

describe("commissionCents", () => {
  it("should take 10% of an R8,000 deposit", () => {
    expect(commissionCents(800_000, 1_000)).toBe(80_000);
  });

  it("should round half a cent up", () => {
    // 10% of R0.05 is half a cent.
    expect(commissionCents(5, 1_000)).toBe(1);
    expect(commissionCents(4, 1_000)).toBe(0);
  });

  it("should reject a rate outside 0 to 100%", () => {
    expect(() => commissionCents(800_000, -1)).toThrow(RangeError);
    expect(() => commissionCents(800_000, 10_001)).toThrow(RangeError);
    expect(() => commissionCents(800_000, 12.5)).toThrow(RangeError);
  });

  it("should reject an amount that is not positive whole cents", () => {
    expect(() => commissionCents(0, 1_000)).toThrow(RangeError);
    expect(() => commissionCents(100.5, 1_000)).toThrow(RangeError);
  });
});

describe("releaseBreakdown", () => {
  it("should pay the owner the deposit less commission", () => {
    expect(releaseBreakdown({ amountCents: 800_000, commissionBps: 1_000 })).toEqual({
      commissionCents: 80_000,
      ownerPayoutCents: 720_000,
    });
  });

  it("should always split the deposit exactly between owner and commission", () => {
    fc.assert(
      fc.property(amount, rateBps, (amountCents, commissionBps) => {
        const split = releaseBreakdown({ amountCents, commissionBps });
        expect(split.commissionCents + split.ownerPayoutCents).toBe(amountCents);
        expect(split.commissionCents).toBeGreaterThanOrEqual(0);
        expect(split.ownerPayoutCents).toBeGreaterThanOrEqual(0);
      }),
    );
  });
});

describe("refundBreakdown", () => {
  it("should keep the processing fee when the renter cancels", () => {
    expect(
      refundBreakdown({ amountCents: 800_000, providerFeeCents: 26_795, cancellationFeeApplies: true }),
    ).toEqual({ cancellationFeeCents: 26_795, renterRefundCents: 773_205 });
  });

  it("should refund in full when the cancellation fee does not apply", () => {
    expect(
      refundBreakdown({ amountCents: 800_000, providerFeeCents: 26_795, cancellationFeeApplies: false }),
    ).toEqual({ cancellationFeeCents: 0, renterRefundCents: 800_000 });
  });

  it("should never keep more than the deposit", () => {
    expect(refundBreakdown({ amountCents: 100, providerFeeCents: 500, cancellationFeeApplies: true })).toEqual({
      cancellationFeeCents: 100,
      renterRefundCents: 0,
    });
  });

  it("should reject a negative or fractional processing fee", () => {
    expect(() =>
      refundBreakdown({ amountCents: 800_000, providerFeeCents: -1, cancellationFeeApplies: true }),
    ).toThrow(RangeError);
    expect(() =>
      refundBreakdown({ amountCents: 800_000, providerFeeCents: 1.5, cancellationFeeApplies: true }),
    ).toThrow(RangeError);
  });

  it("should always split the deposit exactly between renter and fee", () => {
    fc.assert(
      fc.property(amount, fc.integer({ min: 0, max: 200_000_000 }), fc.boolean(), (amountCents, fee, applies) => {
        const split = refundBreakdown({ amountCents, providerFeeCents: fee, cancellationFeeApplies: applies });
        expect(split.cancellationFeeCents + split.renterRefundCents).toBe(amountCents);
        expect(split.renterRefundCents).toBeGreaterThanOrEqual(0);
        if (!applies) expect(split.cancellationFeeCents).toBe(0);
      }),
    );
  });
});

describe("estimateCardFeeCents", () => {
  it("should estimate Paystack's local card fee of 2.9% plus R1, with VAT, on an R8,000 deposit", () => {
    // (R232 + R1) * 1.15 = R267.95
    expect(estimateCardFeeCents(800_000)).toBe(26_795);
  });

  it("should round a part cent up so the estimate never understates the fee", () => {
    // (0.029 * 100 + 100) * 1.15 = 118.335 cents
    expect(estimateCardFeeCents(100)).toBe(119);
  });

  it("should reject amounts that are not positive whole cents", () => {
    expect(() => estimateCardFeeCents(0)).toThrow(RangeError);
    expect(() => estimateCardFeeCents(10.5)).toThrow(RangeError);
  });

  it("should never estimate more than the deposit plus the fixed part", () => {
    fc.assert(fc.property(amount, (cents) => {
      const fee = estimateCardFeeCents(cents);
      return fee > 0 && fee <= Math.ceil(cents * 0.029 * 1.15 + 115) + 1;
    }));
  });
});
