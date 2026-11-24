"use client";

import { MessageSquarePlus } from "lucide-react";
import { useEffect, useState } from "react";

import { sectionQuickLabel, SECTION_QUICK_FILTERS, toggleSectionQuick, type SectionQuickKey } from "@/features/discovery/section-quick-filters";
import type { ViewportCategory } from "@/features/discovery/viewport-contract";

import { ChatWindow, CurrentSearch, HeaderButton, PersonMessage, PinpointMessage, SearchMessage, WelcomeCard, useChatThread, type SuggestedReply } from "./chat-window";
import { NOTE_TEXT, type NewThreadEntry } from "./chat-thread";
import { stripContactDetails } from "./privacy";
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
 */
export function SectionAssistantPanel({ category, onClose, resultCount }: { category: ViewportCategory; onClose: () => void; resultCount?: number }) {
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

  function handleSubmit() {
    const typed = stripContactDetails(text);
    if (!typed) return;
    setText("");
    setProblem(null);
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
  const replies: SuggestedReply[] = chips.length
    ? SECTION_QUICK_FILTERS[category]
        .filter((key) => !current.quick.includes(key))
        .map((key: SectionQuickKey) => ({
          key,
          label: sectionQuickLabel(key),
          onSelect: () => searchFor(sectionQuickLabel(key), { ...current, quick: toggleSectionQuick(current.quick, key) }),
        }))
    : SECTION_STARTERS[category].map((starter) => ({ key: starter.label, label: starter.label, onSelect: () => searchFor(starter.label, starter.search, starter.kind) }));

  return (
    <ChatWindow
      subtitle={SECTION_TITLES[category]}
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
      <WelcomeCard title={SECTION_WELCOME[category]}>Tell me what you&apos;re after, or tap a suggestion. The map and results follow your search.</WelcomeCard>
      {entries.map((entry) =>
        entry.kind === "message" ? (
          <PersonMessage key={entry.id}>{entry.text}</PersonMessage>
        ) : entry.kind === "search" ? (
          <SearchMessage key={entry.id} chips={entry.chips} gaps={entry.gaps} />
        ) : entry.kind === "note" ? (
          <PinpointMessage key={entry.id}><p>{NOTE_TEXT[entry.note]}</p></PinpointMessage>
        ) : null,
      )}
      {resultCount !== undefined ? (
        <div aria-live="off">
          <PinpointMessage>
            <p role="status">
              {resultCount} {resultCount === 1 ? "match" : "matches"} in this map area. The full list stays in the results.
            </p>
          </PinpointMessage>
        </div>
      ) : null}
    </ChatWindow>
  );
}
