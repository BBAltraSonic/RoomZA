"use client";
import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from "react";
import { z } from "zod";
import { DiscoveryDetailSurface } from "@/features/discovery/discovery-detail-surface";
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
        const sameAction = links.filter(link => Boolean(link.matches('[data-slot="special-card-media"]')) === openerMedia.current);
        (sameAction.find(link => !link.closest('[aria-label="Discovery map"]')) ?? sameAction[0] ?? links[0])?.focus({ preventScroll: true });
      }
    }
    previous.current = id;
  }, [id]);
  return <Context.Provider value={{ id, category, open, close }}>{children}</Context.Provider>;
}
export function SpecialDetailSurface() {
  const context = useSpecialDetails();
  if (!context?.id) return null;
  return <DiscoveryDetailSurface key={context.category + context.id} label="Special details" onClose={context.close}>
    <SpecialDetailContent target={{ category: context.category, id: context.id }} onClose={context.close} contained />
  </DiscoveryDetailSurface>;
}
