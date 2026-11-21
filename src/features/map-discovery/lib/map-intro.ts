import type { ViewportBounds } from "./types";

/**
 * The opening flight: on a fresh visit the map starts high above the city and
 * sweeps down to where browsing begins. It plays once per tab, only when nothing
 * else (a link, a search, a resumed camera) has already decided the view.
 */
export const MAP_INTRO_DURATION_MS = 1600;
/** Zoom levels between the start of the flight and where it lands. */
export const MAP_INTRO_ZOOM_DROP = 6;
const MAP_INTRO_MIN_ZOOM = 2;
/** A redirected flight never lands faster than this, so it still reads as one move. */
export const MAP_INTRO_MIN_REDIRECT_MS = 700;
export const MAP_INTRO_PLAYED_KEY = "pinpoints:map-intro-played";

const MAPLIBRE_TILE_SIZE = 512;
const MAX_MERCATOR_LAT = 85.051129;

export type IntroCamera = { lng: number; lat: number; zoom: number };

export function introStartZoom(targetZoom: number) {
  return Math.max(MAP_INTRO_MIN_ZOOM, targetZoom - MAP_INTRO_ZOOM_DROP);
}

/**
 * Exponential ease-out, normalised to land exactly on 1: half the distance is
 * covered in the first eighth of the flight (the whoosh), the rest settles.
 */
export function introEasing(t: number) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return (1 - 2 ** (-8 * t)) / (1 - 2 ** -8);
}

type IntroEnvironment = {
  reducedMotion: boolean;
  hidden: boolean;
  alreadyPlayed: boolean;
};

export function shouldPlayMapIntro({ reducedMotion, hidden, alreadyPlayed }: IntroEnvironment) {
  return !reducedMotion && !hidden && !alreadyPlayed;
}

/** Reads the browser once; every storage access is guarded because private modes can throw. */
export function readIntroEnvironment(): IntroEnvironment {
  if (typeof window === "undefined") return { reducedMotion: true, hidden: true, alreadyPlayed: true };
  let alreadyPlayed = false;
  try {
    alreadyPlayed = window.sessionStorage.getItem(MAP_INTRO_PLAYED_KEY) === "1";
  } catch {
    alreadyPlayed = false;
  }
  return {
    reducedMotion: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
    hidden: document.visibilityState === "hidden",
    alreadyPlayed,
  };
}

export function markMapIntroPlayed() {
  try {
    window.sessionStorage.setItem(MAP_INTRO_PLAYED_KEY, "1");
  } catch {
    // Without storage the intro may play again on reload, which is harmless.
  }
}

function lngToX(lng: number, worldSize: number) {
  return ((lng + 180) / 360) * worldSize;
}

function latToY(lat: number, worldSize: number) {
  const clamped = Math.max(-MAX_MERCATOR_LAT, Math.min(MAX_MERCATOR_LAT, lat));
  const radians = (clamped * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(Math.PI / 4 + radians / 2)) / Math.PI) / 2) * worldSize;
}

function xToLng(x: number, worldSize: number) {
  return (x / worldSize) * 360 - 180;
}

function yToLat(y: number, worldSize: number) {
  const n = Math.PI * (1 - (2 * y) / worldSize);
  return (Math.atan(Math.sinh(n)) * 180) / Math.PI;
}

/**
 * What a flat, north-up map of this size shows at the given camera. Used to
 * load results for where the flight lands while it is still in the air.
 */
export function boundsAtCamera(camera: IntroCamera, size: { width: number; height: number }): ViewportBounds {
  const worldSize = MAPLIBRE_TILE_SIZE * 2 ** camera.zoom;
  const x = lngToX(camera.lng, worldSize);
  const y = latToY(camera.lat, worldSize);
  const halfWidth = size.width / 2;
  const halfHeight = size.height / 2;
  return {
    west: xToLng(x - halfWidth, worldSize),
    east: xToLng(x + halfWidth, worldSize),
    north: yToLat(Math.max(0, y - halfHeight), worldSize),
    south: yToLat(Math.min(worldSize, y + halfHeight), worldSize),
  };
}

export function cameraLandedAt(current: IntroCamera, target: IntroCamera) {
  return (
    Math.abs(current.zoom - target.zoom) < 0.01 &&
    Math.abs(current.lng - target.lng) < 1e-5 &&
    Math.abs(current.lat - target.lat) < 1e-5
  );
}
