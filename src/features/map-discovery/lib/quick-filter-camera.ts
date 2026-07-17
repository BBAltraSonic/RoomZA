type CameraListing = {
  coordinates: { lat: number; lng: number };
};

export type QuickFilterCameraPlan =
  | { kind: "none" }
  | { kind: "single"; target: { lat: number; lng: number }; zoom: 16 }
  | {
      kind: "bounds";
      targets: Array<{ lat: number; lng: number }>;
      padding: { top: number; right: number; bottom: number; left: number };
    };

export function buildQuickFilterCameraPlan(
  listings: CameraListing[],
  isDesktop: boolean,
  mobileBottomPadding: number,
): QuickFilterCameraPlan {
  if (listings.length === 0) return { kind: "none" };
  if (listings.length === 1) {
    return { kind: "single", target: listings[0]!.coordinates, zoom: 16 };
  }

  return {
    kind: "bounds",
    targets: listings.map((listing) => listing.coordinates),
    padding: isDesktop
      ? { top: 64, right: 56, bottom: 64, left: 500 }
      : { top: 120, right: 40, bottom: Math.max(240, mobileBottomPadding + 32), left: 40 },
  };
}
