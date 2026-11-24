"use client";

import { Bell, Bookmark, BookmarkCheck, Loader2, MessageSquare } from "lucide-react";
import { useEffect, useState } from "react";

import { EmptyStateCapture } from "@/features/map-discovery/empty-state-capture";
import { requestOpenContact } from "@/features/showings/open-contact";
import { cn } from "@/lib/utils";

import { compareRows } from "./compare";
import { ITEM_NOUN, type ItemKind } from "./item-facts";
import type { FactAnswer, FactListing } from "./listing-facts";
import { relaxSuggestion } from "./relax";

export const chipButton =
  "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const card = "rounded-2xl border border-border/70 bg-background p-3";

function rand(value: number) {
  return `R${Math.round(value).toLocaleString("en-US")}`;
}

/** Template "Listing fact": one answer with its source, or Ask landlord. */
export function ListingFactCard({ listing, question, answer, onDismiss, className }: { listing: Pick<FactListing, "id" | "title" | "listing_type">; question: string; answer: FactAnswer; onDismiss?: () => void; className?: string }) {
  const party = listing.listing_type === "sale" ? "seller" : "landlord";
  return (
    <section aria-label="Listing fact" className={cn(card, className)}>
      <p className="text-xs text-muted-foreground">
        About <span className="font-semibold text-ink">{listing.title}</span>: “{question}”
      </p>
      {answer.known ? (
        <>
          <p className="mt-1 text-sm font-semibold">{answer.answer}</p>
          <p className="mt-1 text-xs text-muted-foreground">From the listing. Check anything important with the {party}.</p>
        </>
      ) : (
        <p className="mt-1 text-sm">The listing doesn&apos;t say. The {party} can tell you.</p>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" onClick={() => requestOpenContact(listing.id)} className={cn(chipButton, answer.known ? "border-border bg-panel text-ink" : "border-primary bg-primary text-primary-foreground")}>
          <MessageSquare className="size-4" aria-hidden="true" />
          Ask {party}
        </button>
        {onDismiss ? (
          <button type="button" onClick={onDismiss} className={cn(chipButton, "border-border bg-panel text-ink")}>
            Done
          </button>
        ) : null}
      </div>
    </section>
  );
}

/** Template "Item fact": one answer about a special, event, place or service, from its own fields. */
export function ItemFactCard({ item, question, answer, className }: { item: { title: string; kind: ItemKind; by: string }; question: string; answer: FactAnswer; className?: string }) {
  const noun = ITEM_NOUN[item.kind];
  return (
    <section aria-label="Item fact" className={cn(card, className)}>
      <p className="text-xs text-muted-foreground">
        About <span className="font-semibold text-ink">{item.title}</span>: “{question}”
      </p>
      {answer.known ? (
        <>
          <p className="mt-1 text-sm font-semibold">{answer.answer}</p>
          <p className="mt-1 text-xs text-muted-foreground">From the {noun}. Check anything important with {item.by}.</p>
        </>
      ) : (
        <p className="mt-1 text-sm">The {noun} doesn&apos;t say. {item.by} can tell you.</p>
      )}
    </section>
  );
}

type DetailState = { status: "loading" } | { status: "error" } | { status: "ready"; listings: FactListing[] };

/** Template "Compare": 2–3 listings side by side, loaded from Pinpoint, not the AI. */
export function CompareView({ ids, mode, onBack, onOpenListing, className }: { ids: readonly string[]; mode: "rent" | "buy"; onBack?: () => void; onOpenListing: (id: string) => void; className?: string }) {
  const [state, setState] = useState<DetailState>({ status: "loading" });
  const key = ids.join(",");

  useEffect(() => {
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]);
    Promise.all(
      key.split(",").map(async (id) => {
        const response = await fetch(`/api/listings/${id}${mode === "buy" ? "?mode=buy" : ""}`, { signal });
        const payload = (await response.json().catch(() => null)) as { ok?: boolean; data?: FactListing } | null;
        if (!response.ok || !payload?.ok || payload.data?.id !== id) throw new Error("Listing unavailable");
        return payload.data;
      }),
    )
      .then((listings) => {
        if (!controller.signal.aborted) setState({ status: "ready", listings });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: "error" });
      });
    return () => controller.abort();
  }, [key, mode]);

  return (
    <section aria-label="Compare" className={className}>
      {onBack ? (
        <button type="button" onClick={onBack} className="min-h-11 rounded-full px-2 text-sm font-semibold text-forest hover:underline">
          ← Back to results
        </button>
      ) : null}
      {state.status === "loading" ? (
        <p role="status" className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> Loading listings…
        </p>
      ) : state.status === "error" ? (
        <p role="alert" className="mt-2 text-sm text-status-warning-text">These listings couldn&apos;t be loaded to compare. Try again.</p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <caption className="sr-only">Listings side by side</caption>
            <thead>
              <tr>
                <th scope="col" className="sr-only">Detail</th>
                {state.listings.map((listing) => (
                  <th key={listing.id} scope="col" className="min-w-28 px-2 pb-2 align-bottom">
                    <button type="button" onClick={() => onOpenListing(listing.id)} className="text-left font-semibold text-ink hover:text-forest hover:underline">
                      {listing.title}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {compareRows(state.listings).map((row) => (
                <tr key={row.label} className="border-t border-border/70">
                  <th scope="row" className="py-2 pr-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {row.label}
                  </th>
                  {row.values.map((value, index) => (
                    <td key={state.listings[index]!.id} className={cn("px-2 py-2", row.best.includes(index) && "font-semibold text-forest")}>
                      {value}
                      {row.best.includes(index) ? <span className="sr-only"> (best)</span> : null}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-muted-foreground">From each listing. “Not listed” means the listing doesn&apos;t say.</p>
        </div>
      )}
    </section>
  );
}

/** Template "Relax suggestion": "9 more if you go to R4,500 [Yes]". */
export function RelaxSuggestionCard({
  searchParams,
  resultCount,
  mode,
  countMatches,
  onApply,
}: {
  searchParams: URLSearchParams;
  resultCount: number;
  mode: "rent" | "buy";
  countMatches: (query: string) => Promise<number | null>;
  onApply: (params: URLSearchParams) => void;
}) {
  const suggestion = relaxSuggestion(searchParams, resultCount, mode);
  const query = suggestion?.query ?? "";
  const [counted, setCounted] = useState<{ query: string; count: number | null } | null>(null);

  useEffect(() => {
    if (!query) return;
    let cancelled = false;
    countMatches(query)
      .then((count) => {
        if (!cancelled) setCounted({ query, count });
      })
      .catch(() => {
        if (!cancelled) setCounted({ query, count: null });
      });
    return () => {
      cancelled = true;
    };
  }, [countMatches, query]);

  if (!suggestion || counted?.query !== query || counted.count === null) return null;
  const more = counted.count - resultCount;
  if (more <= 0) return null;
  return (
    <section aria-label="Relax suggestion" className={cn(card, "mt-2 flex items-center gap-3")}>
      <p className="min-w-0 flex-1 text-sm">
        <strong>{more}</strong> more if you go to <strong>{rand(suggestion.maxPrice)}</strong>
      </p>
      <button type="button" onClick={() => onApply(new URLSearchParams(suggestion.query))} className={cn(chipButton, "border-primary bg-primary text-primary-foreground")}>
        Yes
      </button>
    </section>
  );
}

/** Template "Save and alert": save the search, or get told when one comes up. */
export function SaveAndAlert({
  saved,
  onToggleSave,
  alertBounds,
  alertFilters,
}: {
  saved: boolean;
  onToggleSave: () => void;
  alertBounds?: { west: number; south: number; east: number; north: number } | null;
  alertFilters?: Record<string, unknown> | null;
}) {
  const [alertOpen, setAlertOpen] = useState(false);
  return (
    <section aria-label="Save and alert" className="mt-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" aria-pressed={saved} onClick={onToggleSave} className={cn(chipButton, saved ? "border-transparent bg-selection text-selection-foreground" : "border-border bg-background text-ink hover:border-forest/40")}>
          {saved ? <BookmarkCheck className="size-4" aria-hidden="true" /> : <Bookmark className="size-4" aria-hidden="true" />}
          {saved ? "Saved" : "Save search"}
        </button>
        {alertBounds ? (
          <button type="button" aria-expanded={alertOpen} onClick={() => setAlertOpen((open) => !open)} className={cn(chipButton, "border-border bg-background text-ink hover:border-forest/40")}>
            <Bell className="size-4" aria-hidden="true" />
            Tell me when one comes up
          </button>
        ) : null}
      </div>
      {alertOpen && alertBounds ? (
        <div className="mt-2">
          <EmptyStateCapture bbox={alertBounds} filters={alertFilters ?? null} compact />
        </div>
      ) : null}
    </section>
  );
}
