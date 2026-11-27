/** Tap the left third for the previous photo, the right third for the next; the middle does nothing. */
export function stepPhoto({ index, count, xRatio }: { index: number; count: number; xRatio: number }) {
  if (count <= 0) return 0;
  if (xRatio < 1 / 3) return Math.max(0, index - 1);
  if (xRatio > 2 / 3) return Math.min(count - 1, index + 1);
  return index;
}

const PIN_COLOR = "#D89B23";
const DARK_STYLE = "base-v4-dark";

/**
 * A static MapTiler image of the listing's spot, so the details show where it is
 * without starting a second WebGL map. Width and height are CSS pixels; the
 * image is requested at double density. Maps stay dark in both themes.
 */
export function staticMapUrl({ lat, lng, apiKey, width, height, zoom = 15 }: {
  lat: number; lng: number; apiKey: string | undefined; width: number; height: number; zoom?: number;
}) {
  const key = apiKey?.trim();
  if (!key || !Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return null;
  const params = new URLSearchParams({ markers: `${lng},${lat},${PIN_COLOR}`, key });
  return `https://api.maptiler.com/maps/${DARK_STYLE}/static/${lng},${lat},${zoom}/${Math.round(width)}x${Math.round(height)}@2x.png?${params.toString()}`;
}
