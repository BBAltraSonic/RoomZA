import { describe, expect, it } from "vitest";

import { businessRequestSchema, changeRequestSchema } from "./request-schema";

const LISTING = "11111111-1111-4111-8111-111111111111";
const PERSON = "22222222-2222-4222-8222-222222222222:11111111-1111-4111-8111-111111111111";

describe("businessRequestSchema", () => {
  it("should_accept_every_template_the_rules_can_produce", () => {
    const requests = [
      { template: "today" },
      { template: "people_list", filters: { stage: "gone-quiet", waitingOnYou: true, maxPrice: 4000 } },
      { template: "person_detail", personKey: PERSON },
      { template: "question_insights", listingId: LISTING },
      { template: "new_listing", draft: { notes: "2 bed in Bellville", bedrooms: 2 } },
      { template: "quality_check" },
      { template: "performance", listingId: LISTING },
      { template: "change_preview", change: { kind: "accept_viewings" } },
      { template: "viewing_slots", personKey: PERSON },
      { template: "reminders", create: { text: "call the plumber", due: "tomorrow" } },
    ];
    for (const request of requests) expect(businessRequestSchema.safeParse(request).success, request.template).toBe(true);
  });

  it("should_reject_unknown_templates_and_extra_fields", () => {
    expect(businessRequestSchema.safeParse({ template: "delete_everything" }).success).toBe(false);
    expect(businessRequestSchema.safeParse({ template: "today", sql: "drop table" }).success).toBe(false);
    expect(businessRequestSchema.safeParse({ template: "person_detail", personKey: "not-a-key" }).success).toBe(false);
  });
});

describe("changeRequestSchema", () => {
  it("should_need_exactly_one_of_percent_or_amount_for_a_price_change", () => {
    expect(changeRequestSchema.safeParse({ kind: "change_price", percent: 5 }).success).toBe(true);
    expect(changeRequestSchema.safeParse({ kind: "change_price", amount: 4500 }).success).toBe(true);
    expect(changeRequestSchema.safeParse({ kind: "change_price" }).success).toBe(false);
    expect(changeRequestSchema.safeParse({ kind: "change_price", percent: 5, amount: 4500 }).success).toBe(false);
    expect(changeRequestSchema.safeParse({ kind: "change_price", percent: 90 }).success).toBe(false);
  });

  it("should_need_a_person_to_decline_a_viewing", () => {
    expect(changeRequestSchema.safeParse({ kind: "decline_viewing" }).success).toBe(false);
    expect(changeRequestSchema.safeParse({ kind: "decline_viewing", personKey: PERSON }).success).toBe(true);
  });
});
