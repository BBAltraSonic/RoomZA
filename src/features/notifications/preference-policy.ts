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
