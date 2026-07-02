import { describe, expect, it } from "vitest";

import { validateProfileUpdateInput } from "./schema";

describe("profile update validation", () => {
  it("trims and accepts a phone number", () => {
    const result = validateProfileUpdateInput("  +27 82 000 0000  ");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.phone).toBe("+27 82 000 0000");
    }
  });

  it("rejects blank phone numbers", () => {
    const result = validateProfileUpdateInput("   ");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.phone).toContain("Phone number is required");
    }
  });

  it("rejects missing phone numbers", () => {
    const result = validateProfileUpdateInput(null);

    expect(result.success).toBe(false);
  });
});
