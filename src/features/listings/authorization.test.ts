import { describe, expect, it } from "vitest";

import { authorizeOwnedListing, LISTING_OWNERSHIP_DENIED_MESSAGE } from "./authorization";

describe("landlord listing ownership authorization", () => {
  it("allows the listing owner", () => {
    expect(authorizeOwnedListing("landlord-1", "landlord-1")).toEqual({ allowed: true });
  });

  it("denies a different landlord with an explicit ownership-denied indication", () => {
    expect(authorizeOwnedListing("landlord-2", "landlord-1")).toEqual({
      allowed: false,
      error: LISTING_OWNERSHIP_DENIED_MESSAGE,
    });
  });

  it("denies missing ownership data before a mutation can be attempted", () => {
    expect(authorizeOwnedListing(null, "landlord-1").allowed).toBe(false);
    expect(authorizeOwnedListing(undefined, "landlord-1").allowed).toBe(false);
  });
});
