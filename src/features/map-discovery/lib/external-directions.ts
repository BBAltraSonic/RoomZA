import type { GeoPoint } from "./types";

export function buildExternalDirectionsUrl({
  destination,
  label,
  userAgent = "",
  platform = "",
}: {
  destination: GeoPoint;
  label: string;
  userAgent?: string;
  platform?: string;
}) {
  const coordinate = `${destination.lat},${destination.lng}`;
  const encodedLabel = encodeURIComponent(label);
  const appleDevice = /iPhone|iPad|iPod|Mac/i.test(`${userAgent} ${platform}`);
  const androidDevice = /Android/i.test(`${userAgent} ${platform}`);

  if (appleDevice) {
    return `https://maps.apple.com/?daddr=${coordinate}&q=${encodedLabel}`;
  }

  if (androidDevice) {
    return `geo:0,0?q=${coordinate}(${encodedLabel})`;
  }

  return `https://www.google.com/maps/dir/?api=1&destination=${coordinate}&travelmode=driving&dir_action=navigate`;
}
