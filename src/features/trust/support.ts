/** The human support inbox published in the Terms of Service. */
export const SUPPORT_EMAIL = "support@pinpoint.co.za";

export function supportMailto(subject?: string) {
  return subject
    ? `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`
    : `mailto:${SUPPORT_EMAIL}`;
}
