import { describe, expect, it } from "vitest";
import fc from "fast-check";

import {
  canPublishListing,
  canUnpublishListing,
  countDraftListings,
  countPublishedListings,
  visibilityToggleTarget,
  type ListingVisibilityStatus,
} from "./listing-status";

const statuses: ListingVisibilityStatus[] = ["draft", "published", "archived"];

describe("listing status helpers", () => {
  it("counts only matching dashboard visibility statuses", () => {
    const listings = [{ status: "draft" }, { status: "published" }, { status: "published" }, { status: "archived" }];

    expect(countDraftListings(listings)).toBe(1);
    expect(countPublishedListings(listings)).toBe(2);
  });

  it("allows publish/unpublish only for reversible visible states", () => {
    expect(canPublishListing("draft")).toBe(true);
    expect(canPublishListing("published")).toBe(false);
    expect(canPublishListing("archived")).toBe(false);

    expect(canUnpublishListing("published")).toBe(true);
    expect(canUnpublishListing("draft")).toBe(false);
    expect(canUnpublishListing("archived")).toBe(false);
  });

  it("P16 visibility toggles are reversible for draft and published listings", () => {
    fc.assert(
      fc.property(fc.constantFrom(...statuses), (status) => {
        const target = visibilityToggleTarget(status);

        if (status === "archived") {
          expect(target).toBeNull();
          return;
        }

        expect(target).not.toBeNull();
        expect(visibilityToggleTarget(target as ListingVisibilityStatus)).toBe(status);
      }),
      { numRuns: 100 },
    );
  });
});
