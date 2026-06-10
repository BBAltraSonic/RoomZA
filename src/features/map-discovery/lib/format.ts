// Listing card formatters for the Mobile_Map_Discovery feature.
// See .kiro/specs/mobile-map-discovery/design.md (ListingCard,
// Correctness Property 7).

/** Inclusive valid range for a star rating (Req 5.2). */
const RATING_MIN = 0;
const RATING_MAX = 5;

/** Inclusive valid range for a distance in kilometers (Req 5.3). */
const DISTANCE_MIN = 0;
const DISTANCE_MAX = 999.9;

/** Clamp a value to the inclusive `[min, max]` range. */
function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/**
 * Format a star rating to one decimal place (Req 5.2).
 *
 * Valid range is `[0.0, 5.0]`. Out-of-range values are clamped to the nearest
 * bound before formatting (clamp chosen over reject so the UI always renders a
 * sensible value). `NaN` is treated as the minimum.
 *
 * @example formatRating(4.25) // "4.3"
 * @example formatRating(7)    // "5.0"
 */
export function formatRating(rating: number): string {
  const safe = Number.isNaN(rating) ? RATING_MIN : rating;
  return clamp(safe, RATING_MIN, RATING_MAX).toFixed(1);
}

/**
 * Format a distance to one decimal place plus a unit (Req 5.3).
 *
 * Valid range is `[0.0, 999.9]` km. Out-of-range values are clamped to the
 * nearest bound before formatting. `NaN` is treated as the minimum.
 *
 * @example formatDistance(2)     // "2.0 km"
 * @example formatDistance(1500)  // "999.9 km"
 */
export function formatDistance(km: number): string {
  const safe = Number.isNaN(km) ? DISTANCE_MIN : km;
  return `${clamp(safe, DISTANCE_MIN, DISTANCE_MAX).toFixed(1)} km`;
}

/**
 * Format a price as a South African Rand currency indication (Req 5.2).
 *
 * Matches the existing app formatting in `src/components/premium/property-card.tsx`
 * (`R ${new Intl.NumberFormat("en-ZA").format(price)}`). Intended for prices
 * greater than 0.
 *
 * @example formatPrice(8500) // "R 8 500"
 */
export function formatPrice(price: number): string {
  return `R ${new Intl.NumberFormat("en-ZA").format(price)}`;
}
