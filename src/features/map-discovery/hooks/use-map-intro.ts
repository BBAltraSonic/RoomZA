import { useCallback, useMemo, useRef, useState } from "react";
import type { MapRef } from "react-map-gl/maplibre";

import {
  MAP_INTRO_DURATION_MS,
  MAP_INTRO_MIN_REDIRECT_MS,
  boundsAtCamera,
  cameraLandedAt,
  introEasing,
  introStartZoom,
  markMapIntroPlayed,
  readIntroEnvironment,
  shouldPlayMapIntro,
  type IntroCamera,
} from "../lib/map-intro";
import type { ViewportBounds } from "../lib/types";

type Flight = { target: IntroCamera; startedAt: number; reported: boolean };
type IntroMap = Pick<MapRef, "flyTo" | "getContainer" | "getCenter" | "getZoom">;

/**
 * Owns the opening flight of a map. `eligible` is read once, on the first
 * render: a map that was linked, searched or resumed never plays it.
 */
export function useMapIntro(eligible: boolean) {
  const [plays] = useState(() => eligible && shouldPlayMapIntro(readIntroEnvironment()));
  const flight = useRef<Flight | null>(null);
  // Set while one leg of the flight hands over to the next, so the leg that
  // stops early is not mistaken for the camera coming to rest.
  const redirecting = useRef(false);

  const startZoom = useCallback((targetZoom: number) => (plays ? introStartZoom(targetZoom) : targetZoom), [plays]);

  /**
   * Starts the flight and returns the bounds it will land on, so results can
   * load while the camera is still moving. Returns null when it does not play.
   */
  const start = useCallback((map: IntroMap, target: IntroCamera): ViewportBounds | null => {
    if (!plays || flight.current) return null;
    markMapIntroPlayed();
    const container = map.getContainer();
    const landing = boundsAtCamera(target, { width: container.clientWidth, height: container.clientHeight });
    flight.current = { target, startedAt: performance.now(), reported: true };
    map.flyTo({ center: [target.lng, target.lat], zoom: target.zoom, duration: MAP_INTRO_DURATION_MS, easing: introEasing });
    return landing;
  }, [plays]);

  /** Steers a flight still in the air to a better destination, such as the visitor's city. */
  const redirect = useCallback((map: IntroMap, target: IntroCamera) => {
    const current = flight.current;
    if (!current) return false;
    const remaining = MAP_INTRO_DURATION_MS - (performance.now() - current.startedAt);
    flight.current = { ...current, target, reported: false };
    redirecting.current = true;
    try {
      map.flyTo({ center: [target.lng, target.lat], zoom: target.zoom, duration: Math.max(MAP_INTRO_MIN_REDIRECT_MS, remaining) });
    } finally {
      redirecting.current = false;
    }
    return true;
  }, []);

  /**
   * Call from `moveend`. "handover": one leg of the flight passed to the next,
   * so the camera is still moving. "landed": it settled where results were
   * already requested. "report": anything else, including a visitor who grabs
   * the map mid-flight.
   */
  const settle = useCallback((map: IntroMap): "handover" | "landed" | "report" => {
    if (redirecting.current) return "handover";
    const current = flight.current;
    if (!current) return "report";
    flight.current = null;
    const center = map.getCenter();
    const landed = cameraLandedAt({ lng: center.lng, lat: center.lat, zoom: map.getZoom() }, current.target);
    return current.reported && landed ? "landed" : "report";
  }, []);

  const inFlight = useCallback(() => flight.current !== null, []);

  // Stable, so effects can depend on it without re-running each render.
  return useMemo(() => ({ plays, startZoom, start, redirect, settle, inFlight }), [plays, startZoom, start, redirect, settle, inFlight]);
}
