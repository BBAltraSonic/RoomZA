"use client";

import { Check, ChevronDown, Clock3, MapPin, Search, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { useOnClickOutside } from "@/lib/hooks/use-on-click-outside";
import type { DiscoveryPlace } from "@/features/places/place";
import { CATALOGUE_SEARCH_URL, RECENT_LOCATION_KEY, MAX_RECENT_LOCATIONS, catalogueResponseSchema,
  locationMatches, recentLocationIdsSchema } from "@/features/places/catalogue-contract";
import { cn } from "@/lib/utils";

type LocationSelectorProps = {
  idPrefix: string;
  mapApiKey?: string;
  selectedLocation?: string | null; viewingArea?: string | null;
  onSelect: (location: DiscoveryPlace) => void;
  className?: string;
  searchUrl?: string;
};

function Highlight({ text, query }: { text: string; query: string }) {
  const words = query.trim().split(/[\s,]+/).filter(Boolean).map(word => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!words.length) return text;
  const pattern = new RegExp(`(${words.join("|")})`, "gi");
  return text.split(pattern).map((part, index) => index % 2
    ? <mark key={index} className="bg-accent text-inherit font-semibold">{part}</mark> : part);
}

export function LocationSelector({ idPrefix, selectedLocation, viewingArea, onSelect, className, searchUrl = CATALOGUE_SEARCH_URL }: LocationSelectorProps) {
  const usesCatalogue = searchUrl === CATALOGUE_SEARCH_URL;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DiscoveryPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [recentPlaces, setRecentPlaces] = useState<DiscoveryPlace[]>([]);
  const [retry, setRetry] = useState(0);
  const [activeIndex, setActiveIndex] = useState(-1);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cacheRef = useRef(new Map<string, { expires: number; places: DiscoveryPlace[]; recentPlaces: DiscoveryPlace[] }>());
  const searching = query.trim().length >= 2;
  const recentOptions = usesCatalogue ? recentPlaces.filter(place => locationMatches(place, query)) : [];
  const recentOptionIds = new Set(recentOptions.map(place => place.id));
  // The server also matches aliases and misspellings; literal filtering here
  // would hide those valid suggestions.
  const suggestedOptions = results.filter(place => !recentOptionIds.has(place.id));
  const options = [...recentOptions, ...suggestedOptions].slice(0, 6);

  const show = () => {
    if (usesCatalogue) {
      try {
        const stored = recentLocationIdsSchema.safeParse(JSON.parse(localStorage.getItem(RECENT_LOCATION_KEY) ?? "[]"));
        setRecentIds(stored.success ? stored.data : []);
      } catch { setRecentIds([]); }
    }
    setLoading(usesCatalogue);
    setOpen(true);
  };

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setResults([]);
    setActiveIndex(-1);
    setLoading(false);
    setError(false);
    setRateLimited(false);
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
    if (!open || (search.length < 2 && (search.length > 0 || !usesCatalogue))) return;
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (usesCatalogue && !search && recentIds.length) params.set("recent", recentIds.join(","));
    const url = `${searchUrl}${params.size ? `?${params}` : ""}`;
    const timer = window.setTimeout(() => {
      const cached = cacheRef.current.get(url);
      if (cached && cached.expires > Date.now()) {
        setResults(cached.places);
        if (!search) setRecentPlaces(cached.recentPlaces);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(false);
      setRateLimited(false);
      fetch(url, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]) })
      .then(async (response) => {
        if (!response.ok) {
          if (!controller.signal.aborted) setRateLimited(response.status === 429);
          throw new Error("Place search failed");
        }
        return catalogueResponseSchema.parse(await response.json());
      }).then((payload) => {
        if (controller.signal.aborted) return;
        setResults(payload.data.places);
        setActiveIndex(-1);
        if (!search) setRecentPlaces(payload.data.recentPlaces);
        if (cacheRef.current.size >= 20) cacheRef.current.delete(cacheRef.current.keys().next().value!);
        cacheRef.current.set(url, { ...payload.data, expires: Date.now() + 5 * 60_000 });
      }).catch(() => {
        if (!controller.signal.aborted) setError(true);
      }).finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    }, search ? 250 : 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, query, searchUrl, recentIds, retry, usesCatalogue]);

  useEffect(() => {
    if (open && activeIndex >= 0) document.getElementById(`${idPrefix}-location-${activeIndex}`)
      ?.scrollIntoView?.({ block: "nearest" });
  }, [open, activeIndex, idPrefix]);

  const select = (location: DiscoveryPlace) => {
    if (usesCatalogue) {
      const ids = [location.id, ...recentIds.filter(id => id !== location.id)].slice(0, MAX_RECENT_LOCATIONS);
      setRecentIds(ids);
      setRecentPlaces([location, ...recentPlaces.filter(place => place.id !== location.id)].slice(0, MAX_RECENT_LOCATIONS));
      cacheRef.current.clear();
      try { localStorage.setItem(RECENT_LOCATION_KEY, JSON.stringify(ids)); } catch { /* Storage may be disabled. */ }
    }
    onSelect(location);
    close();
    triggerRef.current?.focus();
  };

  return (
    <div ref={surfaceRef} className={cn("relative shrink-0", className)} onKeyDown={event => {
      if (event.key === "Escape" && open) { event.preventDefault(); close(); triggerRef.current?.focus(); }
    }} onBlur={event => {
      if (open && event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) close();
    }}>
      <button
        ref={triggerRef}
        id={`${idPrefix}-location-trigger`}
        type="button"
        aria-label={`Location: ${selectedLocation || (viewingArea ? `Map area: ${viewingArea}. Choose a location` : "Choose a location")}`}
        aria-expanded={open}
        aria-controls={open ? `${idPrefix}-location-panel` : undefined}
        onClick={() => open ? close() : show()}
        className="flex min-h-11 w-full items-center gap-2 border-0 bg-transparent px-0 text-sm font-semibold text-ink shadow-none transition-opacity hover:opacity-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <MapPin className="size-4 shrink-0 text-forest" aria-hidden="true" />
        <span className="max-w-40 truncate text-left">{selectedLocation || (viewingArea ? "Map area" : "Choose location")}</span>
        <ChevronDown className={cn("size-3.5 shrink-0 transition-transform motion-reduce:transition-none", open && "rotate-180")} aria-hidden="true" />
      </button>
      {open ? (
        <div id={`${idPrefix}-location-panel`} className="absolute left-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] max-h-[min(34rem,65dvh)] overflow-y-auto rounded-2xl border border-border bg-panel p-2 shadow-[var(--elevation-3)]">
          <div className="px-2 pb-2 pt-1 text-sm font-semibold text-ink">Choose a location</div>
          <div className="flex items-center gap-2 rounded-xl border border-border px-3 focus-within:border-forest focus-within:ring-1 focus-within:ring-forest">
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              ref={inputRef}
              type="search"
              role="combobox"
              aria-label="Search South African locations"
              aria-controls={options.length ? `${idPrefix}-location-options` : undefined}
              aria-expanded={options.length > 0}
              aria-autocomplete="list"
              aria-describedby={`${idPrefix}-location-status`}
              aria-activedescendant={activeIndex >= 0 ? `${idPrefix}-location-${activeIndex}` : undefined}
              placeholder="Search suburb, town or city"
              maxLength={100}
              autoComplete="off"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setResults([]);
                setActiveIndex(-1);
                setError(false);
                setRateLimited(false);
                setLoading(event.target.value.trim().length >= 2 || (usesCatalogue && !event.target.value.trim()));
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  close();
                  triggerRef.current?.focus();
                } else if (event.key === "ArrowDown" && options.length) {
                  event.preventDefault();
                  setActiveIndex((current) => (current + 1) % options.length);
                } else if (event.key === "ArrowUp" && options.length) {
                  event.preventDefault();
                  setActiveIndex((current) => current < 0 ? options.length - 1 : (current - 1 + options.length) % options.length);
                } else if (event.key === "Enter" && options.length) {
                  event.preventDefault();
                  const location = options[activeIndex < 0 ? 0 : activeIndex];
                  if (location) select(location);
                }
              }}
              className="min-h-11 min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted-foreground"
            />
            {query ? (
              <button type="button" onClick={() => { setQuery(""); setResults([]); setActiveIndex(-1); setLoading(usesCatalogue); setError(false); setRateLimited(false); inputRef.current?.focus(); }} aria-label="Clear location search" className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <X className="size-4" aria-hidden="true" />
              </button>
            ) : null}
          </div>
          <div id={`${idPrefix}-location-status`} role="status" aria-live="polite" className="px-2 pt-2 text-xs text-muted-foreground">
            {error ? rateLimited ? "Too many searches. Please wait a moment." : "Could not load locations. Try again."
              : loading ? searching ? "Searching locations…" : "Loading suggestions…"
              : options.length ? searching ? `${options.length} matching locations.` : "Search or choose a location below."
              : searching ? "No location found. Try another spelling or a nearby town."
              : query.trim().length === 1 || !usesCatalogue ? "Type at least two letters."
              : "Search for a suburb, town or city. No suggested locations are available yet."}
          </div>
          {error ? <button type="button" onClick={() => { setError(false); setRateLimited(false); setLoading(true); setRetry(value => value + 1); inputRef.current?.focus(); }} className="min-h-11 px-2 text-sm font-semibold text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Try again</button> : null}
          {!query.trim() && recentOptions.length ? <div className="flex items-center justify-between px-2 pt-2">
            <span className="text-xs font-semibold text-muted-foreground">Recent locations</span>
            <button type="button" aria-label="Clear recent locations" onClick={() => {
              setRecentIds([]); setRecentPlaces([]); setActiveIndex(-1); cacheRef.current.clear();
              try { localStorage.removeItem(RECENT_LOCATION_KEY); } catch { /* Storage may be disabled. */ }
              inputRef.current?.focus();
            }} className="min-h-11 px-2 text-xs text-muted-foreground hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Clear</button>
          </div> : null}
          {options.length ? (
            <ul id={`${idPrefix}-location-options`} role="listbox" aria-label="South African locations" aria-busy={loading} className="mt-1 max-h-64 overflow-y-auto">
              {options.map((location, index) => (
                <li key={location.id} role="presentation">
                  {!query.trim() && index === recentOptions.length ? <div role="presentation" className="px-2 pb-1 pt-2 text-xs font-semibold text-muted-foreground">Explore locations</div> : null}
                  <button
                    type="button"
                    id={`${idPrefix}-location-${index}`}
                    role="option"
                    aria-label={`${location.label}, ${location.secondaryLabel}`}
                    tabIndex={-1}
                    aria-selected={activeIndex === index}
                    onMouseEnter={() => setActiveIndex(index)}
                    onMouseDown={event => event.preventDefault()}
                    onClick={() => select(location)}
                    className={cn("flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-ink hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", activeIndex === index && "bg-muted")}
                  >
                    {recentOptionIds.has(location.id) ? <Clock3 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" /> : <MapPin className="size-4 shrink-0 text-forest" aria-hidden="true" />}
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium"><Highlight text={location.label} query={query} /></span>
                      {location.secondaryLabel ? <span className="block text-xs text-muted-foreground"><Highlight text={location.secondaryLabel} query={query} /></span> : null}
                    </span>
                    {selectedLocation === location.label ? <Check className="size-4 shrink-0 text-forest" aria-hidden="true" /> : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <p className="px-2 pb-1 pt-2 text-xs text-muted-foreground">South Africa · Places from <a href="https://www.geonames.org/" target="_blank" rel="noreferrer" className="underline">GeoNames</a> and <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline">OpenStreetMap</a>.</p>
          <a href="/data/south-africa-places.html" target="_blank" rel="noreferrer" className="block px-2 pb-1 text-xs text-muted-foreground underline">Data &amp; coverage</a>
          {usesCatalogue ? <p className="px-2 pb-1 text-xs text-muted-foreground">Recent choices saved on this device.</p> : null}
        </div>
      ) : null}
    </div>
  );
}
