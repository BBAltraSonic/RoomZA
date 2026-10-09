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

export function discoveryCameraPadding(
  isDesktop: boolean,
  mobileBottomPadding: number,
  viewportHeight = Infinity,
) {
  const height = Math.max(0, viewportHeight);
  const top = Math.min(isDesktop ? 64 : 48, height * 0.2);
  const desiredBottom = isDesktop ? 64 : Math.max(240, mobileBottomPadding + 32);
  const bottom = Math.min(desiredBottom, Math.max(0, height - top - Math.min(64, height * 0.5)));
  return { top, right: isDesktop ? 56 : 40, bottom, left: isDesktop ? 56 : 40 };
}

export function buildQuickFilterCameraPlan(
  listings: CameraListing[],
  isDesktop: boolean,
  mobileBottomPadding: number,
  viewportHeight?: number,
): QuickFilterCameraPlan {
  if (listings.length === 0) return { kind: "none" };
  if (listings.length === 1) {
    return { kind: "single", target: listings[0]!.coordinates, zoom: 16 };
  }

  return {
    kind: "bounds",
    targets: listings.map((listing) => listing.coordinates),
    padding: discoveryCameraPadding(isDesktop, mobileBottomPadding, viewportHeight),
  };
}
