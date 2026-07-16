"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  deriveScrollAdaptation,
  type ScrollAdaptationInput,
  type ScrollAdaptationState,
} from "@/lib/scroll-adaptation";

type UseScrollAdaptationOptions = Omit<
  ScrollAdaptationInput,
  "scrollTop" | "scrollHeight" | "clientHeight" | "previousScrollTop" | "deltaTimeMs"
> & {
  initialScrollTop?: number;
};

const INITIAL_STATE: ScrollAdaptationState = deriveScrollAdaptation({
  scrollTop: 0,
  scrollHeight: 1,
  clientHeight: 1,
});

export function useScrollAdaptation(options: UseScrollAdaptationOptions = {}) {
  const [state, setState] = useState(INITIAL_STATE);
  const frameRef = useRef<number | null>(null);
  const optionsRef = useRef(options);
  const lastRef = useRef({
    scrollTop: options.initialScrollTop ?? 0,
    time: 0,
  });

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(
    () => () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
    },
    [],
  );

  const measure = useCallback(
    (element: Pick<HTMLElement, "scrollTop" | "scrollHeight" | "clientHeight">) => {
      const now = performance.now();
      const previous = lastRef.current;
      const nextInput = {
        ...optionsRef.current,
        scrollTop: element.scrollTop,
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
        previousScrollTop: previous.scrollTop,
        deltaTimeMs: now - previous.time,
      };

      lastRef.current = { scrollTop: element.scrollTop, time: now };
      setState(deriveScrollAdaptation(nextInput));
    },
    [],
  );

  const onScroll = useCallback(
    (event: React.UIEvent<HTMLElement>) => {
      const element = event.currentTarget;
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        measure(element);
      });
    },
    [measure],
  );

  return { ...state, onScroll, measure };
}
