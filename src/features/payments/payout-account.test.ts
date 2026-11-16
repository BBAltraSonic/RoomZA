import { describe, expect, it } from "vitest";

import { payoutAccountSchema } from "./payout-account";

const valid = { accountHolder: "Thandi Owner", bankName: "FNB", branchCode: "250655", accountNumber: "62000000001" };

describe("payoutAccountSchema", () => {
  it("should accept South African bank details and tidy spaces out of the numbers", () => {
    expect(payoutAccountSchema.parse({
      accountHolder: "  Thandi Owner ", bankName: " FNB ", branchCode: "250 655", accountNumber: "6200 0000 001",
    })).toEqual(valid);
  });

  it("should accept dashes in an account number as people often copy them from a bank app", () => {
    expect(payoutAccountSchema.parse({ ...valid, accountNumber: "620-000-000-01" }).accountNumber).toBe("62000000001");
  });

  it("should reject a branch code that is not six digits", () => {
    for (const branchCode of ["25065", "2506555", "25065a", ""]) {
      expect(payoutAccountSchema.safeParse({ ...valid, branchCode }).success).toBe(false);
    }
  });

  it("should reject an account number outside 6 to 16 digits", () => {
    for (const accountNumber of ["12345", "12345678901234567", "62000O00001"]) {
      expect(payoutAccountSchema.safeParse({ ...valid, accountNumber }).success).toBe(false);
    }
  });

  it("should reject a missing account holder or bank", () => {
    expect(payoutAccountSchema.safeParse({ ...valid, accountHolder: " A " }).success).toBe(false);
    expect(payoutAccountSchema.safeParse({ ...valid, bankName: "" }).success).toBe(false);
    expect(payoutAccountSchema.safeParse({ ...valid, accountHolder: "x".repeat(121) }).success).toBe(false);
  });
});
