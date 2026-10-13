"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useSyncExternalStore, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { z } from "zod";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
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

const desktopQuery = "(min-width: 1024px)";
const subscribe = (callback: () => void) => {
  const query = window.matchMedia(desktopQuery);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
};
const snapshot = () => window.matchMedia(desktopQuery).matches;

export function ServiceDetailSurface() {
  const details = useServiceDetails();
  const desktop = useSyncExternalStore(subscribe, snapshot, () => false);
  const panel = useRef<HTMLDivElement>(null);
  const id = details?.id;
  const close = details?.close;
  useEffect(() => { if (desktop && id) panel.current?.focus(); }, [desktop, id]);
  useEffect(() => {
    if (!desktop || !id || !close) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented && !document.querySelector('[role="dialog"]')) close();
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [desktop, id, close]);
  if (!details?.id) return null;
  const content = <ServiceDetailContent id={details.id} onClose={details.close} />;
  return desktop ? <div ref={panel} role="group" aria-label="Service details" tabIndex={-1} className="h-full min-h-0 outline-none">{content}</div>
    : <Dialog open modal onOpenChange={open => { if (!open) details.close(); }}>
      <DialogContent aria-modal="true" showCloseButton={false} finalFocus={false}
        className="bottom-0 top-auto h-[calc(100dvh-max(0.5rem,env(safe-area-inset-top)))] max-h-none gap-0 rounded-t-2xl p-0 sm:bottom-0 sm:top-auto sm:max-w-none sm:translate-y-0 sm:rounded-t-2xl">
        <DialogTitle className="sr-only">Service details</DialogTitle>{content}
      </DialogContent>
    </Dialog>;
}
