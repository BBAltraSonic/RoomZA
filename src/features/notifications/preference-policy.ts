export type DigestPreferences = {
  messageDigest: boolean;
  digestFrequency: "never" | "daily" | "weekly";
};

export const mandatoryNotificationTypes = new Set([
  "new_application",
  "viewing_proposed",
  "viewing_booked",
  "application_status_changed",
  "incoming_call",
  "showing_request",
  "showing_accepted",
  "showing_declined",
  "admin_alert",
  "moderation_update",
]);

export function isMandatoryNotification(type: string) {
  return mandatoryNotificationTypes.has(type);
}

export function shouldSendMessageDigest(preferences: DigestPreferences, now = new Date()) {
  if (!preferences.messageDigest || preferences.digestFrequency === "never") return false;
  if (preferences.digestFrequency === "weekly") return now.getUTCDay() === 1;
  return true;
}

export type NotificationCategory =
  | "messages"
  | "applications"
  | "viewings"
  | "offers"
  | "saved_searches"
  | "marketing"
  | "security"
  | "account_updates"
  | "reviews"
  | "verification"
  | "blog_updates";

export type NotificationFrequency = "instant" | "hourly" | "daily" | "weekly" | "never";

export function notificationCategoryForType(type: string): NotificationCategory {
  if (type === "new_message" || type === "incoming_call") return "messages";
  if (type.includes("application")) return "applications";
  if (type.includes("viewing") || type.includes("showing") || type.includes("tour")) return "viewings";
  if (type.includes("offer") || type.includes("buyer_interest")) return "offers";
  if (type.includes("review")) return "reviews";
  if (type.includes("verification") || type === "profile_document_expiry") return "verification";
  if (type === "admin_alert") return "security";
  if (type === "moderation_update") return "account_updates";
  return "account_updates";
}

export function isDigestDue(
  frequency: NotificationFrequency,
  createdAt: string,
  now = new Date(),
) {
  if (frequency === "never" || frequency === "instant") return false;
  const age = now.getTime() - new Date(createdAt).getTime();
  if (frequency === "hourly") return age >= 60 * 60 * 1000;
  if (frequency === "daily") return age >= 24 * 60 * 60 * 1000;
  return age >= 7 * 24 * 60 * 60 * 1000;
}
