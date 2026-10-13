"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { z } from "zod";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useBrowserDiscoverySearchParams } from "./use-discovery-search-params";
import dynamic from "next/dynamic";
import type { SpecialCategory } from "./saved-specials-client";

const SpecialDetailContent = dynamic(() => import("./special-detail-content").then(module => module.SpecialDetailContent), { loading: () => <p role="status" className="p-5">Loading details...</p> });

type Details = { id: string | null; open: (id: string) => void; close: () => void; category: SpecialCategory };
const Context = createContext<Details | null>(null);
export const useSpecialDetails = () => useContext(Context);
export function SpecialDetailsProvider({ category, children }: { category: SpecialCategory; children: ReactNode }) {
  const params = useBrowserDiscoverySearchParams(), parsed = z.string().uuid().safeParse(params.get("detailId"));
  const id = parsed.success ? parsed.data : null;
  const opener = useRef<HTMLElement | null>(null);
  const openerHref = useRef<string | null>(null);
  const openerMedia = useRef(false);
  function open(next: string) {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    openerHref.current = opener.current?.closest("a")?.getAttribute("href") ?? (category === "shopping" ? "/offers/" : "/specials/") + next;
    openerMedia.current = Boolean(opener.current?.closest('[data-slot="special-card-media"]'));
    const url = new URL(window.location.href); url.searchParams.set("detailId", next);
    if (id !== next) window.history.pushState(window.history.state, "", url);
  }
  const close = useCallback(() => {
    const url = new URL(window.location.href); url.searchParams.delete("detailId");
    window.history.replaceState(window.history.state, "", url);
  }, []);
  const previous = useRef(id);
  useEffect(() => {
    if (previous.current && !id) {
      if (opener.current?.isConnected && opener.current !== document.body) opener.current.focus();
      else {
        const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('[data-slot="special-card"] a')).filter(link => link.getAttribute("href") === openerHref.current);
        (links.find(link => Boolean(link.matches('[data-slot="special-card-media"]')) === openerMedia.current) ?? links[0])?.focus();
      }
    }
    previous.current = id;
  }, [id]);
  return <Context.Provider value={{ id, category, open, close }}>{children}</Context.Provider>;
}
const desktopQuery = "(min-width: 1024px)";
const subscribe = (callback: () => void) => { const query = window.matchMedia(desktopQuery); query.addEventListener("change", callback); return () => query.removeEventListener("change", callback); };
const snapshot = () => window.matchMedia(desktopQuery).matches;
export function SpecialDetailSurface() {
  const context = useSpecialDetails(), desktop = useSyncExternalStore(subscribe, snapshot, () => false);
  const panel = useRef<HTMLDivElement>(null);
  const id = context?.id;
  const close = context?.close;
  useEffect(() => { if (desktop && id) panel.current?.querySelector<HTMLButtonElement>("button")?.focus(); }, [desktop, id]);
  useEffect(() => {
    if (!desktop || !id || !close) return;
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape" && !event.defaultPrevented && !document.querySelector('[role="dialog"]')) close(); };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [desktop, id, close]);
  if (!context?.id) return null;
  const content = <SpecialDetailContent target={{ category: context.category, id: context.id }} onClose={context.close} contained />;
  return desktop ? <div ref={panel} className="h-full min-h-0">{content}</div>
    : <Dialog open modal onOpenChange={open => { if (!open) context.close(); }}><DialogContent aria-modal="true" showCloseButton={false} className="bottom-0 top-auto h-[calc(100dvh-max(0.5rem,env(safe-area-inset-top)))] max-h-none gap-0 rounded-t-2xl p-0 sm:bottom-0 sm:top-auto sm:max-w-none sm:translate-y-0 sm:rounded-t-2xl"><DialogTitle className="sr-only">Special details</DialogTitle>{content}</DialogContent></Dialog>;
}
