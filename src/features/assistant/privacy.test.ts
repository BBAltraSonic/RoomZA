import { describe, expect, it } from "vitest";

import { stripContactDetails } from "./privacy";

describe("stripContactDetails", () => {
  it("should_remove_email_addresses", () => {
    expect(stripContactDetails("room near UWC, email me at thandi.m@example.co.za")).toBe(
      "room near UWC, email me at [removed]",
    );
  });

  it("should_remove_south_african_phone_numbers_in_common_formats", () => {
    for (const phone of ["082 123 4567", "0821234567", "+27 82 123 4567", "+27821234567", "(021) 555-1234"]) {
      expect(stripContactDetails(`call ${phone} about a room`)).toBe("call [removed] about a room");
    }
  });

  it("should_remove_thirteen_digit_id_numbers", () => {
    expect(stripContactDetails("my ID is 9001015009087 thanks")).toBe("my ID is [removed] thanks");
  });

  it("should_keep_prices_and_bedroom_counts", () => {
    expect(stripContactDetails("2 bed under R4 500 or 4500")).toBe("2 bed under R4 500 or 4500");
    expect(stripContactDetails("between R3,000 and R12 000")).toBe("between R3,000 and R12 000");
  });

  it("should_collapse_whitespace_and_trim", () => {
    expect(stripContactDetails("  furnished   room \n near   campus ")).toBe("furnished room near campus");
  });
});
