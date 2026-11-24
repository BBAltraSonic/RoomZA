"use client";

import { Search, Sparkles, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";

import { sectionQuickLabel, SECTION_QUICK_FILTERS, toggleSectionQuick } from "@/features/discovery/section-quick-filters";
import type { ViewportCategory } from "@/features/discovery/viewport-contract";
import { cn } from "@/lib/utils";

import { chipButton } from "./assistant-templates";
import { stripContactDetails } from "./privacy";
import { applySectionSearch, parseSectionText, readSectionSearch, SECTION_STARTERS, type SectionSearch } from "./section-intent";
import { VoiceInputButton } from "./voice-input";

const SECTION_NAMES: Record<ViewportCategory, string> = { shopping: "specials", tourism: "places", event: "events", service: "services" };
const PLACEHOLDERS: Record<ViewportCategory, string> = {
  shopping: "Food deals ending today",
  tourism: "New places near me",
  event: "Free live music tonight",
  service: "Plumber open now",
};

/**
 * The assistant on the Specials, Places, Events and Services sections. It writes the same
 * address the section's search box, sorts and quick filters already use, so the map, pins
 * and results follow, and Back undoes it.
 */
export function SectionAssistantPanel({ category, onClose, resultCount }: { category: ViewportCategory; onClose: () => void; resultCount?: number }) {
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [, rerender] = useState(0);

  useEffect(() => {
    inputRef.current?.focus();
    const update = () => rerender((value) => value + 1);
    window.addEventListener("popstate", update);
    window.addEventListener("pinpoint:discovery-controls", update);
    return () => {
      window.removeEventListener("popstate", update);
      window.removeEventListener("pinpoint:discovery-controls", update);
    };
  }, []);

  if (typeof document === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const current = readSectionSearch(params, category);

  function go(search: SectionSearch, kind?: "event") {
    const url = new URL(window.location.href);
    const next = applySectionSearch(url.searchParams, search);
    if (kind) next.set("kind", kind);
    url.search = next.toString();
    window.history.pushState(null, "", url);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const typed = stripContactDetails(text);
    if (!typed) return;
    setText("");
    const parsed = parseSectionText(typed, category);
    go({ ...parsed, serviceType: parsed.serviceType ?? current.serviceType, quick: [...new Set([...current.quick, ...parsed.quick])], nearest: parsed.nearest || current.nearest });
  }

  const understood = [
    ...(current.serviceType ? [{ id: "type", label: current.serviceType, remove: () => go({ ...current, serviceType: undefined }) }] : []),
    ...(current.text ? [{ id: "text", label: `“${current.text}”`, remove: () => go({ ...current, text: "" }) }] : []),
    ...(current.nearest ? [{ id: "nearest", label: "Nearest first", remove: () => go({ ...current, nearest: false }) }] : []),
    ...current.quick.map((key) => ({ id: key, label: sectionQuickLabel(key), remove: () => go({ ...current, quick: current.quick.filter((value) => value !== key) }) })),
  ];

  return createPortal(
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onClose();
        }
      }}
      className="fixed inset-x-0 bottom-[var(--app-mobile-nav-offset)] z-[55] flex max-h-[58dvh] flex-col overflow-hidden rounded-t-3xl border border-border/70 bg-panel text-ink shadow-[var(--elevation-3)] lg:inset-x-auto lg:bottom-auto lg:right-4 lg:top-[calc(var(--chrome-h)+1rem)] lg:max-h-[calc(100dvh-var(--chrome-h)-2rem)] lg:w-[24rem] lg:rounded-3xl"
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-border/70 px-4 py-2">
        <Sparkles className="size-4 text-brand-ink" aria-hidden="true" />
        <h2 id={titleId} className="min-w-0 flex-1 truncate text-base font-semibold">Pinpoint Assistant</h2>
        <button type="button" onClick={onClose} aria-label="Close assistant" className="flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
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
            maxLength={200}
            aria-label={`What ${SECTION_NAMES[category]} are you looking for?`}
            placeholder={PLACEHOLDERS[category]}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <VoiceInputButton onText={(heard) => { setText(heard); inputRef.current?.focus(); }} onProblem={setProblem} />
          <button type="submit" disabled={!text.trim()} aria-label="Ask" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Sparkles className="size-4" aria-hidden="true" />
          </button>
        </form>
        {problem ? <p role="alert" className="mt-2 text-xs text-status-warning-text">{problem}</p> : null}

        {understood.length ? (
          <ul aria-label="Understood" className="mt-3 flex flex-wrap gap-2">
            {understood.map((chip) => (
              <li key={chip.id}>
                <span className="inline-flex min-h-11 items-center gap-1 rounded-full bg-selection pl-3.5 text-sm font-semibold text-selection-foreground">
                  {chip.label}
                  <button type="button" onClick={chip.remove} aria-label={`Remove ${chip.label}`} className="flex size-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
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
              {SECTION_STARTERS[category].map((starter) => (
                <li key={starter.label}>
                  <button type="button" onClick={() => go(starter.search, starter.kind)} className={cn(chipButton, "border-border bg-background text-ink hover:border-forest/40")}>
                    {starter.label}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quick filters</h3>
        <ul aria-label="Quick filters" className="mt-2 flex flex-wrap gap-2">
          {SECTION_QUICK_FILTERS[category].map((key) => {
            const on = current.quick.includes(key);
            return (
              <li key={key}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => go({ ...current, quick: toggleSectionQuick(current.quick, key) })}
                  className={cn(chipButton, on ? "border-transparent bg-selection text-selection-foreground" : "border-border bg-background text-ink hover:border-forest/40")}
                >
                  {sectionQuickLabel(key)}
                </button>
              </li>
            );
          })}
        </ul>
        {resultCount !== undefined ? (
          <p role="status" className="mt-4 text-sm text-muted-foreground">
            {resultCount} {resultCount === 1 ? "match" : "matches"} in this map area. The full list stays in the results.
          </p>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
