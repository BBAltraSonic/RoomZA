"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import type { ActionResult } from "@/lib/action-result";

/** One action per mounted tour surface; late replies cannot enter another room. */
export function useTourAction() {
  const [, startTransition] = useTransition();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  const busy = useRef(false);
  const active = useRef(true);
  const generation = useRef(0);
  const dispose = useCallback(() => { mounted.current = false; generation.current++; }, []);
  useEffect(() => {
    mounted.current = true;
    return dispose;
  }, [dispose]);
  const isCurrent = useCallback(() => mounted.current && active.current, []);
  const setActive = useCallback((next: boolean) => {
    if (active.current === next) return;
    active.current = next;
    generation.current++;
    busy.current = false;
    setPending(false);
  }, []);
  const run = useCallback(<T,>(work: (isCurrent: () => boolean) => Promise<ActionResult<T>>, done?: (data: T) => void) => {
    if (!isCurrent() || busy.current) return;
    const epoch = generation.current;
    const current = () => isCurrent() && epoch === generation.current;
    busy.current = true;
    setPending(true);
    setError(null);
    startTransition(async () => {
      try {
        const result = await work(current);
        if (!current()) return;
        if (!result.success) { setError(result.error); return; }
        done?.(result.data);
      } catch {
        if (current()) setError("The tour action could not be confirmed. Check the current status and try again.");
      } finally {
        if (mounted.current && epoch === generation.current) { busy.current = false; setPending(false); }
      }
    });
  }, [isCurrent]);
  return { pending, error, setError, run, isCurrent, setActive };
}
