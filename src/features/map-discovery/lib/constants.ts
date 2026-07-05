// Shared constants for the Mobile_Map_Discovery feature.
// See .kiro/specs/mobile-map-discovery/design.md.

/** Maximum number of Listing_Markers rendered before clustering applies. */
export const MAX_MARKERS = 200;

/** In-viewport marker count above which map markers are rendered as clusters. */
export const MARKER_CLUSTER_THRESHOLD = 200;

/** Minimum collapsed ("peek") Bottom_Sheet height as a ratio of viewport height (Req 4.5). */
export const SHEET_MIN_RATIO = 0.28;

/** Half-expanded Bottom_Sheet height as a ratio of viewport height (default resting state). */
export const SHEET_HALF_RATIO = 0.6;

/** Maximum expanded Bottom_Sheet height as a ratio of viewport height (Req 4.4). */
export const SHEET_MAX_RATIO = 0.92;

/**
 * Pixel gap kept between the top of a fully-expanded sheet and the top of the
 * viewport, so the SearchRegion/App_Bar stays reachable.
 */
export const SHEET_TOP_INSET = 120;
