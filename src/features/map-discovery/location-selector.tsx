"use client";

import { ChevronDown, MapPin, Search, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { useOnClickOutside } from "@/lib/hooks/use-on-click-outside";
import type { DiscoveryPlace } from "@/features/places/place";
import { cn } from "@/lib/utils";

type LocationSelectorProps = {
  idPrefix: string;
  mapApiKey?: string;
  selectedLocation?: string | null; viewingArea?: string | null;
  onSelect: (location: DiscoveryPlace) => void;
  className?: string;
  searchUrl?: string;
};

export function LocationSelector({ idPrefix, selectedLocation, viewingArea, onSelect, className, searchUrl = "/api/places" }: LocationSelectorProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DiscoveryPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setResults([]);
    setActiveIndex(-1);
    setLoading(false);
    setError(false);
  }, []);
  const closeOnOutside = useCallback(() => {
    if (open) close();
  }, [close, open]);
  useOnClickOutside(surfaceRef, closeOnOutside);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const search = query.trim();
    if (!open || search.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(false);
      fetch(`${searchUrl}?q=${encodeURIComponent(search)}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Place search failed");
        return response.json() as Promise<{ data: { places: DiscoveryPlace[] } }>;
      }).then((payload) => {
        if (!controller.signal.aborted) setResults(payload.data.places);
      }).catch(() => {
        if (!controller.signal.aborted) setError(true);
      }).finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    }, 200);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, query, searchUrl]);

  const select = (location: DiscoveryPlace) => {
    onSelect(location);
    close();
    triggerRef.current?.focus();
  };

  return (
    <div ref={surfaceRef} className={cn("relative shrink-0", className)}>
      <button
        ref={triggerRef}
        id={`${idPrefix}-location-trigger`}
        type="button"
        aria-label={`Location: ${selectedLocation || (viewingArea ? `Map area: ${viewingArea}. Choose a location` : "Choose a location")}`}
        aria-expanded={open}
        onClick={() => open ? close() : setOpen(true)}
        className="flex min-h-11 w-full items-center gap-2 rounded-full border border-border/70 bg-panel px-3.5 text-sm font-semibold text-ink shadow-[var(--shadow-control)] transition-colors hover:border-forest/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <MapPin className="size-4 shrink-0 text-forest" aria-hidden="true" />
        <span className="max-w-40 truncate text-left">{selectedLocation || (viewingArea ? "Map area" : "Choose location")}</span>
        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-border bg-panel p-2 shadow-[var(--elevation-3)]">
          <div className="flex items-center gap-2 rounded-xl border border-border px-3 focus-within:border-forest focus-within:ring-1 focus-within:ring-forest">
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              ref={inputRef}
              type="search"
              role="combobox"
              aria-label="Search South African locations"
              aria-controls={`${idPrefix}-location-options`}
              aria-expanded={results.length > 0}
              aria-activedescendant={activeIndex >= 0 ? `${idPrefix}-location-${activeIndex}` : undefined}
              placeholder="Suburb, town or city"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setResults([]);
                setActiveIndex(-1);
                setError(false);
                setLoading(event.target.value.trim().length >= 2);
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  close();
                  triggerRef.current?.focus();
                } else if (event.key === "ArrowDown" && results.length) {
                  event.preventDefault();
                  setActiveIndex((current) => (current + 1) % results.length);
                } else if (event.key === "ArrowUp" && results.length) {
                  event.preventDefault();
                  setActiveIndex((current) => current < 0 ? results.length - 1 : (current - 1 + results.length) % results.length);
                } else if (event.key === "Enter" && activeIndex >= 0 && results[activeIndex]) {
                  event.preventDefault();
                  select(results[activeIndex]);
                }
              }}
              className="min-h-11 min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted-foreground"
            />
            {query ? (
              <button type="button" onClick={() => { setQuery(""); setResults([]); setActiveIndex(-1); setLoading(false); setError(false); }} aria-label="Clear location search" className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <X className="size-4" aria-hidden="true" />
              </button>
            ) : null}
          </div>
          <div aria-live="polite" className="px-2 pt-2 text-xs text-muted-foreground">
            {error ? "Could not load places. Try again." : loading ? "Searching South Africa…" : query.trim().length < 2 ? "Type at least two letters." : results.length === 0 ? "No matching places." : null}
          </div>
          {results.length ? (
            <ul id={`${idPrefix}-location-options`} role="listbox" aria-label="South African locations" className="mt-1 max-h-64 overflow-y-auto">
              {results.map((location, index) => (
                <li key={location.id} role="presentation">
                  <button
                    type="button"
                    id={`${idPrefix}-location-${index}`}
                    role="option"
                    aria-selected={activeIndex === index}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => select(location)}
                    className={cn("flex min-h-11 w-full flex-col justify-center rounded-lg px-3 py-2 text-left text-sm text-ink hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", activeIndex === index && "bg-muted")}
                  >
                    <span className="font-medium">{location.label}</span>
                    {location.secondaryLabel ? <span className="text-xs text-muted-foreground">{location.secondaryLabel}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
