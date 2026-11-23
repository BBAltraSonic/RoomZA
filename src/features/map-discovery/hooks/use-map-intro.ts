import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
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

type Flight = { target: IntroCamera; landing: ViewportBounds; startedAt: number; reported: boolean };
type IntroMap = Pick<MapRef, "flyTo" | "jumpTo" | "isMoving" | "getBounds" | "getContainer" | "getCenter" | "getZoom">;
export type IntroLanding = { camera: IntroCamera; bounds: ViewportBounds };

function landingFor(map: IntroMap, target: IntroCamera) {
  const container = map.getContainer();
  return boundsAtCamera(target, { width: container.clientWidth, height: container.clientHeight });
}

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

  /** Starts the flight; `landing()` then says where it will settle, so results load while it moves. */
  const start = useCallback((map: IntroMap, target: IntroCamera) => {
    if (!plays || flight.current) return;
    markMapIntroPlayed();
    flight.current = { target, landing: landingFor(map, target), startedAt: performance.now(), reported: true };
    map.flyTo({ center: [target.lng, target.lat], zoom: target.zoom, duration: MAP_INTRO_DURATION_MS, easing: introEasing });
  }, [plays]);

  /**
   * Plays the flight again onto where the camera already is, such as when the
   * visitor switches from Property to Services. It lands where results were
   * already requested, so the move itself reports nothing.
   */
  const replay = useCallback((map: IntroMap) => {
    if (flight.current || map.isMoving()) return;
    const center = map.getCenter(), live = map.getBounds();
    const target = { lng: center.lng, lat: center.lat, zoom: map.getZoom() };
    const landing = live ? { west: live.getWest(), south: live.getSouth(), east: live.getEast(), north: live.getNorth() } : landingFor(map, target);
    flight.current = { target, landing, startedAt: performance.now(), reported: true };
    redirecting.current = true;
    try {
      map.jumpTo({ center: [target.lng, target.lat], zoom: introStartZoom(target.zoom) });
    } finally {
      redirecting.current = false;
    }
    map.flyTo({ center: [target.lng, target.lat], zoom: target.zoom, duration: MAP_INTRO_DURATION_MS, easing: introEasing });
  }, []);

  /** Steers a flight still in the air to a better destination, such as the visitor's city. */
  const redirect = useCallback((map: IntroMap, target: IntroCamera) => {
    const current = flight.current;
    if (!current) return false;
    const remaining = MAP_INTRO_DURATION_MS - (performance.now() - current.startedAt);
    flight.current = { ...current, target, landing: landingFor(map, target), reported: false };
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

  /** Where a flight in the air will settle, so a report made mid-flight describes that and not the sky. */
  const landing = useCallback((): IntroLanding | null => {
    const current = flight.current;
    return current ? { camera: current.target, bounds: current.landing } : null;
  }, []);

  // Stable, so effects can depend on it without re-running each render.
  return useMemo(() => ({ plays, startZoom, start, replay, redirect, settle, inFlight, landing }), [plays, startZoom, start, replay, redirect, settle, inFlight, landing]);
}

/**
 * Replays the opening flight once for each new `arrival`, after the map has
 * loaded. A map that mounts after a switch plays it on load; one that is
 * already live plays it when the number changes.
 */
export function useArrivalFlight(intro: ReturnType<typeof useMapIntro>, map: RefObject<IntroMap | null>, loaded: boolean, arrival: number, reducedMotion: boolean) {
  const flown = useRef(0);
  useEffect(() => {
    if (!loaded || arrival === flown.current) return;
    flown.current = arrival;
    if (!reducedMotion && map.current) intro.replay(map.current);
  }, [arrival, intro, loaded, map, reducedMotion]);
}
