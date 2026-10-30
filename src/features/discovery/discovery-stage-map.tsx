import { MapView } from "@/features/map-discovery/map-view";
import { DiscoveryMap } from "./discovery-map";
import type { StageLayer, StageStore } from "./discovery-stage";

/**
 * Both layers are imported here so switching between them never waits on a
 * chunk. They share one MapLibre instance through `reuseMaps`: the canvas, style
 * and tiles carry over, and only the pins change.
 */
export function DiscoveryStageMap({ layer, store }: { layer: StageLayer; store: StageStore }) {
  const camera = { initialCamera: store.getCamera(), onCameraChange: store.setCamera };
  return layer.kind === "property" ? <MapView {...layer.props} {...camera} /> : <DiscoveryMap {...layer.props} {...camera} />;
}
