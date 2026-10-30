"use client";

import dynamic from "next/dynamic";
import { createContext, useContext, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { MapLoadingSkeleton } from "@/features/map-discovery/discovery-loading";
import type { MapCamera, MapViewProps } from "@/features/map-discovery/map-view";
import type { DiscoveryMapProps } from "./discovery-map";

export type StageLayer =
  | { kind: "property"; props: MapViewProps }
  | { kind: "points"; props: DiscoveryMapProps };

// Outlives the workspace so leaving discovery and returning resumes the same view.
let lastCamera: MapCamera | null = null;

function sameProps(a: object, b: object) {
  const left = Object.entries(a);
  return left.length === Object.keys(b).length && left.every(([key, value]) => Object.is(value, (b as Record<string, unknown>)[key]));
}

function createStageStore() {
  let layer: StageLayer | null = null;
  let host: HTMLDivElement | null = null;
  const listeners = new Set<() => void>();
  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    getLayer: () => layer,
    setLayer(next: StageLayer) {
      if (layer?.kind === next.kind && sameProps(layer.props, next.props)) return;
      layer = next;
      listeners.forEach(listener => listener());
    },
    /** The map's DOM lives here and moves between slots, so the canvas is never rebuilt. */
    host() {
      if (!host) {
        host = document.createElement("div");
        host.className = "relative h-full w-full";
      }
      return host;
    },
    getCamera: () => lastCamera,
    setCamera(camera: MapCamera) { lastCamera = camera; },
  };
}

export type StageStore = ReturnType<typeof createStageStore>;

const StageContext = createContext<StageStore | null>(null);
const subscribeNever = () => () => {};

const DiscoveryStageMap = dynamic(
  () => import("./discovery-stage-map").then(module => module.DiscoveryStageMap),
  { ssr: false, loading: () => <MapLoadingSkeleton /> },
);

function StageMap({ store }: { store: StageStore }) {
  const mounted = useSyncExternalStore(subscribeNever, () => true, () => false);
  const layer = useSyncExternalStore(store.subscribe, store.getLayer, () => null);
  if (!mounted) return null;
  return createPortal(layer ? <DiscoveryStageMap layer={layer} store={store} /> : <MapLoadingSkeleton />, store.host());
}

/** Keeps one map alive for every environment rendered inside it. */
export function DiscoveryStage({ children }: { children: ReactNode }) {
  const [store] = useState(createStageStore);
  return <StageContext.Provider value={store}>{children}<StageMap store={store} /></StageContext.Provider>;
}

function StageSlot({ store, layer }: { store: StageStore; layer: StageLayer }) {
  const slot = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const container = slot.current!, host = store.host();
    container.appendChild(host);
    return () => { if (host.parentNode === container) container.removeChild(host); };
  }, [store]);
  // Hidden environments run no effects, so only the visible one drives the map.
  useLayoutEffect(() => store.setLayer(layer));
  return <div ref={slot} className="h-full min-h-0 w-full" />;
}

/** Shows the stage map here, or `fallback` on a screen outside the workspace. */
export function DiscoveryMapSlot({ layer, fallback }: { layer: StageLayer; fallback: ReactNode }) {
  const store = useContext(StageContext);
  return store ? <StageSlot store={store} layer={layer} /> : fallback;
}
