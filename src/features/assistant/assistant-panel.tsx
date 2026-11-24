"use client";

import { ChevronDown, ChevronUp, History, Loader2, Scale, Search, Sparkles, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

import { CompareView, ListingFactCard, RelaxSuggestionCard, SaveAndAlert, chipButton } from "./assistant-templates";
import { MAX_COMPARE, toggleCompare } from "./compare";
import { answerListingFact, isListingQuestion, matchFactTopic, type FactAnswer, type FactListing } from "./listing-facts";
import {
  declinePreference,
  forgetPreference,
  forgetSearch,
  getDeviceId,
  isSaved,
  preferenceOffer,
  recordSearch,
  rememberPreference,
  resumeQuery,
  saveSearch,
  searchQuery,
  unsaveSearch,
  type AssistantMemory,
} from "./memory";
import { stripContactDetails } from "./privacy";
import {
  applyChipsToParams,
  chipId,
  chipLabel,
  chipsFromParams,
  mergeChips,
  parseSearchText,
  removeChip,
  type ReadonlyParams,
  type SearchChip,
  type SearchGap,
} from "./search-intent";
import { whyItMatches, type TopPickListing } from "./top-picks";
import { useAssistantMemory, type MemoryHome } from "./use-assistant-memory";

export type AssistantListing = TopPickListing & { id: string; title: string };

type AssistantPanelProps = {
  open: boolean;
  onClose: () => void;
  listingMode: "rent" | "buy";
  /** The current discovery address. The panel reads its chips from here. */
  searchParams: ReadonlyParams;
  /**
   * Called with the next discovery address. The page writes it to history; `replace` marks a
   * refinement of the search just made (the AI's answer), which shouldn't add a Back step.
   */
  onSearchChange: (params: URLSearchParams, options?: { replace?: boolean }) => void;
  resultCount?: number;
  isLoading?: boolean;
  topPicks: AssistantListing[];
  onOpenListing: (listingId: string) => void;
  /** The listing open beside the panel. Questions about it are answered from its own fields. */
  openListing?: FactListing | null;
  /** Counts matches for another search in the same map area (relax suggestion). Null if it can't. */
  countMatches?: (query: string) => Promise<number | null>;
  /** The map area and filters for "Tell me when one comes up" (existing search alerts). */
  alertBounds?: { west: number; south: number; east: number; north: number } | null;
  alertFilters?: Record<string, unknown> | null;
};

type SheetHeight = "peek" | "half" | "full";

type ServerAnswer = {
  query: string;
  gaps: SearchGap[];
  source: "rules" | "ai";
  notEnglish: boolean;
  notice?: "allowance_used" | "busy" | "ai_unavailable";
  remaining?: number;
};

const ENGLISH_ONLY = "I can only help in English for now. The chips below still work.";
const NOTICES: Record<NonNullable<ServerAnswer["notice"]>, string> = {
  allowance_used: "You've used today's AI searches. I used what I could understand, and the chips still work.",
  busy: "The assistant is busy right now. I used what I could understand; try again in a minute.",
  ai_unavailable: "I couldn't work out all of that. I used what I could understand.",
};

type Starter = { label: string } & ({ chips: SearchChip[] } | { prefill: string });

const RENT_STARTERS: Starter[] = [
  { label: "Rooms near campus", prefill: "Room near " },
  { label: "NSFAS approved", chips: [{ kind: "quick", value: "nsfas-approved" }] },
  { label: "Under R4,000", chips: [{ kind: "maxPrice", value: 4000 }] },
  { label: "Furnished", chips: [{ kind: "quick", value: "furnished" }] },
];

const BUY_STARTERS: Starter[] = [
  { label: "Houses", chips: [{ kind: "type", value: "house" }] },
  { label: "3+ bedrooms", chips: [{ kind: "beds", value: 3 }] },
  { label: "Under R1,500,000", chips: [{ kind: "maxPrice", value: 1_500_000 }] },
];

/** Fixed per section (proposal, "Quick filters"), never chosen by the AI. Several can be on at once. */
const QUICK_FILTERS: { chip: Extract<SearchChip, { kind: "quick" }>; rentOnly?: boolean }[] = [
  { chip: { kind: "quick", value: "nsfas-approved" }, rentOnly: true },
  { chip: { kind: "quick", value: "furnished" } },
  { chip: { kind: "quick", value: "recently-listed" } },
  { chip: { kind: "quick", value: "favourites" } },
  { chip: { kind: "quick", value: "recently-viewed" } },
];


function summary(query: string) {
  return chipsFromParams(new URLSearchParams(query)).map(chipLabel).join(" · ");
}

export function AssistantPanel({
  open,
  onClose,
  listingMode,
  searchParams,
  onSearchChange,
  resultCount,
  isLoading,
  topPicks,
  onOpenListing,
  openListing,
  countMatches,
  alertBounds,
  alertFilters,
}: AssistantPanelProps) {
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef(0);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [gaps, setGaps] = useState<SearchGap[]>([]);
  const [view, setView] = useState<"search" | "memory" | "compare">("search");
  const [fact, setFact] = useState<{ listingId: string; question: string; answer: FactAnswer } | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [height, setHeight] = useState<SheetHeight>("half");
  const { memory, home: memoryHome, update: updateMemory, forgetAll } = useAssistantMemory();
  // Preferences the person removed from this visit's search stay off until they add them back.
  const [skippedPreferences, setSkippedPreferences] = useState<ReadonlySet<string>>(() => new Set());

  const chips = useMemo(() => chipsFromParams(searchParams), [searchParams]);
  const offer = useMemo(() => preferenceOffer(memory, searchParams), [memory, searchParams]);
  const welcomeBack = !chips.length && view === "search" ? memory.recent[0] : undefined;

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function apply(params: URLSearchParams, { remember = true, replace = false } = {}) {
    onSearchChange(params, { replace });
    if (remember) updateMemory(recordSearch(memory, params));
  }

  function applyChips(next: SearchChip[]) {
    apply(applyChipsToParams(searchParams, next));
  }

  function withPreferences(next: SearchChip[]): SearchChip[] {
    const preferences = memory.preferences.filter((chip) => {
      if (skippedPreferences.has(chipId(chip))) return false;
      if (chip.kind === "type") return !next.some((existing) => existing.kind === "type");
      return !(chip.kind === "quick" && chip.value === "nsfas-approved" && next.some((existing) => existing.kind === "mode"));
    });
    return mergeChips(next, preferences);
  }

  function handleRemove(chip: SearchChip) {
    const id = chipId(chip);
    if (memory.preferences.some((preference) => chipId(preference) === id)) {
      setSkippedPreferences((current) => new Set([...current, id]));
    }
    applyChips(removeChip(chips, id));
  }

  function toggleQuick(chip: SearchChip) {
    const id = chipId(chip);
    if (chips.some((existing) => chipId(existing) === id)) handleRemove(chip);
    else applyChips(mergeChips(chips, [chip]));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const typed = stripContactDetails(text);
    if (!typed) return;
    const request = ++requestRef.current;
    setText("");
    setNotice(null);
    // A question about the open listing is answered from its fields. No AI, no new search.
    if (openListing && isListingQuestion(typed)) {
      const topic = matchFactTopic(typed);
      setFact({ listingId: openListing.id, question: typed, answer: topic ? answerListingFact(openListing, topic) : { known: false } });
      return;
    }
    setFact(null);
    const local = parseSearchText(typed, chips);
    if (local.notEnglish) {
      setNotice(ENGLISH_ONLY);
      return;
    }
    // Show what the rules understood straight away; the map moves with it.
    setGaps(local.gaps);
    const before = searchParams.toString();
    applyChips(withPreferences(local.chips));
    if (!local.needsAi) return;

    setBusy(true);
    try {
      const response = await fetch("/api/assistant/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: typed, current: before, deviceId: getDeviceId() }),
      });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; data?: ServerAnswer } | null;
      if (request !== requestRef.current) return;
      if (!response.ok || !payload?.ok || !payload.data) {
        setNotice(NOTICES.ai_unavailable);
        return;
      }
      const answer = payload.data;
      if (answer.notEnglish) {
        setNotice(ENGLISH_ONLY);
        return;
      }
      if (answer.notice) setNotice(NOTICES[answer.notice]);
      const answered = new URLSearchParams(answer.query);
      apply(applyChipsToParams(answered, withPreferences(chipsFromParams(answered))), { replace: true });
      setGaps(answer.gaps);
    } catch {
      if (request === requestRef.current) setNotice(NOTICES.ai_unavailable);
    } finally {
      if (request === requestRef.current) setBusy(false);
    }
  }

  function handleStarter(starter: Starter) {
    if ("prefill" in starter) {
      setText(starter.prefill);
      inputRef.current?.focus();
      return;
    }
    applyChips(mergeChips(chips, starter.chips));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
    }
  }

  if (!open || typeof document === "undefined") return null;

  const starters = listingMode === "buy" ? BUY_STARTERS : RENT_STARTERS;
  const quickFilters = QUICK_FILTERS.filter((filter) => listingMode === "rent" || !filter.rentOnly);
  const nextHeight: Record<SheetHeight, SheetHeight> = { peek: "half", half: "full", full: "peek" };

  const panel = (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      onKeyDown={handleKeyDown}
      data-height={height}
      className={cn(
        "fixed inset-x-0 bottom-[var(--app-mobile-nav-offset)] z-[55] flex flex-col overflow-hidden rounded-t-3xl border border-border/70 bg-panel text-ink shadow-[var(--elevation-3)]",
        height === "peek" && "h-[13rem]",
        height === "half" && "h-[58dvh]",
        height === "full" && "h-[calc(100dvh-var(--app-mobile-nav-offset)-3rem)]",
        "lg:inset-x-auto lg:bottom-4 lg:right-4 lg:top-[calc(var(--chrome-h)+1rem)] lg:h-auto lg:w-[26rem] lg:rounded-3xl",
      )}
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-border/70 px-4 py-2">
        <Sparkles className="size-4 text-brand-ink" aria-hidden="true" />
        <h2 id={titleId} className="min-w-0 flex-1 truncate text-base font-semibold">Pinpoint Assistant</h2>
        <button
          type="button"
          onClick={() => setHeight(nextHeight[height])}
          aria-label={height === "full" ? "Show less of the assistant" : "Show more of the assistant"}
          className="flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
        >
          {height === "full" ? <ChevronDown className="size-4" aria-hidden="true" /> : <ChevronUp className="size-4" aria-hidden="true" />}
        </button>
        <button
          type="button"
          onClick={() => setView(view === "memory" ? "search" : "memory")}
          aria-pressed={view === "memory"}
          className="flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <History className="size-4" aria-hidden="true" />
          <span className="sr-only sm:not-sr-only">What I remember</span>
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close assistant"
          className="flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 pt-3">
        <form role="search" onSubmit={handleSubmit} className="flex min-h-11 items-center gap-2 rounded-full border border-border/70 bg-background px-4 focus-within:border-forest focus-within:ring-1 focus-within:ring-forest">
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            ref={inputRef}
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={300}
            aria-label="What are you looking for?"
            placeholder={openListing ? "Ask about this place, or search again" : listingMode === "buy" ? "3-bed house under R1.5m in Bellville" : "Furnished room under R4,000 near UWC"}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            disabled={busy || !text.trim()}
            aria-label="Ask"
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {busy ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Sparkles className="size-4" aria-hidden="true" />}
          </button>
        </form>

        <p role="status" aria-live="polite" className={cn("mt-2 text-xs text-muted-foreground", !notice && !busy && "sr-only")}>
          {busy ? "Working out the rest of that…" : notice}
        </p>

        {view === "compare" && compareIds.length >= 2 ? (
          <CompareView
            ids={compareIds}
            mode={listingMode}
            onBack={() => setView("search")}
            onOpenListing={onOpenListing}
          />
        ) : view === "memory" ? (
          <MemoryView
            memory={memory}
            home={memoryHome}
            onResume={(query) => {
              apply(resumeQuery(searchParams, query), { remember: false });
              setView("search");
            }}
            onForgetSearch={(query) => updateMemory(forgetSearch(memory, query))}
            onUnsave={(query) => updateMemory(unsaveSearch(memory, query))}
            onForgetPreference={(id) => updateMemory(forgetPreference(memory, id))}
            onForgetEverything={forgetAll}
          />
        ) : (
          <>
            {fact && openListing?.id === fact.listingId ? (
              <ListingFactCard listing={openListing} question={fact.question} answer={fact.answer} onDismiss={() => setFact(null)} />
            ) : null}
            {welcomeBack ? (
              <section aria-label="Welcome back" className="mt-3 rounded-2xl border border-border/70 bg-background p-3">
                <p className="text-sm font-semibold">Welcome back</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{summary(welcomeBack.query)}</p>
                <button
                  type="button"
                  onClick={() => apply(resumeQuery(searchParams, welcomeBack.query), { remember: false })}
                  className={cn(chipButton, "mt-2 border-primary bg-primary text-primary-foreground")}
                >
                  Resume
                </button>
              </section>
            ) : null}

            {chips.length ? (
              <ul aria-label="Understood" className="mt-3 flex flex-wrap gap-2">
                {chips.map((chip) => (
                  <li key={chipId(chip)}>
                    <span className="inline-flex min-h-11 items-center gap-1 rounded-full bg-selection pl-3.5 text-sm font-semibold text-selection-foreground">
                      {chipLabel(chip)}
                      <button
                        type="button"
                        onClick={() => handleRemove(chip)}
                        aria-label={`Remove ${chipLabel(chip)}`}
                        className="flex size-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <X className="size-3.5" aria-hidden="true" />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <>
                <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Try asking</h3>
                <ul aria-label="Try asking" className="mt-2 flex flex-wrap gap-2">
                  {starters.map((starter) => (
                    <li key={starter.label}>
                      <button type="button" onClick={() => handleStarter(starter)} className={cn(chipButton, "border-border bg-background text-ink hover:border-forest/40")}>
                        {starter.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {gaps.length ? (
              <ul aria-label="Can't search yet" className="mt-2 flex flex-wrap gap-2">
                {gaps.map((gap) => (
                  <li key={gap.key}>
                    <span className="inline-flex min-h-11 items-center gap-1 rounded-full border border-dashed border-border pl-3.5 text-sm text-muted-foreground">
                      {gap.label}
                      <button
                        type="button"
                        onClick={() => setGaps((current) => current.filter((item) => item.key !== gap.key))}
                        aria-label={`Dismiss ${gap.label}`}
                        className="flex size-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <X className="size-3.5" aria-hidden="true" />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}

            {offer ? (
              <section aria-label="Remember this" className="mt-3 rounded-2xl border border-border/70 bg-background p-3">
                <p className="text-sm">Remember that you need <strong>{chipLabel(offer)}</strong>?</p>
                <div className="mt-2 flex gap-2">
                  <button type="button" onClick={() => updateMemory(rememberPreference(memory, offer))} className={cn(chipButton, "border-primary bg-primary text-primary-foreground")}>
                    Remember
                  </button>
                  <button type="button" onClick={() => updateMemory(declinePreference(memory, offer))} className={cn(chipButton, "border-border bg-panel text-ink")}>
                    Not now
                  </button>
                </div>
              </section>
            ) : null}

            <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quick filters</h3>
            <ul aria-label="Quick filters" className="mt-2 flex flex-wrap gap-2">
              {quickFilters.map(({ chip }) => {
                const active = chips.some((existing) => chipId(existing) === chipId(chip));
                return (
                  <li key={chip.value}>
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleQuick(chip)}
                      className={cn(chipButton, active ? "border-transparent bg-selection text-selection-foreground" : "border-border bg-background text-ink hover:border-forest/40")}
                    >
                      {chipLabel(chip)}
                    </button>
                  </li>
                );
              })}
            </ul>

            {chips.length ? (
              <SaveAndAlert
                saved={isSaved(memory, searchParams)}
                onToggleSave={() => updateMemory(isSaved(memory, searchParams) ? unsaveSearch(memory, searchQuery(searchParams)) : saveSearch(memory, searchParams))}
                alertBounds={alertBounds}
                alertFilters={alertFilters}
              />
            ) : null}

            {chips.length ? (
              <section aria-label="Top picks" className="mt-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {isLoading ? "Updating results…" : resultCount !== undefined ? `Top picks of ${resultCount} ${resultCount === 1 ? "home" : "homes"}` : "Top picks"}
                </h3>
                {!isLoading && resultCount !== undefined && countMatches ? (
                  <RelaxSuggestionCard
                    searchParams={new URLSearchParams(searchParams.toString())}
                    resultCount={resultCount}
                    mode={listingMode}
                    countMatches={countMatches}
                    onApply={(params) => apply(params)}
                  />
                ) : null}
                {topPicks.length ? (
                  <ul className="mt-2 space-y-2">
                    {topPicks.slice(0, 3).map((listing) => {
                      const why = whyItMatches(listing, chips);
                      const comparing = compareIds.includes(listing.id);
                      return (
                        <li key={listing.id} className="flex items-stretch gap-2">
                          <button
                            type="button"
                            onClick={() => onOpenListing(listing.id)}
                            className="min-w-0 flex-1 rounded-2xl border border-border/70 bg-background p-3 text-left transition-colors hover:border-forest/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <span className="block text-sm font-semibold">{listing.title}</span>
                            <span className="block text-xs text-muted-foreground">{listing.area}</span>
                            {why ? <span className="mt-1 block text-xs text-ink">{why}</span> : null}
                          </button>
                          <button
                            type="button"
                            aria-pressed={comparing}
                            disabled={!comparing && compareIds.length >= MAX_COMPARE}
                            onClick={() => setCompareIds((current) => toggleCompare(current, listing.id))}
                            aria-label={`Compare ${listing.title}`}
                            className={cn(
                              "flex w-12 shrink-0 items-center justify-center rounded-2xl border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40",
                              comparing ? "border-transparent bg-selection text-selection-foreground" : "border-border/70 bg-background text-muted-foreground hover:text-ink",
                            )}
                          >
                            <Scale className="size-4" aria-hidden="true" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : !isLoading ? (
                  <p className="mt-2 text-sm text-muted-foreground">Nothing matches in this map area yet. Try removing a chip or moving the map.</p>
                ) : null}
                {compareIds.length ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={compareIds.length < 2}
                      onClick={() => setView("compare")}
                      className={cn(chipButton, "border-primary bg-primary text-primary-foreground disabled:opacity-50")}
                    >
                      Compare {compareIds.length}
                    </button>
                    <button type="button" onClick={() => setCompareIds([])} className={cn(chipButton, "border-border bg-panel text-ink")}>
                      Clear
                    </button>
                    {compareIds.length < 2 ? <span className="text-xs text-muted-foreground">Pick one more to compare.</span> : null}
                  </div>
                ) : null}
                <p className="mt-2 text-xs text-muted-foreground">The full list stays in the results.</p>
              </section>
            ) : null}
          </>
        )}
      </div>
    </div>
  );

  return createPortal(panel, document.body);
}

function MemoryView({
  memory,
  home,
  onResume,
  onForgetSearch,
  onUnsave,
  onForgetPreference,
  onForgetEverything,
}: {
  memory: AssistantMemory;
  home: MemoryHome;
  onResume: (query: string) => void;
  onForgetSearch: (query: string) => void;
  onUnsave: (query: string) => void;
  onForgetPreference: (id: string) => void;
  onForgetEverything: () => void;
}) {
  const empty = !memory.recent.length && !memory.preferences.length && !memory.saved.length;
  return (
    <section aria-label="What I remember" className="mt-3">
      <p className="text-xs text-muted-foreground">{home === "account" ? "Kept in your account" : "Kept on this device only"} and never sent to the AI. Searches are saved as chips, not what you typed, and drop off after about 90 days.</p>
      {empty ? <p className="mt-3 text-sm text-muted-foreground">Nothing remembered yet.</p> : null}
      {memory.preferences.length ? (
        <>
          <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Preferences</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {memory.preferences.map((chip) => (
              <li key={chipId(chip)}>
                <span className="inline-flex min-h-11 items-center gap-1 rounded-full border border-border pl-3.5 text-sm font-semibold">
                  {chipLabel(chip)}
                  <button type="button" onClick={() => onForgetPreference(chipId(chip))} aria-label={`Forget ${chipLabel(chip)}`} className="flex size-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <X className="size-3.5" aria-hidden="true" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {memory.saved.length ? (
        <>
          <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Saved searches</h3>
          <ul className="mt-2 space-y-2">
            {memory.saved.map((entry) => (
              <li key={entry.query} className="flex items-center gap-2 rounded-2xl border border-border/70 bg-background p-2 pl-3">
                <span className="min-w-0 flex-1 text-sm">{summary(entry.query)}</span>
                <button type="button" onClick={() => onResume(entry.query)} className="min-h-11 rounded-full px-3 text-sm font-semibold text-forest hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  Resume
                </button>
                <button type="button" onClick={() => onUnsave(entry.query)} aria-label={`Remove saved search ${summary(entry.query)}`} className="flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {memory.recent.length ? (
        <>
          <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recent searches</h3>
          <ul className="mt-2 space-y-2">
            {memory.recent.map((entry) => (
              <li key={entry.query} className="flex items-center gap-2 rounded-2xl border border-border/70 bg-background p-2 pl-3">
                <span className="min-w-0 flex-1 text-sm">{summary(entry.query)}</span>
                <button type="button" onClick={() => onResume(entry.query)} className="min-h-11 rounded-full px-3 text-sm font-semibold text-forest hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  Resume
                </button>
                <button type="button" onClick={() => onForgetSearch(entry.query)} aria-label={`Forget ${summary(entry.query)}`} className="flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {!empty ? (
        <button type="button" onClick={onForgetEverything} className="mt-4 min-h-11 rounded-full border border-border px-4 text-sm font-semibold text-ink hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Forget everything
        </button>
      ) : null}
    </section>
  );
}
