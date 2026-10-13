"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
const Clock = createContext<number | null>(null);
export function DiscoveryClock({ serverNow, children }: { serverNow: string; children: ReactNode }) {
  const [sample, setSample] = useState({ source: serverNow, elapsed: 0 });
  useEffect(() => { const start = performance.now(); const timer = setInterval(() => setSample({ source: serverNow, elapsed: performance.now() - start }), 1000); return () => clearInterval(timer); }, [serverNow]);
  return <Clock.Provider value={Date.parse(serverNow) + (sample.source === serverNow ? sample.elapsed : 0)}>{children}</Clock.Provider>;
}
export function useDiscoveryNow() { return useContext(Clock); }
export function specialTiming(startsAt: string, endsAt: string, now: number) {
  const start = Date.parse(startsAt), end = Date.parse(endsAt);
  const upcoming = now < start, ended = now >= end;
  const remaining = Math.max(0, (upcoming ? start : end) - now);
  const seconds = Math.ceil(remaining / 1000), hours = Math.floor(seconds / 3600), minutes = Math.floor(seconds / 60) % 60;
  const time = hours ? hours + "h " + minutes + "m" : minutes + "m " + (seconds % 60) + "s";
  return { upcoming, ended, remaining, tone: remaining < 3600000 ? "urgent" : remaining < 10800000 ? "soon" : "later", label: ended ? "Ended" : (upcoming ? "Starts in " : "Ends in ") + time, progress: upcoming || ended ? 0 : Math.max(0, Math.min(1, remaining / (end - start))) };
}
