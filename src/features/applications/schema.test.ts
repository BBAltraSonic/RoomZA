import { describe, expect, it } from "vitest";

import { applicationSchema, documentTypeSchema } from "./schema";

const validApplication = {
  listingId: "11111111-1111-4111-8111-111111111111",
  fullName: "Renter One",
  income: "18500",
  employmentStatus: "Employed",
  moveInDate: "2026-08-01",
  householdSize: "2",
};

describe("application schemas", () => {
  it("accepts supported document types", () => {
    expect(documentTypeSchema.parse("id")).toBe("id");
    expect(documentTypeSchema.parse("payslip")).toBe("payslip");
  });

  it("coerces numeric application fields for valid submissions", () => {
    const result = applicationSchema.parse(validApplication);

    expect(result.income).toBe(18500);
    expect(result.householdSize).toBe(2);
  });

  it("rejects invalid application boundaries", () => {
    expect(documentTypeSchema.safeParse("lease").success).toBe(false);
    expect(applicationSchema.safeParse({ ...validApplication, listingId: "bad-id" }).success).toBe(false);
    expect(applicationSchema.safeParse({ ...validApplication, fullName: "A" }).success).toBe(false);
    expect(applicationSchema.safeParse({ ...validApplication, householdSize: 11 }).success).toBe(false);
  });
});
