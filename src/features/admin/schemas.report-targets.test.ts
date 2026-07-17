import { describe, expect, it } from "vitest";

import { reportSchema } from "./schemas";

const ids = {
  listingId: "11111111-1111-4111-8111-111111111111",
  reportedUserId: "22222222-2222-4222-8222-222222222222",
  messageId: "33333333-3333-4333-8333-333333333333",
  listingImageId: "44444444-4444-4444-8444-444444444444",
};

describe("moderation report targets", () => {
  it.each(Object.entries(ids))("accepts one %s target", (key, value) => {
    expect(reportSchema.safeParse({ [key]: value, category: "safety", details: "A sufficiently detailed safety report." }).success).toBe(true);
  });

  it("rejects reports with zero or multiple targets", () => {
    const base = { category: "safety", details: "A sufficiently detailed safety report." };
    expect(reportSchema.safeParse(base).success).toBe(false);
    expect(reportSchema.safeParse({ ...base, listingId: ids.listingId, messageId: ids.messageId }).success).toBe(false);
  });
});
