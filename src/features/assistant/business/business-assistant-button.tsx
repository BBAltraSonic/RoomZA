"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";

import { PikoFace } from "@/features/piko/piko";
import { cn } from "@/lib/utils";

import { getBusinessView } from "./business-actions";

const BusinessPanel = dynamic(() => import("./business-panel").then((module) => module.BusinessPanel), { ssr: false });

/** How often the closed button checks for things that need the lister. */
export const BADGE_REFRESH_MS = 120_000;

/**
 * Piko's button on My listings, with a badge when something needs attention or a
 * reminder is due (proposal, "Today"). The count is the same plain query the Today screen
 * uses, refreshed in the background while the page is visible. No AI is involved.
 */
export function BusinessAssistantButton() {
  const [open, setOpen] = useState(false);
  const [badge, setBadge] = useState(0);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) return;
    let cancelled = false;
    const check = () => {
      if (document.visibilityState !== "visible") return;
      void getBusinessView({ template: "today" })
        .then((result) => {
          if (!cancelled && result.success && result.data.template === "today") setBadge(result.data.badge);
        })
        .catch(() => undefined);
    };
    check();
    const timer = window.setInterval(check, BADGE_REFRESH_MS);
    document.addEventListener("visibilitychange", check);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, [open]);

  const close = useCallback(() => {
    setOpen(false);
    buttonRef.current?.focus();
  }, []);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "relative inline-flex min-h-11 items-center gap-2 rounded-full border bg-panel px-4 text-sm font-semibold text-ink transition-colors hover:border-forest/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          open ? "border-forest" : "border-border",
        )}
      >
        <PikoFace mood="working" size={28} className="-ml-2" />
        Piko
        {badge > 0 ? (
          <>
            <span aria-hidden="true" className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold tabular-nums text-primary-foreground">
              {badge > 99 ? "99+" : badge}
            </span>
            <span className="sr-only">{`, ${badge} ${badge === 1 ? "thing needs" : "things need"} you`}</span>
          </>
        ) : null}
      </button>
      {open ? <BusinessPanel onClose={close} onBadge={setBadge} /> : null}
    </>
  );
}
