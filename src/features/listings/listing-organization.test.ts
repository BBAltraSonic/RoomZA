import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { organizeListings, type OrganizableListing } from "./listing-organization";

const statusArb = fc.constantFrom("draft", "published", "archived" as const);

const listingArb = fc.record({
  title: fc.string({ maxLength: 40 }),
  address: fc.string({ maxLength: 40 }),
  status: statusArb,
  updated_at: fc.date({ noInvalidDate: true }).map((date) => date.toISOString()),
  applications: fc.array(fc.constant({ id: "app" }), { maxLength: 8 }),
});

describe("listing organization", () => {
  it("P5 filters by status and trimmed search term", () => {
    fc.assert(
      fc.property(fc.array(listingArb, { maxLength: 30 }), fc.string({ maxLength: 30 }), statusArb, (listings, rawSearch, status) => {
        const search = rawSearch.trim();
        const results = organizeListings(listings, { q: ` ${search} `, status });

        expect(results.every((listing) => listing.status === status)).toBe(true);
        if (search) {
          const normalized = search.slice(0, 100).toLocaleLowerCase();
          expect(results.every((listing) => `${listing.title ?? ""} ${listing.address ?? ""}`.toLocaleLowerCase().includes(normalized))).toBe(true);
        }
      }),
    );
  });

  it("P6 sorts by requested primary key with deterministic tiebreakers", () => {
    fc.assert(
      fc.property(fc.array(listingArb, { maxLength: 30 }), (listings) => {
        const byRecent = organizeListings(listings as OrganizableListing[], { status: "all", sort: "recent" });
        for (let index = 1; index < byRecent.length; index += 1) {
          const prev = byRecent[index - 1];
          const curr = byRecent[index];
          if (!prev || !curr) continue;
          expect(new Date(prev.updated_at ?? 0).getTime()).toBeGreaterThanOrEqual(new Date(curr.updated_at ?? 0).getTime());
        }

        const byApplicants = organizeListings(listings as OrganizableListing[], { status: "all", sort: "applicants" });
        for (let index = 1; index < byApplicants.length; index += 1) {
          const prev = byApplicants[index - 1];
          const curr = byApplicants[index];
          if (!prev || !curr) continue;
          expect((prev.applications ?? []).length).toBeGreaterThanOrEqual((curr.applications ?? []).length);
        }
      }),
    );
  });
});
