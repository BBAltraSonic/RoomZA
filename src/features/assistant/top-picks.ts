import type { SearchChip } from "./search-intent";

export type TopPickListing = {
  priceValue: number;
  beds: number;
  furnished: boolean;
  nsfasApproved: boolean;
  propertyType: string | null;
  area: string;
};

function rand(value: number) {
  return `R${Math.round(value).toLocaleString("en-US")}`;
}

/**
 * The "why it matches" line on a top pick. Built by Pinpoint from the chips and the
 * listing's own fields, so it only states what is true of the listing.
 */
export function whyItMatches(listing: TopPickListing, chips: readonly SearchChip[]): string {
  const reasons: string[] = [];
  for (const chip of chips) {
    switch (chip.kind) {
      case "maxPrice":
        if (listing.priceValue > 0 && listing.priceValue <= chip.value) reasons.push(`${rand(listing.priceValue)}, under your ${rand(chip.value)}`);
        break;
      case "beds":
        if (listing.beds >= chip.value) reasons.push(`${listing.beds} bedroom${listing.beds === 1 ? "" : "s"}`);
        break;
      case "quick":
        if (chip.value === "furnished" && listing.furnished) reasons.push("Furnished");
        if (chip.value === "nsfas-approved" && listing.nsfasApproved) reasons.push("NSFAS approved");
        break;
      case "type":
        if (listing.propertyType === chip.value) reasons.push(chip.value.charAt(0).toUpperCase() + chip.value.slice(1));
        break;
      case "near":
        if (listing.area.toLocaleLowerCase("en-ZA").includes(chip.value.toLocaleLowerCase("en-ZA"))) reasons.push(`In ${listing.area}`);
        break;
      default:
        break;
    }
  }
  return reasons.join(" · ");
}
