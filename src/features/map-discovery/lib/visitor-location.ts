import type { GeoPoint } from "./types";

type PermissionsLike = Pick<Permissions, "query">;

/**
 * Reads the visitor's position without surprising them with a permission prompt.
 *
 * `allowPrompt` is true only on a cold start of the map. A shared or deep-linked
 * page never prompts; it only reads a location the visitor already granted.
 * Denial, timeouts, and missing APIs are silent: callers fall back to the map center.
 */
export async function readVisitorLocation({
  geolocation,
  permissions,
  allowPrompt,
  onLocation,
  isCancelled = () => false,
}: {
  geolocation: Geolocation | undefined;
  permissions: PermissionsLike | undefined;
  allowPrompt: boolean;
  onLocation: (location: GeoPoint) => void;
  isCancelled?: () => boolean;
}): Promise<void> {
  if (!geolocation) return;

  if (!allowPrompt) {
    const state = await permissions
      ?.query({ name: "geolocation" })
      .then((status) => status.state, () => undefined);
    if (state !== "granted" || isCancelled()) return;
  }

  geolocation.getCurrentPosition(
    (position) => {
      if (isCancelled()) return;
      onLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
    },
    () => undefined,
    { timeout: 10000, maximumAge: 10 * 60 * 1000 },
  );
}
