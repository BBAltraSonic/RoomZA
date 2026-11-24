"use client";

import { ChevronDown, ChevronUp, Loader2, SendHorizontal, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

import type { PikoMood } from "@/features/piko/art";
import { pikoLine } from "@/features/piko/lines";
import { PikoFace } from "@/features/piko/piko";
import { cn } from "@/lib/utils";

import { chipButton } from "./assistant-templates";
import { appendToThread, clearThread, loadThread, saveThread, type NewThreadEntry, type ThreadEntry } from "./chat-thread";
import { VoiceInputButton } from "./voice-input";

/**
 * Piko's chat window (proposal, "Chat design"): a header naming what the chat is about,
 * the current search pinned under it, the conversation, suggested replies, and the message box
 * with up to two fixed buttons. Each panel fills it with its own thread and cards.
 */

type SheetHeight = "peek" | "half" | "full";
const NEXT_HEIGHT: Record<SheetHeight, SheetHeight> = { peek: "half", half: "full", full: "peek" };

export type SuggestedReply = { key: string; label: string; onSelect: () => void };

/** This visit's thread for one panel, kept in session storage as it changes. */
export function useChatThread(scope: string) {
  const [entries, setEntries] = useState<ThreadEntry[]>(() => loadThread(scope));
  useEffect(() => {
    saveThread(scope, entries);
  }, [scope, entries]);
  const append = useCallback((...added: NewThreadEntry[]) => setEntries((current) => appendToThread(current, ...added)), []);
  const clear = useCallback(() => {
    clearThread(scope);
    setEntries([]);
  }, [scope]);
  return { entries, append, clear };
}

type ChatWindowProps = {
  /** What the chat is about, under the title: a listing, the current search or a section. */
  subtitle: string;
  onClose: () => void;
  /** Extra header buttons, such as "What I remember" and "New chat". */
  headerActions?: ReactNode;
  /** The current search, pinned under the header so its chips are always in reach. */
  pinned?: ReactNode;
  /** Replaces the conversation, for screens such as "What I remember". */
  screen?: ReactNode;
  /** The conversation: welcome card, messages and cards. */
  children: ReactNode;
  replies?: SuggestedReply[];
  /** Up to two fixed buttons beside the message box, such as "Message landlord". */
  actions?: ReactNode;
  busy?: boolean;
  /** A one-off problem from the message box itself, such as the microphone being blocked. */
  problem?: string | null;
  onProblem?: (message: string | null) => void;
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: () => void;
  placeholder: string;
  maxLength?: number;
  /** Changes whenever the conversation grows, so the window scrolls to the newest message. */
  scrollKey: string | number;
};

export function ChatWindow({
  subtitle,
  onClose,
  headerActions,
  pinned,
  screen,
  children,
  replies = [],
  actions,
  busy = false,
  problem,
  onProblem,
  value,
  onValueChange,
  onSubmit,
  placeholder,
  maxLength = 300,
  scrollKey,
}: ChatWindowProps) {
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<SheetHeight>("half");

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const element = scrollRef.current;
    if (element && !screen) element.scrollTop = element.scrollHeight;
  }, [scrollKey, busy, screen]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!value.trim() || busy) return;
    onSubmit();
  }

  if (typeof document === "undefined") return null;

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
      data-height={height}
      className={cn(
        "fixed inset-x-0 bottom-[var(--app-mobile-nav-offset)] z-[55] flex flex-col overflow-hidden rounded-t-3xl border border-border/70 bg-panel text-ink shadow-[var(--elevation-3)]",
        height === "peek" && "h-[13rem]",
        height === "half" && "h-[58dvh]",
        height === "full" && "h-[calc(100dvh-var(--app-mobile-nav-offset)-3rem)]",
        "lg:inset-x-auto lg:bottom-4 lg:right-4 lg:top-[calc(var(--chrome-h)+1rem)] lg:h-auto lg:w-[var(--assistant-panel-width)] lg:rounded-3xl",
      )}
    >
      <header className="flex shrink-0 items-center gap-1 border-b border-border/70 py-1.5 pl-4 pr-1.5">
        <PikoFace mood="welcome" size={36} />
        <div className="min-w-0 flex-1 pl-1.5">
          <h2 id={titleId} className="truncate whitespace-nowrap text-base font-semibold">Piko</h2>
          <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            <span className="shrink-0 rounded-md bg-muted px-1.5 py-px text-[11px] font-medium">Beta</span>
            <span className="truncate">{subtitle}</span>
          </p>
        </div>
        {headerActions}
        <button
          type="button"
          onClick={() => setHeight(NEXT_HEIGHT[height])}
          aria-label={height === "full" ? "Show less of Piko" : "Show more of Piko"}
          className="flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
        >
          {height === "full" ? <ChevronDown className="size-4" aria-hidden="true" /> : <ChevronUp className="size-4" aria-hidden="true" />}
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close Piko"
          className="flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </header>

      {pinned && !screen ? <div className="shrink-0 border-b border-border/70 px-3 py-1.5">{pinned}</div> : null}

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-background/60 px-4 pb-3 pt-3">
        {screen ?? (
          <>
            <div role="log" aria-label="Conversation" aria-live="polite" className="flex flex-col gap-3">
              {children}
            </div>
            {busy ? (
              <p role="status" className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <PikoFace mood="searching" size={28} />
                {pikoLine("working_out")}
              </p>
            ) : null}
            {replies.length ? (
              <ul aria-label="Suggested replies" className="mt-3 flex flex-wrap justify-end gap-2">
                {replies.map((reply) => (
                  <li key={reply.key}>
                    <button
                      type="button"
                      onClick={reply.onSelect}
                      className={cn(chipButton, "border-forest/50 bg-panel text-forest hover:border-forest hover:bg-selection/40")}
                    >
                      {reply.label}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        )}
      </div>

      <div className="shrink-0 border-t border-border/70 px-3 pb-3 pt-2">
        {problem ? <p role="alert" className="mb-2 text-xs text-status-warning-text">{problem}</p> : null}
        <form onSubmit={handleSubmit} className="flex min-h-11 items-center gap-2 rounded-full border border-border/70 bg-background pl-4 pr-1 focus-within:border-forest focus-within:ring-1 focus-within:ring-forest">
          <input
            ref={inputRef}
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
            maxLength={maxLength}
            aria-label="Message Piko"
            placeholder={placeholder}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <VoiceInputButton disabled={busy} onText={(heard) => { onValueChange(heard); inputRef.current?.focus(); }} onProblem={onProblem} />
          <button
            type="submit"
            disabled={busy || !value.trim()}
            aria-label="Send"
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {busy ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <SendHorizontal className="size-4" aria-hidden="true" />}
          </button>
        </form>
        {actions ? <div className="mt-2 flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </div>,
    document.body,
  );
}

/** A header button in the chat window's style. */
export function HeaderButton({ label, icon, onClick, pressed, showLabel = false }: { label: string; icon: ReactNode; onClick: () => void; pressed?: boolean; showLabel?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      aria-label={showLabel ? undefined : label}
      className="flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {icon}
      {showLabel ? <span className="sr-only sm:not-sr-only">{label}</span> : null}
    </button>
  );
}

/** A fixed button beside the message box. */
export function ChatActionButton({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cn(chipButton, "min-h-10 rounded-xl border-border bg-panel text-ink hover:border-forest/40")}>
      {icon}
      {label}
    </button>
  );
}

export function PersonMessage({ children }: { children: ReactNode }) {
  return (
    <div className="flex justify-end">
      <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-sm text-primary-foreground">
        <span className="sr-only">You: </span>
        <span>{children}</span>
      </p>
    </div>
  );
}

/**
 * A message from Piko, with the face for its mood beside it. Its words are always fixed sentences
 * (PIKO_LINES) or cards built from data.
 */
export function PinpointMessage({ children, className, mood = "welcome" }: { children: ReactNode; className?: string; mood?: PikoMood }) {
  return (
    <div className="flex items-end gap-2">
      <PikoFace mood={mood} size={28} />
      <div className={cn("min-w-0 max-w-[88%] rounded-2xl rounded-bl-md border border-border/70 bg-panel px-3.5 py-2.5 text-sm", className)}>
        <span className="sr-only">Piko: </span>
        {children}
      </div>
    </div>
  );
}

/** Piko's hello at the top of every chat, with what this chat can do. */
export function WelcomeCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label="Welcome" className="flex gap-3 rounded-2xl border border-border/70 bg-panel p-3.5">
      <PikoFace mood="welcome" size={44} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        <div className="mt-1 text-sm text-muted-foreground">
          {pikoLine("welcome")} {children}
        </div>
      </div>
    </section>
  );
}

/** "Searching for" with the chips that were applied, and grey chips for what can't be searched. */
export function SearchMessage({ chips, gaps, version }: { chips: readonly string[]; gaps: readonly { key: string; label: string }[]; version?: number }) {
  return (
    <PinpointMessage mood={chips.length ? "searching" : "explore"}>
      {chips.length ? (
        <>
          <p>{pikoLine("searching", version)}</p>
          <p className="mt-1 text-xs text-muted-foreground">Searching for:</p>
          <ul aria-label="Searching for" className="mt-1.5 flex flex-wrap gap-1.5">
            {chips.map((label) => (
              <li key={label} className="rounded-full bg-selection px-2.5 py-1 text-xs font-semibold text-selection-foreground">{label}</li>
            ))}
          </ul>
        </>
      ) : (
        <p>{pikoLine("everything")}</p>
      )}
      {gaps.length ? (
        <ul aria-label="Can't search yet" className="mt-1.5 flex flex-wrap gap-1.5">
          {gaps.map((gap) => (
            <li key={gap.key} className="rounded-full border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground">{gap.label}</li>
          ))}
        </ul>
      ) : null}
    </PinpointMessage>
  );
}

/** The current search, pinned under the header: one scrollable row of removable chips. */
export function CurrentSearch({ chips }: { chips: readonly { id: string; label: string; remove: () => void }[] }) {
  if (!chips.length) return null;
  return (
    <ul aria-label="Current search" className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
      {chips.map((chip) => (
        <li key={chip.id} className="shrink-0">
          <span className="inline-flex min-h-11 items-center gap-0.5 rounded-full bg-selection pl-3 text-sm font-semibold text-selection-foreground">
            {chip.label}
            <button
              type="button"
              onClick={chip.remove}
              aria-label={`Remove ${chip.label}`}
              className="flex size-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </span>
        </li>
      ))}
    </ul>
  );
}
