/*
 * Showing deal prices. Kept apart from deal-schema.ts (the zod form schemas) so the pages
 * that only display prices, the home map among them, don't load zod in the browser.
 */

export function formatDealPrice(cents: number) {
  if (cents === 0) return "Free";
  return "R" + new Intl.NumberFormat("en-ZA", { maximumFractionDigits: cents % 100 ? 2 : 0, minimumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);
}

export function discountPercent(price?: number, original?: number) {
  return price !== undefined && original !== undefined && original > price ? Math.round((1 - price / original) * 100) : null;
}
