// Shared constants for the Mobile_Map_Discovery feature.
// See .kiro/specs/mobile-map-discovery/design.md.

/** Maximum number of Listing_Markers rendered before clustering applies. */
export const MAX_MARKERS = 200;

/** In-viewport marker count above which map markers are rendered as clusters. */
export const MARKER_CLUSTER_THRESHOLD = 60;

/** Map-first Peek height as a ratio of viewport height. */
export const SHEET_MIN_RATIO = 0.18;

/** Primary Browse height: enough room to work while the map remains legible. */
export const SHEET_BROWSE_RATIO = 0.54;

/** Intentional Full List height, leaving a narrow strip of map context. */
export const SHEET_MAX_RATIO = 0.95;

/**
 * Minimum map strip retained above Full List on unusually short viewports.
 */
export const SHEET_TOP_INSET = 48;
