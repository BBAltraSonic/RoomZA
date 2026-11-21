import { useCallback, useLayoutEffect, useRef } from "react";
import { MapView, type MapCamera } from "@/features/map-discovery/map-view";
import { DiscoveryMap } from "./discovery-map";
import type { StageLayer, StageStore } from "./discovery-stage";

/**
 * Both layers are imported here so switching between them never waits on a
 * chunk. They share one MapLibre instance through `reuseMaps`: the canvas, style
 * and tiles carry over, and only the pins change.
 */
export function DiscoveryStageMap({ layer, store }: { layer: StageLayer; store: StageStore }) {
  // The stage keeps the camera; the page may also listen (for the live area
  // label). The callback stays stable so the map does not re-report bounds
  // every time the page re-renders.
  const pageCameraChange = useRef(layer.props.onCameraChange);
  useLayoutEffect(() => { pageCameraChange.current = layer.props.onCameraChange; });
  const onCameraChange = useCallback((next: MapCamera) => {
    store.setCamera(next);
    pageCameraChange.current?.(next);
  }, [store]);
  const camera = { initialCamera: store.getCamera(), onCameraChange };
  return layer.kind === "property" ? <MapView {...layer.props} {...camera} /> : <DiscoveryMap {...layer.props} {...camera} />;
}
