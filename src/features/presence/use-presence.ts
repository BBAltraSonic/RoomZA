"use client";

import { useEffect, useRef } from "react";

import { touchPresence } from "./actions";

/**
 * Throttled presence heartbeat (design §3.1). Persisted-first: this is an HTTP
 * RPC, NOT a Realtime socket, so a browsing user consumes zero Realtime
 * connections. It:
 *
 * - beats at most once per `HEARTBEAT_MS` (default 60s) while the tab is visible,
 * - beats immediately on mount and on `visibilitychange` → visible,
 * - fires a best-effort final beat via `sendBeacon` on `pagehide`/unload so the
 *   sweep window is minimised.
 *
 * The server RPC is itself write-throttled (skips writes newer than 45s), so an
 * over-eager caller can never amplify write volume. Presence is ambient and
 * must never block; every failure is swallowed.
 */
export const HEARTBEAT_MS = 60_000;

type UsePresenceOptions = {
  /** Disable the heartbeat entirely (e.g. signed-out or invisible mode). */
  enabled?: boolean;
  /** Desired live status while active. Defaults to "available". */
  desired?: "available" | "busy";
};

export function usePresenceHeartbeat({ enabled = true, desired = "available" }: UsePresenceOptions = {}) {
  const desiredRef = useRef(desired);
  useEffect(() => {
    desiredRef.current = desired;
  }, [desired]);

  useEffect(() => {
    if (!enabled || typeof document === "undefined") {
      return;
    }

    let cancelled = false;

    const beat = () => {
      if (cancelled || document.visibilityState !== "visible") {
        return;
      }
      void touchPresence(desiredRef.current);
    };

    // Immediate beat on mount so the badge is correct on first paint.
    beat();

    const interval = window.setInterval(beat, HEARTBEAT_MS);

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        beat();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    // Best-effort final beat on unload. `sendBeacon` survives the page teardown
    // that a normal fetch would not. This is purely an optimisation to shrink
    // the sweep gap; the sweep still catches a client that dies silently.
    const onPageHide = () => {
      try {
        const url = "/api/presence/beat";
        const blob = new Blob([JSON.stringify({ desired: "offline" })], {
          type: "application/json",
        });
        navigator.sendBeacon?.(url, blob);
      } catch {
        // Ignore: unload beacons are strictly best-effort.
      }
    };
    window.addEventListener("pagehide", onPageHide);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [enabled]);
}
