/** Other surfaces (the assistant's "Ask landlord") open a listing's Contact sheet with this event. */
export const OPEN_CONTACT_EVENT = "pinpoint:open-contact";

export function requestOpenContact(listingId: string) {
  window.dispatchEvent(new CustomEvent(OPEN_CONTACT_EVENT, { detail: { listingId } }));
}
