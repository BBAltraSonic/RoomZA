/**
 * Pure room-minting helpers for conversation video calls.
 *
 * This module mirrors the room scheme used by the scheduled-viewing flow
 * (`book_viewing_slot_atomic` + the `LiveVideoViewing` iframe) so an ad-hoc
 * call room behaves identically to a scheduled viewing room. It performs no
 * I/O and is safe to use on both the server and the client.
 */

/** Prefix applied to every conversation-call room id. */
const ROOM_ID_PREFIX = "roomza-call-";
const TOUR_ROOM_ID_PREFIX = "roomza-tour-";

/** Base URL of the public Jitsi instance shared with the scheduled-viewing flow. */
const JITSI_BASE_URL = "https://meet.jit.si/";

/**
 * Config flags appended to a join url to produce the embed url. These match the
 * flags used by the viewing iframe in
 * `src/features/viewings/components/live-video-viewing.tsx` so the embedded call
 * skips the prejoin page and avoids the mobile-app deep-link interstitial.
 */
const EMBED_CONFIG_HASH =
  "#config.prejoinPageEnabled=false&config.disableDeepLinking=true";

/**
 * Mints a deterministic room id from a session id by stripping the dashes from
 * the (uuid) session id and prefixing it with `roomza-call-`.
 *
 * Pure: the same session id always yields the same room id, and distinct
 * session ids yield distinct room ids.
 */
export function buildRoomId(sessionId: string): string {
  return `${ROOM_ID_PREFIX}${sessionId.replace(/-/g, "")}`;
}

/** Mints the deterministic Jitsi room used by an Instant Connect live tour. */
export function buildTourRoomId(tourId: string): string {
  return `${TOUR_ROOM_ID_PREFIX}${tourId.replace(/-/g, "")}`;
}

/**
 * Builds the Jitsi join url for a room id. The url always starts with
 * `https://meet.jit.si/` and ends with the supplied room id.
 */
export function buildJoinUrl(roomId: string): string {
  return `${JITSI_BASE_URL}${roomId}`;
}

export function parseRoomId(value: string): string | null {
  const [withoutHash] = value.split("#");
  if (!withoutHash) return null;
  if (withoutHash.startsWith(JITSI_BASE_URL)) {
    const roomId = withoutHash.slice(JITSI_BASE_URL.length);
    return roomId.length > 0 ? roomId : null;
  }
  return withoutHash.length > 0 ? withoutHash : null;
}

/**
 * Derives the embed url for the in-app iframe from a join url by appending the
 * shared prejoin/deeplink config flags. The original join url is preserved as a
 * prefix so the embedded iframe always targets the same room as the "Open"
 * external link.
 */
export function buildEmbedUrl(joinUrl: string): string {
  return `${joinUrl}${EMBED_CONFIG_HASH}`;
}

export function buildCallEmbedUrl(joinUrl: string, mediaMode: "voice" | "video"): string {
  const voiceConfig = mediaMode === "voice" ? "&config.startWithVideoMuted=true" : "";
  return `${joinUrl}${EMBED_CONFIG_HASH}${voiceConfig}`;
}
