"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { z } from "zod";
import { DiscoveryDetailSurface } from "@/features/discovery/discovery-detail-surface";
import { useBrowserDiscoverySearchParams } from "@/features/discovery/use-discovery-search-params";

const ServiceDetailContent = dynamic(() => import("./service-detail-content").then(module => module.ServiceDetailContent), {
  loading: () => <p role="status" className="p-5">Loading service details...</p>,
});
type Details = { id: string | null; open: (id: string) => void; close: () => void };
const Context = createContext<Details | null>(null);
export const useServiceDetails = () => useContext(Context);

export function ServiceDetailsProvider({ children }: { children: ReactNode }) {
  const params = useBrowserDiscoverySearchParams();
  const parsed = z.string().uuid().safeParse(params.get("detailId"));
  const id = parsed.success ? parsed.data : null;
  const opener = useRef<HTMLElement | null>(null);
  const openerId = useRef<string | null>(null);
  const open = useCallback((next: string) => {
    if (!z.string().uuid().safeParse(next).success || next === id) return;
    openerId.current = next;
    const active = document.activeElement;
    opener.current = active instanceof HTMLElement && active.closest(`[data-card-id="${next}"]`) ? active : null;
    const url = new URL(window.location.href);
    url.searchParams.set("detailId", next);
    window.history.pushState(window.history.state, "", url);
  }, [id]);
  const close = useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete("detailId");
    window.history.replaceState(window.history.state, "", url);
  }, []);
  const previous = useRef(id);
  useEffect(() => {
    if (previous.current && !id) {
      const target = opener.current?.isConnected ? opener.current : document.querySelector<HTMLButtonElement>(
        `[data-card-category="service"][data-card-id="${openerId.current ?? previous.current}"] h2 button`,
      );
      target?.focus({ preventScroll: true });
    }
    previous.current = id;
  }, [id]);
  const value = useMemo(() => ({ id, open, close }), [id, open, close]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function ServiceDetailSurface() {
  const details = useServiceDetails();
  if (!details?.id) return null;
  return <DiscoveryDetailSurface key={details.id} label="Service details" onClose={details.close}>
    <ServiceDetailContent id={details.id} onClose={details.close} />
  </DiscoveryDetailSurface>;
}
