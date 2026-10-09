"use client";

import { useMemo, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";

const changeEvent = "pinpoint:discovery-controls";
let subscribers = 0;
let restoreHistory: (() => void) | undefined;

function subscribe(onChange: () => void) {
  // Prerendered Cloudflare shells do not contain request-specific query state.
  // Read the address bar after hydration, including client navigation/history.
  if (subscribers++ === 0) {
    const push = window.history.pushState;
    const replace = window.history.replaceState;
    const wrappedPush: History["pushState"] = function (this: History, ...args) {
      push.apply(this, args);
      queueMicrotask(() => window.dispatchEvent(new Event(changeEvent)));
    };
    const wrappedReplace: History["replaceState"] = function (this: History, ...args) {
      replace.apply(this, args);
      queueMicrotask(() => window.dispatchEvent(new Event(changeEvent)));
    };
    window.history.pushState = wrappedPush;
    window.history.replaceState = wrappedReplace;
    restoreHistory = () => {
      // Do not overwrite a newer framework history wrapper.
      if (window.history.pushState === wrappedPush) window.history.pushState = push;
      if (window.history.replaceState === wrappedReplace) window.history.replaceState = replace;
    };
  }
  window.addEventListener("popstate", onChange);
  window.addEventListener(changeEvent, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(changeEvent, onChange);
    if (--subscribers === 0) {
      restoreHistory?.();
      restoreHistory = undefined;
    }
  };
}

const snapshot = () => window.location.search;
const emptyServerSearch = () => "";

/** Header links only need browser state; they do not require a Next router. */
export function useBrowserDiscoverySearchParams() {
  const search = useSyncExternalStore(subscribe, snapshot, emptyServerSearch);
  return useMemo(() => new URLSearchParams(search), [search]);
}

/** Public discovery query state, with a hydration-safe prerender fallback. */
export function useDiscoverySearchParams() {
  const serverParams = useSearchParams();
  const search = useSyncExternalStore(subscribe, snapshot, () => "?" + serverParams.toString());
  return useMemo(() => new URLSearchParams(search), [search]);
}
