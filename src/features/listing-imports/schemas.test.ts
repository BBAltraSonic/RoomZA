import { describe, expect, it } from "vitest";

import { importJobMessageSchema, importSelectionSchema } from "./schemas";

describe("listing import job contracts", () => {
  it("accepts only the durable QStash cursor envelope", () => {
    const message = {
      jobId: "11111111-1111-4111-8111-111111111111",
      stage: "validating",
      cursor: 500,
      attempt: 1,
      version: 4,
    };
    expect(importJobMessageSchema.parse(message)).toEqual(message);
    expect(importJobMessageSchema.safeParse({ ...message, rawRow: { email: "private@example.test" } }).success).toBe(false);
  });

  it("represents all-matching selection without sending thousands of row IDs", () => {
    expect(importSelectionSchema.parse({
      mode: "all_matching",
      filter: { states: ["publish_blocked"], duplicateOnly: false },
      excluded: ["22222222-2222-4222-8222-222222222222"],
    })).toMatchObject({ mode: "all_matching" });
  });
});
