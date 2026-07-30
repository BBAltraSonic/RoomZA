import { describe, expect, it } from "vitest";

import {
  isDigestDue,
  isMandatoryNotification,
  notificationCategoryForType,
  shouldSendMessageDigest,
} from "./preference-policy";

describe("notification preference policy", () => {
  it("keeps security, moderation, and transactional product events mandatory", () => {
    expect(isMandatoryNotification("moderation_update")).toBe(true);
    expect(isMandatoryNotification("application_status_changed")).toBe(true);
    expect(isMandatoryNotification("showing_request")).toBe(true);
    expect(isMandatoryNotification("showing_accepted")).toBe(true);
    expect(isMandatoryNotification("showing_declined")).toBe(true);
    expect(isMandatoryNotification("new_message")).toBe(false);
  });

  it("honours disabled, daily, and weekly message digests", () => {
    expect(
      shouldSendMessageDigest({
        messageDigest: false,
        digestFrequency: "daily",
      }),
    ).toBe(false);
    expect(
      shouldSendMessageDigest({
        messageDigest: true,
        digestFrequency: "never",
      }),
    ).toBe(false);
    expect(
      shouldSendMessageDigest(
        { messageDigest: true, digestFrequency: "daily" },
        new Date("2026-07-16T08:00:00Z"),
      ),
    ).toBe(true);
    expect(
      shouldSendMessageDigest(
        { messageDigest: true, digestFrequency: "weekly" },
        new Date("2026-07-13T08:00:00Z"),
      ),
    ).toBe(true);
    expect(
      shouldSendMessageDigest(
        { messageDigest: true, digestFrequency: "weekly" },
        new Date("2026-07-16T08:00:00Z"),
      ),
    ).toBe(false);
  });

  it("maps operational events to normalized categories", () => {
    expect(notificationCategoryForType("new_message")).toBe("messages");
    expect(notificationCategoryForType("application_status_changed")).toBe(
      "applications",
    );
    expect(notificationCategoryForType("showing_request")).toBe("viewings");
    expect(notificationCategoryForType("profile_document_expiry")).toBe(
      "verification",
    );
    expect(notificationCategoryForType("admin_alert")).toBe("security");
  });

  it("releases normalized digests only after their interval", () => {
    const now = new Date("2026-07-30T12:00:00Z");
    expect(isDigestDue("hourly", "2026-07-30T10:59:00Z", now)).toBe(true);
    expect(isDigestDue("daily", "2026-07-30T10:59:00Z", now)).toBe(false);
    expect(isDigestDue("weekly", "2026-07-20T10:00:00Z", now)).toBe(true);
    expect(isDigestDue("instant", "2026-07-01T10:00:00Z", now)).toBe(false);
  });
});
