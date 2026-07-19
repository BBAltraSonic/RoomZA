"use client";

import { useCallback, useEffect, useState } from "react";

type HorizontalScrollState = {
  atStart: boolean;
  atEnd: boolean;
  progress: number;
  canScroll: boolean;
};

const INITIAL_STATE: HorizontalScrollState = {
  atStart: true,
  atEnd: true,
  progress: 0,
  canScroll: false,
};

function readState(element: HTMLElement): HorizontalScrollState {
  const maxScroll = Math.max(0, element.scrollWidth - element.clientWidth);
  const scrollLeft = Math.max(0, element.scrollLeft);
  const progress = maxScroll <= 0 ? 0 : Math.min(1, scrollLeft / maxScroll);
  return {
    atStart: scrollLeft <= 2,
    atEnd: maxScroll - scrollLeft <= 2,
    progress,
    canScroll: maxScroll > 2,
  };
}

export function useHorizontalScrollAffordance<T extends HTMLElement>() {
  const [state, setState] = useState(INITIAL_STATE);
  const [node, setNode] = useState<T | null>(null);

  const refresh = useCallback((element: HTMLElement | null = node) => {
    if (!element) return;
    setState(readState(element));
  }, [node]);

  const setScrollElement = useCallback((element: T | null) => {
    setNode(element);
    if (element) setState(readState(element));
  }, []);

  useEffect(() => {
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => refresh(node));
    observer.observe(node);
    return () => observer.disconnect();
  }, [node, refresh]);

  const onScroll = useCallback((event: React.UIEvent<T>) => {
    setState(readState(event.currentTarget));
  }, []);

  const onWheel = useCallback((event: React.WheelEvent<T>) => {
    if (Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
    if (!event.currentTarget.matches(":hover")) return;
    event.currentTarget.scrollBy({ left: event.deltaY, behavior: "auto" });
  }, []);

  const scrollByPage = useCallback(
    (direction: "previous" | "next") => {
      if (!node) return;
      node.scrollBy({
        left: direction === "next" ? node.clientWidth * 0.85 : -node.clientWidth * 0.85,
        behavior: "smooth",
      });
    },
    [node],
  );

  return { setScrollElement, onScroll, onWheel, refresh, scrollByPage, ...state };
}
