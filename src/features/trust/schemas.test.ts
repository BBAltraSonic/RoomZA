import { describe, expect, it } from "vitest";

import { trustApprovalSchema, trustDraftSchema } from "./schemas";

const versionId = "11111111-1111-4111-8111-111111111111";

describe("governed policy inputs", () => {
  it("rejects raw HTML in policy Markdown", () => {
    const result = trustDraftSchema.safeParse({
      id: versionId,
      bodyMarkdown: `## Privacy\n\n${"A".repeat(220)}<script>alert(1)</script>`,
      changeSummary: "Legal review draft",
      requiresReacceptance: false,
    });
    expect(result.success).toBe(false);
  });

  it("requires recorded counsel review metadata before approval", () => {
    expect(trustApprovalSchema.safeParse({ id: versionId, externalReviewerName: "", counselReference: "", reviewedAt: "not-a-date" }).success).toBe(false);
  });
});
