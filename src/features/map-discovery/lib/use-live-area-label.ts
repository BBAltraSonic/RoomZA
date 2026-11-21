"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { NormalizedLocation } from "@/lib/maptiler";

import { areaLookupKey, cachedAreaFeature, lookupAreaFeature } from "./area-lookup";
import { resolveLocationViewportContext } from "./viewport-context";

type Camera = { lat: number; lng: number; zoom: number };

/** Waits for the camera to settle so a fling or pinch costs one lookup, not dozens. */
const SETTLE_MS = 300;

/**
 * Names the area the map is pointing at, updating as the camera moves.
 * Lookups are cached per grid cell and stale requests are cancelled, so a
 * live label costs at most one small request each time the map settles in a
 * new area. Returns `null` until a name is known.
 */
export function useLiveAreaLabel(apiKey?: string) {
  const [label, setLabel] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const lastKeyRef = useRef<string | null>(null);

  const onCameraChange = useCallback((camera: Camera) => {
    if (!apiKey) return;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      const center = { lat: camera.lat, lng: camera.lng };
      const key = areaLookupKey(center, camera.zoom);
      if (key === lastKeyRef.current) return;
      controllerRef.current?.abort();
      const apply = (feature: NormalizedLocation | null) => {
        lastKeyRef.current = key;
        const next = resolveLocationViewportContext(Math.round(camera.zoom), feature ?? undefined).label;
        setLabel(next === "this area" ? null : next);
      };
      const cached = cachedAreaFeature(key);
      if (cached !== undefined) return apply(cached);
      const controller = new AbortController();
      controllerRef.current = controller;
      // On failure keep the last name; the next settle retries.
      lookupAreaFeature({ apiKey, center, zoom: camera.zoom, signal: controller.signal }).then(apply).catch(() => {});
    }, SETTLE_MS);
  }, [apiKey]);

  useEffect(() => () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    controllerRef.current?.abort();
  }, []);

  return { label, onCameraChange };
}
