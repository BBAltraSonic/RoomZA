import { describe, expect, it } from "vitest";

import { isMandatoryNotification, shouldSendMessageDigest } from "./preference-policy";

describe("notification preference policy", () => {
  it("keeps security, moderation, and transactional product events mandatory", () => {
    expect(isMandatoryNotification("moderation_update")).toBe(true);
    expect(isMandatoryNotification("application_status_changed")).toBe(true);
    expect(isMandatoryNotification("new_message")).toBe(false);
  });

  it("honours disabled, daily, and weekly message digests", () => {
    expect(shouldSendMessageDigest({ messageDigest: false, digestFrequency: "daily" })).toBe(false);
    expect(shouldSendMessageDigest({ messageDigest: true, digestFrequency: "never" })).toBe(false);
    expect(shouldSendMessageDigest({ messageDigest: true, digestFrequency: "daily" }, new Date("2026-07-16T08:00:00Z"))).toBe(true);
    expect(shouldSendMessageDigest({ messageDigest: true, digestFrequency: "weekly" }, new Date("2026-07-13T08:00:00Z"))).toBe(true);
    expect(shouldSendMessageDigest({ messageDigest: true, digestFrequency: "weekly" }, new Date("2026-07-16T08:00:00Z"))).toBe(false);
  });
});
