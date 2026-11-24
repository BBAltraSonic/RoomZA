"use client";

import { History, MessageSquare, MessageSquarePlus, Scale, X } from "lucide-react";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";

import { requestOpenContact } from "@/features/showings/open-contact";
import { cn } from "@/lib/utils";

import { CompareView, ListingFactCard, RelaxSuggestionCard, SaveAndAlert, chipButton } from "./assistant-templates";
import { newMatchesLine, pikoLine, pikoMood } from "@/features/piko/lines";
import { PikoTipNote } from "@/features/piko/tips-context";

import { type NewThreadEntry, type NoteKey, type ThreadEntry } from "./chat-thread";
import {
  ChatActionButton,
  ChatWindow,
  CurrentSearch,
  HeaderButton,
  PersonMessage,
  PinpointMessage,
  SearchMessage,
  WelcomeCard,
  useChatThread,
  type SuggestedReply,
} from "./chat-window";
import { MAX_COMPARE, toggleCompare } from "./compare";
import { answerListingFact, isListingQuestion, LISTING_QUESTIONS, matchFactTopic, type FactListing, type FactTopic } from "./listing-facts";
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
  /** Counts homes matching a remembered search listed after `since` (welcome back). Null if it can't. */
  countNewMatches?: (query: string, since: string) => Promise<number | null>;
  /** Piko's tip for the open listing (piko/tips.ts), shown when the chat opens on it. */
  openTip?: string | null;
  /** The map area and filters for "Tell me when one comes up" (existing search alerts). */
  alertBounds?: { west: number; south: number; east: number; north: number } | null;
  alertFilters?: Record<string, unknown> | null;
};

type ServerAnswer = {
  query: string;
  gaps: SearchGap[];
  source: "rules" | "ai";
  notEnglish: boolean;
  notice?: "allowance_used" | "busy" | "ai_unavailable";
  remaining?: number;
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

/** One thread per visit for homes, shared by rent and buy. */
const THREAD_SCOPE = "homes";

function summary(query: string) {
  return chipsFromParams(new URLSearchParams(query)).map(chipLabel).join(" · ");
}

function searchEntry(params: ReadonlyParams, gaps: readonly SearchGap[]): NewThreadEntry {
  return { from: "pinpoint", kind: "search", chips: chipsFromParams(params).map(chipLabel), gaps: [...gaps] };
}

function note(key: NoteKey): NewThreadEntry {
  return { from: "pinpoint", kind: "note", note: key };
}

function lastIndexWhere<T>(items: readonly T[], test: (item: T) => boolean) {
  for (let index = items.length - 1; index >= 0; index -= 1) if (test(items[index]!)) return index;
  return -1;
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
  countNewMatches,
  openTip,
  alertBounds,
  alertFilters,
}: AssistantPanelProps) {
  const requestRef = useRef(0);
  const { entries, append, clear } = useChatThread(THREAD_SCOPE);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [view, setView] = useState<"chat" | "memory">("chat");
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const { memory, home: memoryHome, update: updateMemory, forgetAll } = useAssistantMemory();
  // Preferences the person removed from this visit's search stay off until they add them back.
  const [skippedPreferences, setSkippedPreferences] = useState<ReadonlySet<string>>(() => new Set());

  const chips = useMemo(() => chipsFromParams(searchParams), [searchParams]);
  const offer = useMemo(() => preferenceOffer(memory, searchParams), [memory, searchParams]);
  const welcomeBack = !chips.length && !entries.length ? memory.recent[0] : undefined;

  function apply(params: URLSearchParams, { remember = true, replace = false } = {}) {
    onSearchChange(params, { replace });
    if (remember) updateMemory(recordSearch(memory, params));
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
    apply(applyChipsToParams(searchParams, removeChip(chips, id)));
  }

  /** A tapped reply reads as the person's message, then Pinpoint says what it searched for. */
  function searchFromReply(label: string, added: SearchChip[]) {
    const next = applyChipsToParams(searchParams, mergeChips(chips, added));
    apply(next);
    append({ from: "person", text: label }, searchEntry(next, []));
  }

  function askListing(listing: FactListing, question: string, topic: FactTopic | null) {
    append(
      { from: "person", text: question },
      {
        from: "pinpoint",
        kind: "fact",
        listing: { id: listing.id, title: listing.title, listing_type: listing.listing_type },
        question,
        answer: topic ? answerListingFact(listing, topic) : { known: false },
      },
    );
  }

  async function handleSubmit() {
    const typed = stripContactDetails(text);
    if (!typed) return;
    const request = ++requestRef.current;
    setText("");
    setProblem(null);
    const said: NewThreadEntry = { from: "person", text: typed };
    // A question about the open listing is answered from its fields. No AI, no new search.
    if (openListing && isListingQuestion(typed)) {
      askListing(openListing, typed, matchFactTopic(typed));
      return;
    }
    const local = parseSearchText(typed, chips);
    if (local.notEnglish) {
      append(said, note("english_only"));
      return;
    }
    // Apply what the rules understood straight away; the map moves with it.
    const before = searchParams.toString();
    const ruled = applyChipsToParams(searchParams, withPreferences(local.chips));
    apply(ruled);
    if (!local.needsAi) {
      append(said, local.chips.length || local.gaps.length ? searchEntry(ruled, local.gaps) : note("not_understood"));
      return;
    }

    append(said);
    setBusy(true);
    const fallback = () => append(searchEntry(ruled, local.gaps), note("ai_unavailable"));
    try {
      const response = await fetch("/api/assistant/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: typed, current: before, deviceId: getDeviceId() }),
      });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; data?: ServerAnswer } | null;
      if (request !== requestRef.current) return;
      if (!response.ok || !payload?.ok || !payload.data) {
        fallback();
        return;
      }
      const answer = payload.data;
      if (answer.notEnglish) {
        append(note("english_only"));
        return;
      }
      const answered = new URLSearchParams(answer.query);
      const final = applyChipsToParams(answered, withPreferences(chipsFromParams(answered)));
      apply(final, { replace: true });
      append(searchEntry(final, answer.gaps), ...(answer.notice ? [note(answer.notice)] : []));
    } catch {
      if (request === requestRef.current) fallback();
    } finally {
      if (request === requestRef.current) setBusy(false);
    }
  }

  function handleStarter(starter: Starter) {
    if ("prefill" in starter) setText(starter.prefill);
    else searchFromReply(starter.label, starter.chips);
  }

  function startCompare() {
    const titles = compareIds.map((id) => topPicks.find((listing) => listing.id === id)?.title).filter(Boolean).join(" and ");
    append({ from: "person", text: titles ? `Compare ${titles}` : "Compare these" }, { from: "pinpoint", kind: "compare", ids: compareIds, mode: listingMode });
    setCompareIds([]);
  }

  function resume(query: string) {
    const params = resumeQuery(searchParams, query);
    apply(params, { remember: false });
    append({ from: "person", text: "Resume my last search" }, searchEntry(params, []));
  }

  if (!open) return null;

  const starters = listingMode === "buy" ? BUY_STARTERS : RENT_STARTERS;
  const quickFilters = QUICK_FILTERS.filter((filter) => listingMode === "rent" || !filter.rentOnly);
  const replies: SuggestedReply[] = openListing
    ? LISTING_QUESTIONS.map((question) => ({ key: question.label, label: question.label, onSelect: () => askListing(openListing, question.label, question.topic) }))
    : chips.length
    ? quickFilters
        .filter(({ chip }) => !chips.some((existing) => chipId(existing) === chipId(chip)))
        .map(({ chip }) => ({ key: chip.value, label: chipLabel(chip), onSelect: () => searchFromReply(chipLabel(chip), [chip]) }))
    : starters.map((starter) => ({ key: starter.label, label: starter.label, onSelect: () => handleStarter(starter) }));
  const party = openListing?.listing_type === "sale" ? "seller" : "landlord";
  // The live results sit under the latest "Searching for" message, or at the end when the
  // search came from the address rather than the chat.
  const lastSearch = lastIndexWhere(entries, (entry) => entry.kind === "search");
  const results = chips.length ? (
    <LiveResults
      key="results"
      searchParams={searchParams}
      listingMode={listingMode}
      chips={chips}
      resultCount={resultCount}
      isLoading={isLoading}
      topPicks={topPicks}
      onOpenListing={onOpenListing}
      countMatches={countMatches}
      onApply={(params) => apply(params)}
      compareIds={compareIds}
      onToggleCompare={(id) => setCompareIds((current) => toggleCompare(current, id))}
      onClearCompare={() => setCompareIds([])}
      onCompare={startCompare}
      saved={isSaved(memory, searchParams)}
      onToggleSave={() => updateMemory(isSaved(memory, searchParams) ? unsaveSearch(memory, searchQuery(searchParams)) : saveSearch(memory, searchParams))}
      alertBounds={alertBounds}
      alertFilters={alertFilters}
      offer={offer}
      onRememberOffer={(chip) => updateMemory(rememberPreference(memory, chip))}
      onDeclineOffer={(chip) => updateMemory(declinePreference(memory, chip))}
    />
  ) : null;

  return (
    <ChatWindow
      subtitle={openListing ? openListing.title : listingMode === "buy" ? "Homes for sale" : "Homes to rent"}
      onClose={onClose}
      headerActions={
        <>
          {entries.length && view === "chat" ? (
            <HeaderButton label="New chat" icon={<MessageSquarePlus className="size-4" aria-hidden="true" />} onClick={() => { clear(); setCompareIds([]); }} />
          ) : null}
          <HeaderButton
            label="What I remember"
            icon={<History className="size-4" aria-hidden="true" />}
            pressed={view === "memory"}
            onClick={() => setView(view === "memory" ? "chat" : "memory")}
          />
        </>
      }
      pinned={<CurrentSearch chips={chips.map((chip) => ({ id: chipId(chip), label: chipLabel(chip), remove: () => handleRemove(chip) }))} />}
      screen={
        view === "memory" ? (
          <MemoryView
            memory={memory}
            home={memoryHome}
            onResume={(query) => {
              resume(query);
              setView("chat");
            }}
            onForgetSearch={(query) => updateMemory(forgetSearch(memory, query))}
            onUnsave={(query) => updateMemory(unsaveSearch(memory, query))}
            onForgetPreference={(id) => updateMemory(forgetPreference(memory, id))}
            onForgetEverything={forgetAll}
          />
        ) : undefined
      }
      replies={replies}
      actions={
        openListing ? (
          <ChatActionButton
            icon={<MessageSquare className="size-4" aria-hidden="true" />}
            label={party === "seller" ? "Message the seller" : "Message landlord"}
            onClick={() => requestOpenContact(openListing.id)}
          />
        ) : undefined
      }
      busy={busy}
      problem={problem}
      onProblem={setProblem}
      value={text}
      onValueChange={setText}
      onSubmit={() => void handleSubmit()}
      placeholder={openListing ? "Ask about this place, or search again" : listingMode === "buy" ? "3-bed house under R1.5m in Bellville" : "Furnished room under R4,000 near UWC"}
      scrollKey={`${entries.at(-1)?.id ?? "start"}:${view}`}
    >
      {openListing ? (
        <>
          <WelcomeCard title="Ask about this place">Answers come from the listing. Anything it doesn&apos;t say goes to the {party}.</WelcomeCard>
          {openTip ? <PikoTipNote tip={openTip} className="self-start" /> : null}
        </>
      ) : (
        <WelcomeCard title={listingMode === "buy" ? "Find a home to buy" : "Find a place to rent"}>
          Tell me what you&apos;re looking for, or tap a suggestion. The map and results follow your search.
          {welcomeBack ? (
            <span className="mt-3 block rounded-xl border border-border/70 bg-background p-3 text-ink">
              <WelcomeBackLine query={welcomeBack.query} since={welcomeBack.at} countNewMatches={countNewMatches} />
              <span className="mt-0.5 block text-sm text-muted-foreground">{summary(welcomeBack.query)}</span>
              <button type="button" onClick={() => resume(welcomeBack.query)} className={cn(chipButton, "mt-2 border-primary bg-primary text-primary-foreground")}>
                Resume
              </button>
            </span>
          ) : null}
        </WelcomeCard>
      )}
      {entries.map((entry, index) => (
        <Fragment key={entry.id}>
          <ThreadMessage entry={entry} onOpenListing={onOpenListing} />
          {index === lastSearch ? results : null}
        </Fragment>
      ))}
      {lastSearch === -1 ? results : null}
    </ChatWindow>
  );
}

function ThreadMessage({ entry, onOpenListing }: { entry: ThreadEntry; onOpenListing: (id: string) => void }) {
  switch (entry.kind) {
    case "message":
      return <PersonMessage>{entry.text}</PersonMessage>;
    case "search":
      return <SearchMessage chips={entry.chips} gaps={entry.gaps} version={entry.v} />;
    case "note":
      return <PinpointMessage mood={pikoMood(entry.note)}><p>{pikoLine(entry.note, entry.v)}</p></PinpointMessage>;
    case "fact":
      return (
        <PinpointMessage mood={entry.answer.known ? "done" : "thinking"} className="max-w-full p-0">
          <ListingFactCard listing={entry.listing} question={entry.question} answer={entry.answer} className="border-0 bg-transparent" />
        </PinpointMessage>
      );
    case "compare":
      return (
        <PinpointMessage className="max-w-full" mood={pikoMood("compare")}>
          <p>{pikoLine("compare")}</p>
          <CompareView ids={entry.ids} mode={entry.mode} onOpenListing={onOpenListing} className="mt-1" />
        </PinpointMessage>
      );
    case "item_fact":
      // Specials and services have their own chat; a home chat never stores these.
      return null;
  }
}

type LiveResultsProps = {
  searchParams: ReadonlyParams;
  listingMode: "rent" | "buy";
  chips: SearchChip[];
  resultCount?: number;
  isLoading?: boolean;
  topPicks: AssistantListing[];
  onOpenListing: (id: string) => void;
  countMatches?: (query: string) => Promise<number | null>;
  onApply: (params: URLSearchParams) => void;
  compareIds: string[];
  onToggleCompare: (id: string) => void;
  onClearCompare: () => void;
  onCompare: () => void;
  saved: boolean;
  onToggleSave: () => void;
  alertBounds?: AssistantPanelProps["alertBounds"];
  alertFilters?: AssistantPanelProps["alertFilters"];
  offer: SearchChip | null;
  onRememberOffer: (chip: SearchChip) => void;
  onDeclineOffer: (chip: SearchChip) => void;
};

/**
 * Templates "Top picks", "Relax suggestion", "Compare" (picking) and "Save and alert" for the
 * current search. They follow the live results, so updates inside aren't read out again.
 */
function LiveResults({
  searchParams,
  listingMode,
  chips,
  resultCount,
  isLoading,
  topPicks,
  onOpenListing,
  countMatches,
  onApply,
  compareIds,
  onToggleCompare,
  onClearCompare,
  onCompare,
  saved,
  onToggleSave,
  alertBounds,
  alertFilters,
  offer,
  onRememberOffer,
  onDeclineOffer,
}: LiveResultsProps) {
  return (
    <div aria-live="off" className="flex flex-col gap-3">
      <PinpointMessage className="max-w-full" mood={isLoading ? "searching" : resultCount === 0 ? "noResults" : "found"}>
        <section aria-label="Top picks">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {isLoading ? "Updating results…" : resultCount !== undefined ? `Top picks of ${resultCount} ${resultCount === 1 ? "home" : "homes"}` : "Top picks"}
          </h3>
          {!isLoading && resultCount !== undefined && countMatches ? (
            <RelaxSuggestionCard
              searchParams={new URLSearchParams(searchParams.toString())}
              resultCount={resultCount}
              mode={listingMode}
              countMatches={countMatches}
              onApply={onApply}
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
                      onClick={() => onToggleCompare(listing.id)}
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
                onClick={onCompare}
                className={cn(chipButton, "border-primary bg-primary text-primary-foreground disabled:opacity-50")}
              >
                Compare {compareIds.length}
              </button>
              <button type="button" onClick={onClearCompare} className={cn(chipButton, "border-border bg-panel text-ink")}>
                Clear
              </button>
              {compareIds.length < 2 ? <span className="text-xs text-muted-foreground">Pick one more to compare.</span> : null}
            </div>
          ) : null}
          <p className="mt-2 text-xs text-muted-foreground">The full list stays in the results.</p>
        </section>
        <SaveAndAlert saved={saved} onToggleSave={onToggleSave} alertBounds={alertBounds} alertFilters={alertFilters} />
      </PinpointMessage>

      {offer ? (
        <PinpointMessage mood="idea">
          <section aria-label="Remember this">
            <p>Remember that you need <strong>{chipLabel(offer)}</strong>?</p>
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={() => onRememberOffer(offer)} className={cn(chipButton, "border-primary bg-primary text-primary-foreground")}>
                Remember
              </button>
              <button type="button" onClick={() => onDeclineOffer(offer)} className={cn(chipButton, "border-border bg-panel text-ink")}>
                Not now
              </button>
            </div>
          </section>
        </PinpointMessage>
      ) : null}
    </div>
  );
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
    <section aria-label="What I remember">
      <p className="text-xs text-muted-foreground">{home === "account" ? "Kept in your account" : "Kept on this device only"} and never sent to the AI. Searches are saved as chips, not what you typed, and drop off after about 90 days. This chat itself is kept only until you close the tab.</p>
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

/**
 * "Welcome back. 3 new places match your last search." Counts homes listed since the person last
 * ran that search; shows the plain welcome back until the count is in, or when nothing is new.
 */
function WelcomeBackLine({ query, since, countNewMatches }: { query: string; since: string; countNewMatches?: (query: string, since: string) => Promise<number | null> }) {
  const key = `${since}|${query}`;
  const [counted, setCounted] = useState<{ key: string; count: number | null } | null>(null);

  useEffect(() => {
    if (!countNewMatches) return;
    let cancelled = false;
    countNewMatches(query, since)
      .then((count) => {
        if (!cancelled) setCounted({ key, count });
      })
      .catch(() => {
        if (!cancelled) setCounted({ key, count: null });
      });
    return () => {
      cancelled = true;
    };
  }, [countNewMatches, key, query, since]);

  return <span className="block text-sm font-semibold">{newMatchesLine(counted?.key === key ? counted.count : null)}</span>;
}
