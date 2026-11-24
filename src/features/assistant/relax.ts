/**
 * Relax suggestion (proposal, template "Relax suggestion"): "9 more if you go to R4,500 [Yes]".
 * Plain code. Pinpoint counts what the slightly higher budget would add in the same map area;
 * tapping Yes only changes the search address, so it is free and unlimited.
 */

/** Offer a higher budget only when the current search finds fewer than this. */
export const RELAX_WHEN_FEWER_THAN = 5;

export function relaxedMaxPrice(maxPrice: number, mode: "rent" | "buy"): number {
  const step = mode === "buy" ? 50_000 : 500;
  return Math.ceil((maxPrice * 1.125) / step) * step;
}

export type RelaxSuggestion = { maxPrice: number; query: string };

export function relaxSuggestion(params: URLSearchParams, resultCount: number, mode: "rent" | "buy"): RelaxSuggestion | null {
  if (resultCount >= RELAX_WHEN_FEWER_THAN) return null;
  const max = Number(params.get("maxPrice"));
  if (!Number.isFinite(max) || max <= 0) return null;
  const maxPrice = relaxedMaxPrice(max, mode);
  const next = new URLSearchParams(params.toString());
  next.set("maxPrice", String(maxPrice));
  return { maxPrice, query: next.toString() };
}
