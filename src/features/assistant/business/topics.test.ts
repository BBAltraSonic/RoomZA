import { describe, expect, it } from "vitest";

import type { FactListing } from "../listing-facts";
import { findTopics } from "./topics";

const listing: FactListing = {
  id: "L1",
  title: "Room",
  price: 3800,
  bedrooms: 1,
  bathrooms: 1,
  parking_type: "none",
  parking_count: 0,
  electricity_type: "prepaid",
  water_availability: "municipal",
  lease_duration: "12_months",
  availability_date: null,
  deposit_amount: 3800,
  metadata: null,
};

describe("findTopics", () => {
  it("should_count_distinct_enquiries_per_topic_and_say_what_the_listing_lacks", () => {
    const insights = findTopics(
      [
        { listingId: "L1", conversationId: "c1", content: "Hi, is there wifi? And when can I move in?" },
        { listingId: "L1", conversationId: "c1", content: "Also is the Wi-Fi fast" },
        { listingId: "L1", conversationId: "c2", content: "Do you have WIFI" },
        { listingId: "L1", conversationId: "c3", content: "How much is the deposit?" },
      ],
      [listing],
    );
    expect(insights.map((insight) => insight.message)).toEqual([
      "Wi-Fi: mentioned in 2 enquiries, not on your listing",
      "Move-in date: mentioned in 1 enquiry, not on your listing",
      "Deposit: mentioned in 1 enquiry",
    ]);
    expect(insights[0]!.href).toBe("/dashboard/listings/L1/edit");
  });

  it("should_use_the_nsfas_flag_for_nsfas", () => {
    const [insight] = findTopics([{ listingId: "L1", conversationId: "c1", content: "Do you accept NSFAS?" }], [{ ...listing, nsfasApproved: true }]);
    expect(insight).toMatchObject({ topic: "nsfas", onListing: true });
  });

  it("should_ignore_messages_for_listings_it_does_not_know", () => {
    expect(findTopics([{ listingId: "other", conversationId: "c1", content: "parking?" }], [listing])).toEqual([]);
  });
});
