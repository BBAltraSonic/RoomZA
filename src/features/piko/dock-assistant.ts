"use client";

import { useEffect, useSyncExternalStore } from "react";

/**
 * The dock's assistant circle belongs to the layout, while each discovery page owns its
 * own assistant panel. A page registers its panel here; the dock reads it back.
 */
export type DockAssistant = { open: boolean; toggle: () => void };

let current: DockAssistant | null = null;
let trigger: HTMLElement | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function publish(next: DockAssistant | null) {
  current = next;
  for (const listener of listeners) listener();
}

/**
 * Registers the page's assistant with the dock while the page is mounted, and opens it
 * when the person arrived from another page's assistant circle.
 */
export function useRegisterDockAssistant(open: boolean, toggle: () => void) {
  useEffect(() => {
    const entry = { open, toggle };
    publish(entry);
    return () => { if (current === entry) publish(null); };
  }, [open, toggle]);
  useEffect(() => {
    if (takeAssistantArrivalRequest()) toggle();
    // Only on arrival: later toggles belong to the person.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

export function useDockAssistant(): DockAssistant | null {
  return useSyncExternalStore(subscribe, () => current, () => null);
}

/** The dock hands its button over so a closing panel can return focus to it. */
export function setDockAssistantTrigger(element: HTMLElement | null) {
  trigger = element;
}

export function focusDockAssistant() {
  trigger?.focus();
}

/** Pages without an assistant send people to Explore, which opens its assistant on arrival. */
const PENDING_KEY = "pinpoint:open-assistant";

export function requestAssistantOnArrival() {
  try { sessionStorage.setItem(PENDING_KEY, "1"); } catch { /* Storage can be unavailable; Explore still opens. */ }
}

function takeAssistantArrivalRequest(): boolean {
  try {
    if (sessionStorage.getItem(PENDING_KEY) !== "1") return false;
    sessionStorage.removeItem(PENDING_KEY);
    return true;
  } catch {
    return false;
  }
}
