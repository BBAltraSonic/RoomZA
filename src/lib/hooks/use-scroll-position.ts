"use client";

import { useCallback, useEffect } from "react";

type ScrollPositionOptions<T extends HTMLElement> = {
  keyName: string;
  ref: React.RefObject<T | null>;
  enabled?: boolean;
};

export function useScrollPosition<T extends HTMLElement>({
  keyName,
  ref,
  enabled = true,
}: ScrollPositionOptions<T>) {
  useEffect(() => {
    if (!enabled) return;
    const element = ref.current;
    if (!element) return;

    try {
      const saved = window.sessionStorage.getItem(keyName);
      if (saved) {
        element.scrollTop = Number(saved) || 0;
      }
    } catch {
      /* sessionStorage can be unavailable */
    }
  }, [enabled, keyName, ref]);

  return useCallback(
    (event: React.UIEvent<T>) => {
      if (!enabled) return;
      try {
        window.sessionStorage.setItem(keyName, String(event.currentTarget.scrollTop));
      } catch {
        /* ignore persistence failures */
      }
    },
    [enabled, keyName],
  );
}
