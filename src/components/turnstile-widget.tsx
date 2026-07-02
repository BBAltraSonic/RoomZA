"use client";

import { useEffect, useRef } from "react";

type TurnstileApi = {
  render: (
    element: HTMLElement,
    options: {
      sitekey: string;
      callback?: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
      theme?: "light" | "dark" | "auto";
    },
  ) => string;
  reset: (widgetId?: string) => void;
};

function getTurnstile(): TurnstileApi | undefined {
  return (window as unknown as { turnstile?: TurnstileApi }).turnstile;
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";

/**
 * Cloudflare Turnstile widget. Renders only when NEXT_PUBLIC_TURNSTILE_SITE_KEY
 * is configured. When placed inside a <form>, Turnstile injects a hidden
 * `cf-turnstile-response` input automatically, so the token is included in the
 * server action's FormData with no extra wiring.
 */
export function TurnstileWidget({
  onToken,
  className,
}: {
  onToken?: (token: string | null) => void;
  className?: string;
}) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<string | null>(null);

  useEffect(() => {
    if (!siteKey) return;

    const render = () => {
      const turnstile = getTurnstile();
      if (!turnstile || !containerRef.current || widgetRef.current) return;
      widgetRef.current = turnstile.render(containerRef.current, {
        sitekey: siteKey,
        callback: (token) => onToken?.(token),
        "expired-callback": () => onToken?.(null),
        "error-callback": () => onToken?.(null),
        theme: "auto",
      });
    };

    if (getTurnstile()) {
      render();
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", render);
      return () => existing.removeEventListener("load", render);
    }

    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener("load", render);
    document.head.appendChild(script);
    // onToken intentionally excluded: identity is stable enough and re-rendering
    // the widget on every parent render would reset the challenge.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey]);

  if (!siteKey) return null;
  return <div ref={containerRef} className={className} />;
}
