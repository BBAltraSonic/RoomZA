/**
 * What the top of a feed card shows. Phase 1 has photos only; video and PDF
 * leaflets add their kinds here in phases 2 and 3.
 */
export type MediaKind = "photos" | "none";

export function mediaKind(listing: { images?: ReadonlyArray<{ public_url: string }> | null }): MediaKind {
  return listing.images?.some((image) => image.public_url.trim() !== "") ? "photos" : "none";
}
