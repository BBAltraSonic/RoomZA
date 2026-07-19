// Feature: discovery-page-experience, Property 7: Marker order matches card order
import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { deriveMarkerListings, type MarkerSourceListing } from "./marker-sync";

// Smart generator: build a pool of source listings with unique ids, then draw
// the Card_Pipeline output as an ordered selection of ids. Cards may reference
// an id that has no matching source listing (must be dropped) and the same
// source listing may be referenced by multiple cards, so the property exercises
// present, missing, and duplicated ids while keeping inputs in the intended
// space (ids are the join key between cards and listings).
function makeSourceListing(id: string): MarkerSourceListing {
  return {
    id,
    title: `title-${id}`,
    area: `area-${id}`,
    price: `R${id}`,
    fullPrice: `R${id}.00`,
    coordinates: { lat: 0, lng: 0 },
    imageUrls: [],
    beds: 1,
    baths: 1,
    createdAt: null,
    availabilityDate: null,
  };
}

const scenarioArb = fc
  .uniqueArray(fc.string({ minLength: 1, maxLength: 6 }), { minLength: 0, maxLength: 40 })
  .chain((sourceIds) => {
    const listings = sourceIds.map(makeSourceListing);
    // Card ids may be any of the source ids (present) or fresh ids never in the
    // pool (missing -> dropped). Duplicates allowed to test repeated references.
    const candidateIdArb =
      sourceIds.length > 0
        ? fc.oneof(fc.constantFrom(...sourceIds), fc.string({ minLength: 1, maxLength: 6 }))
        : fc.string({ minLength: 1, maxLength: 6 });
    return fc
      .array(candidateIdArb, { minLength: 0, maxLength: 60 })
      .map((cardIds) => ({
        listings,
        sourceIdSet: new Set(sourceIds),
        cards: cardIds.map((id) => ({ id })),
      }));
  });

describe("deriveMarkerListings", () => {
  // Property 7: Marker order matches card order — derived markerListings contains
  // the same ids in the same order as the Card_Pipeline output (cards that have a
  // matching source listing), preserving order and dropping unmatched cards.
  // Validates: Requirements 8.1
  it("P7 derives markers in card order, keeping only cards with a matching source listing", () => {
    fc.assert(
      fc.property(scenarioArb, ({ cards, listings, sourceIdSet }) => {
        const markers = deriveMarkerListings(cards, listings);

        const expectedIds = cards
          .map((card) => card.id)
          .filter((id) => sourceIdSet.has(id));

        expect(markers.map((marker) => marker.id)).toEqual(expectedIds);
      }),
      { numRuns: 100 },
    );
  });
});
