"use client";

import { MessageSquarePlus } from "lucide-react";

import { cn } from "@/lib/utils";
import { Fragment, useEffect, useState, type ReactNode } from "react";

import { sectionQuickLabel, SECTION_QUICK_FILTERS, toggleSectionQuick, type SectionQuickKey } from "@/features/discovery/section-quick-filters";
import type { ViewportCategory } from "@/features/discovery/viewport-contract";

import { pikoLine, pikoMood } from "@/features/piko/lines";
import { PikoTipNote } from "@/features/piko/tips-context";

import { chipButton, ItemFactCard } from "./assistant-templates";
import { type NewThreadEntry, type ThreadEntry } from "./chat-thread";
import { ChatWindow, CurrentSearch, HeaderButton, PersonMessage, PinpointMessage, SearchMessage, WelcomeCard, useChatThread, type SuggestedReply } from "./chat-window";
import { ITEM_NOUN, ITEM_QUESTIONS, answerItemFact, isItemQuestion, itemSummary, matchItemTopic, type ItemTopic, type PikoItem } from "./item-facts";
import { stripContactDetails } from "./privacy";
import { pickSectionRescue, sectionRescueCandidates, type SectionRescue } from "./section-rescue";
import { applySectionSearch, parseSectionText, readSectionSearch, SECTION_STARTERS, type SectionSearch } from "./section-intent";

const SECTION_TITLES: Record<ViewportCategory, string> = { shopping: "Specials", tourism: "Places", event: "Events", service: "Services" };
const SECTION_WELCOME: Record<ViewportCategory, string> = {
  shopping: "Find specials",
  tourism: "Find places to go",
  event: "Find events",
  service: "Find a service",
};
const PLACEHOLDERS: Record<ViewportCategory, string> = {
  shopping: "Food deals ending today",
  tourism: "New places near me",
  event: "Free live music tonight",
  service: "Plumber open now",
};

type UnderstoodChip = { id: string; label: string; remove: () => void };

function understoodChips(search: SectionSearch, go: (next: SectionSearch) => void): UnderstoodChip[] {
  return [
    ...(search.serviceType ? [{ id: "type", label: search.serviceType, remove: () => go({ ...search, serviceType: undefined }) }] : []),
    ...(search.text ? [{ id: "text", label: `“${search.text}”`, remove: () => go({ ...search, text: "" }) }] : []),
    ...(search.nearest ? [{ id: "nearest", label: "Nearest first", remove: () => go({ ...search, nearest: false }) }] : []),
    ...search.quick.map((key) => ({ id: key, label: sectionQuickLabel(key), remove: () => go({ ...search, quick: search.quick.filter((value) => value !== key) }) })),
  ];
}

/**
 * The assistant on the Specials, Places, Events and Services sections, as a chat. It writes the
 * same address the section's search box, sorts and quick filters already use, so the map, pins
 * and results follow, and Back undoes it. Each section keeps its own chat for the visit.
 *
 * With an item open ("Ask Piko" on a special, event, place or service), Piko offers that item's
 * preset questions and answers them from its own fields. Anything that isn't a question about
 * the item is still a search.
 *
 * Under the latest search Piko shows how many match and the top results as cards, which open
 * the item (the same order as the results list). When nothing matches, Piko offers the one
 * change that finds the most (section-rescue.ts), counted by `countMatches`.
 */
export function SectionAssistantPanel({
  category,
  onClose,
  resultCount,
  openItem,
  topPicks = [],
  onOpenItem,
  countMatches,
  openItemTip,
}: {
  category: ViewportCategory;
  onClose: () => void;
  resultCount?: number;
  openItem?: PikoItem | null;
  topPicks?: readonly PikoItem[];
  onOpenItem?: (id: string) => void;
  countMatches?: (search: SectionSearch) => Promise<number | null>;
  /** Piko's tip for the open item (piko/tips.ts), shown when the chat opens on it. */
  openItemTip?: string | null;
}) {
  const { entries, append, clear } = useChatThread(`section-${category}`);
  const [text, setText] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [, rerender] = useState(0);

  useEffect(() => {
    const update = () => rerender((value) => value + 1);
    window.addEventListener("popstate", update);
    window.addEventListener("pinpoint:discovery-controls", update);
    return () => {
      window.removeEventListener("popstate", update);
      window.removeEventListener("pinpoint:discovery-controls", update);
    };
  }, []);

  if (typeof window === "undefined") return null;
  const current = readSectionSearch(new URLSearchParams(window.location.search), category);

  function go(search: SectionSearch, kind?: "event") {
    const url = new URL(window.location.href);
    const next = applySectionSearch(url.searchParams, search);
    if (kind) next.set("kind", kind);
    url.search = next.toString();
    window.history.pushState(null, "", url);
  }

  /** Applies a search and says in the chat what was searched for. */
  function searchFor(said: string, search: SectionSearch, kind?: "event") {
    go(search, kind);
    const searched: NewThreadEntry = { from: "pinpoint", kind: "search", chips: understoodChips(search, go).map((chip) => chip.label), gaps: [] };
    append({ from: "person", text: said }, searched);
  }

  /** Answers a question about the open item from its own fields. The search stays as it is. */
  function askItem(item: PikoItem, question: string, topic: ItemTopic | null) {
    append(
      { from: "person", text: question },
      {
        from: "pinpoint",
        kind: "item_fact",
        item: { id: item.id, title: item.title, kind: item.kind, by: item.by },
        question,
        answer: topic ? answerItemFact(item, topic) : { known: false },
      },
    );
  }

  function handleSubmit() {
    const typed = stripContactDetails(text);
    if (!typed) return;
    setText("");
    setProblem(null);
    if (openItem && isItemQuestion(typed)) {
      askItem(openItem, typed, matchItemTopic(typed));
      return;
    }
    const parsed = parseSectionText(typed, category);
    const understood = parsed.serviceType || parsed.text || parsed.nearest || parsed.quick.length;
    if (!understood) {
      append({ from: "person", text: typed }, { from: "pinpoint", kind: "note", note: "not_understood" });
      return;
    }
    searchFor(typed, {
      ...parsed,
      serviceType: parsed.serviceType ?? current.serviceType,
      quick: [...new Set([...current.quick, ...parsed.quick])],
      nearest: parsed.nearest || current.nearest,
    });
  }

  const chips = understoodChips(current, go);
  const replies: SuggestedReply[] = openItem
    ? ITEM_QUESTIONS[openItem.kind].map((question) => ({ key: question.label, label: question.label, onSelect: () => askItem(openItem, question.label, question.topic) }))
    : chips.length
    ? SECTION_QUICK_FILTERS[category]
        .filter((key) => !current.quick.includes(key))
        .map((key: SectionQuickKey) => ({
          key,
          label: sectionQuickLabel(key),
          onSelect: () => searchFor(sectionQuickLabel(key), { ...current, quick: toggleSectionQuick(current.quick, key) }),
        }))
    : SECTION_STARTERS[category].map((starter) => ({ key: starter.label, label: starter.label, onSelect: () => searchFor(starter.label, starter.search, starter.kind) }));

  // The live results sit under the latest "Searching for" message, or at the end when the search
  // came from the section's own controls rather than the chat.
  let lastSearch = -1;
  entries.forEach((entry, index) => {
    if (entry.kind === "search") lastSearch = index;
  });
  const results =
    resultCount !== undefined ? (
      <SectionResults
        key="results"
        resultCount={resultCount}
        picks={openItem ? [] : topPicks}
        onOpenItem={onOpenItem}
        rescue={
          resultCount === 0 && countMatches ? (
            <SectionRescueCard
              search={current}
              countMatches={countMatches}
              onApply={(next) => {
                go(next);
                append({ from: "pinpoint", kind: "search", chips: understoodChips(next, go).map((chip) => chip.label), gaps: [] });
              }}
            />
          ) : null
        }
      />
    ) : null;

  return (
    <ChatWindow
      subtitle={openItem ? openItem.title : SECTION_TITLES[category]}
      onClose={onClose}
      headerActions={entries.length ? <HeaderButton label="New chat" icon={<MessageSquarePlus className="size-4" aria-hidden="true" />} onClick={clear} /> : null}
      pinned={<CurrentSearch chips={chips} />}
      replies={replies}
      problem={problem}
      onProblem={setProblem}
      value={text}
      onValueChange={setText}
      onSubmit={handleSubmit}
      placeholder={PLACEHOLDERS[category]}
      maxLength={200}
      scrollKey={entries.at(-1)?.id ?? "start"}
    >
      {openItem ? (
        <>
          <WelcomeCard title={`Ask about this ${ITEM_NOUN[openItem.kind]}`}>
            Tap a question or type your own. Answers come from the {ITEM_NOUN[openItem.kind]} itself.
          </WelcomeCard>
          {openItemTip ? <PikoTipNote tip={openItemTip} className="self-start" /> : null}
        </>
      ) : (
        <WelcomeCard title={SECTION_WELCOME[category]}>Tell me what you&apos;re after, or tap a suggestion. The map and results follow your search.</WelcomeCard>
      )}
      {entries.map((entry, index) => (
        <Fragment key={entry.id}>
          <SectionThreadMessage entry={entry} />
          {index === lastSearch ? results : null}
        </Fragment>
      ))}
      {lastSearch === -1 ? results : null}
    </ChatWindow>
  );
}

function SectionThreadMessage({ entry }: { entry: ThreadEntry }) {
  switch (entry.kind) {
    case "message":
      return <PersonMessage>{entry.text}</PersonMessage>;
    case "search":
      return <SearchMessage chips={entry.chips} gaps={entry.gaps} version={entry.v} />;
    case "note":
      return <PinpointMessage mood={pikoMood(entry.note)}><p>{pikoLine(entry.note, entry.v)}</p></PinpointMessage>;
    case "item_fact":
      return (
        <PinpointMessage mood={entry.answer.known ? "done" : "thinking"} className="max-w-full p-0">
          <ItemFactCard item={entry.item} question={entry.question} answer={entry.answer} className="border-0 bg-transparent" />
        </PinpointMessage>
      );
    default:
      // Home facts and compares belong to the homes chat; a section chat never stores them.
      return null;
  }
}

const MAX_PICKS = 3;

/** How many match in the map area, and the top results as cards. Updates aren't read out again. */
function SectionResults({ resultCount, picks, onOpenItem, rescue }: { resultCount: number; picks: readonly PikoItem[]; onOpenItem?: (id: string) => void; rescue?: ReactNode }) {
  const shown = resultCount ? picks.slice(0, MAX_PICKS) : [];
  return (
    <div aria-live="off">
      <PinpointMessage className={shown.length ? "max-w-full" : undefined} mood={resultCount ? pikoMood("found") : pikoMood("nothing_found")}>
        <p role="status">
          {resultCount
            ? `${pikoLine("found")} ${resultCount} ${resultCount === 1 ? "match" : "matches"} in this map area.${shown.length ? "" : " The full list stays in the results."}`
            : pikoLine("nothing_found")}
        </p>
        {rescue}
        {shown.length ? (
          <section aria-label="Top picks" className="mt-2">
            <ul className="space-y-2">
              {shown.map((item) => {
                const summary = itemSummary(item);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => onOpenItem?.(item.id)}
                      className="w-full rounded-2xl border border-border/70 bg-background p-3 text-left transition-colors hover:border-forest/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="block text-sm font-semibold">{item.title}</span>
                      <span className="block text-xs text-muted-foreground">{item.by}</span>
                      {summary ? <span className="mt-1 block text-xs text-ink">{summary}</span> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">The full list stays in the results.</p>
          </section>
        ) : null}
      </PinpointMessage>
    </div>
  );
}

/**
 * "6 matches without Tonight [Apply]": the one change that finds the most. Counts every candidate
 * at once and shows nothing until they are in, or when none finds anything.
 */
function SectionRescueCard({ search, countMatches, onApply }: { search: SectionSearch; countMatches: (search: SectionSearch) => Promise<number | null>; onApply: (next: SectionSearch) => void }) {
  const key = JSON.stringify(search);
  const [found, setFound] = useState<{ key: string; rescue: SectionRescue | null } | null>(null);

  useEffect(() => {
    const candidates = sectionRescueCandidates(JSON.parse(key) as SectionSearch);
    if (!candidates.length) return;
    let cancelled = false;
    void Promise.all(candidates.map((candidate) => countMatches(candidate.next).catch(() => null))).then((counts) => {
      if (!cancelled) setFound({ key, rescue: pickSectionRescue(candidates, counts) });
    });
    return () => {
      cancelled = true;
    };
  }, [countMatches, key]);

  const rescue = found?.key === key ? found.rescue : null;
  if (!rescue) return null;
  return (
    <section aria-label="Try this" className="mt-2 flex items-center gap-3 rounded-2xl border border-border/70 bg-background p-3">
      <p className="min-w-0 flex-1 text-sm">
        <strong>{rescue.count}</strong> {rescue.count === 1 ? "match" : "matches"} without <strong>{rescue.without}</strong>.
      </p>
      <button type="button" onClick={() => onApply(rescue.next)} className={cn(chipButton, "border-primary bg-primary text-primary-foreground")}>
        Apply
      </button>
    </section>
  );
}
