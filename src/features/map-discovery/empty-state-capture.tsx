"use client";

import { useEffect, useRef, useState } from "react";
import { Search, BellRing, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type ViewportBounds = {
  west: number;
  south: number;
  east: number;
  north: number;
};

type TurnstileApi = {
  render: (
    element: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    },
  ) => string;
  reset: (widgetId: string) => void;
};

type AlertFilters = Record<string, unknown> | null;

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export function EmptyStateCapture({
  bbox,
  filters,
  compact = false,
}: {
  bbox: ViewportBounds | null;
  filters: AlertFilters;
  compact?: boolean;
}) {
  const [email, setEmail] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "success">("idle");
  const turnstileContainerRef = useRef<HTMLDivElement>(null);
  const turnstileWidgetRef = useRef<string | null>(null);
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  useEffect(() => {
    if (!turnstileSiteKey || !turnstileContainerRef.current) return;

    const renderTurnstile = () => {
      if (!window.turnstile || !turnstileContainerRef.current || turnstileWidgetRef.current) return;
      turnstileWidgetRef.current = window.turnstile.render(turnstileContainerRef.current, {
        sitekey: turnstileSiteKey,
        callback: setTurnstileToken,
        "expired-callback": () => setTurnstileToken(null),
        "error-callback": () => setTurnstileToken(null),
      });
    };

    if (window.turnstile) {
      renderTurnstile();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    script.async = true;
    script.defer = true;
    script.onload = renderTurnstile;
    document.head.appendChild(script);
  }, [turnstileSiteKey]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !bbox) return;

    setStatus("loading");
    try {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, bbox, filters, turnstileToken }),
      });

      if (!res.ok) throw new Error("Failed to subscribe");
      
      setStatus("success");
      setEmail("");
      setTurnstileToken(null);
      if (turnstileWidgetRef.current) {
        window.turnstile?.reset(turnstileWidgetRef.current);
      }
      toast.success("Alert created", { description: "We'll notify you when homes are listed here." });
    } catch {
      setStatus("idle");
      toast.error("Failed to create alert", { description: "Please try again later." });
    }
  };

  if (status === "success") {
    return (
      <div className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "rounded-xl border border-border bg-warm-surface p-5" : "rounded-2xl border border-border bg-warm-surface p-8"
      )}>
        <div className="flex size-12 items-center justify-center rounded-full bg-forest/10 text-forest">
          <CheckCircle2 className="size-6" />
        </div>
        <h3 className="mt-4 font-semibold text-ink">You&apos;re on the list!</h3>
        <p className="mt-2 text-sm text-muted-foreground">We&apos;ll email you as soon as properties become available in this area.</p>
        <button 
          onClick={() => setStatus("idle")} 
          className="mt-6 text-sm font-medium text-forest hover:underline"
        >
          Create another alert
        </button>
      </div>
    );
  }

  return (
    <div className={cn(
      "flex flex-col",
      compact ? "rounded-2xl border border-border bg-panel p-6 shadow-lg" : "rounded-3xl border border-border bg-panel p-8 shadow-xl"
    )}>
      <div className={cn("mb-5 flex items-center justify-center rounded-full bg-forest/10 text-forest", compact ? "size-10" : "size-12")}>
        <Search className={cn(compact ? "size-5" : "size-6")} />
      </div>
      <h3 className={cn("font-extrabold tracking-tight text-ink", compact ? "text-xl" : "text-3xl")}>
        Where to next?
      </h3>
      <p className={cn("text-muted-foreground", compact ? "mt-2 text-sm" : "mt-3 text-base")}>
        Explore South Africa&apos;s map to find your ideal home. Or get notified the moment a property drops here.
      </p>

      <div className="mt-8 w-full">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label htmlFor="alert-email" className="text-sm font-semibold text-ink">Join the waitlist for this area</label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="alert-email"
              type="email"
              required
              placeholder="Your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={status === "loading"}
              className="h-11 w-full flex-1 rounded-lg border border-input bg-background px-4 text-base shadow-sm ring-offset-background transition-colors placeholder:text-muted-foreground focus-visible:border-forest focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-forest disabled:cursor-not-allowed disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={status === "loading" || !email || Boolean(turnstileSiteKey && !turnstileToken)}
              className="inline-flex h-11 items-center justify-center rounded-lg bg-forest px-6 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-forest/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest disabled:pointer-events-none disabled:opacity-50"
            >
              {status === "loading" ? <Loader2 className="size-4 animate-spin" /> : "Notify me"}
            </button>
          </div>
          {turnstileSiteKey ? <div ref={turnstileContainerRef} className="min-h-16 w-full" /> : null}
        </form>
      </div>
    </div>
  );
}
