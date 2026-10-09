"use client";
import { useCallback, useEffect, useRef } from "react";

/** Supersession and scope cleanup remain effective even after response headers arrive. */
export function useLatestRead(scope: string) {
  const requestRef = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  const activeScope = useRef(scope);
  useEffect(() => {
    mounted.current = true;
    activeScope.current = scope;
    return () => { mounted.current = false; requestRef.current?.abort(); requestRef.current = null; };
  }, [scope]);
  return useCallback(() => {
    const controller = new AbortController();
    if (!mounted.current || activeScope.current !== scope) {
      controller.abort();
      return controller;
    }
    requestRef.current?.abort();
    requestRef.current = controller;
    return controller;
  }, [scope]);
}
