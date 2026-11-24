"use client";

import { ArrowLeft, Loader2, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

import { chipButton } from "../assistant-templates";
import { stripContactDetails } from "../privacy";
import { approveChange, completeReminder, createReminder, getBusinessView, snoozeReminder } from "./business-actions";
import type { BusinessAssistantResponse } from "./business-api";
import { BusinessTemplate, TEMPLATE_TITLES, type ReminderActions, type TemplateProps } from "./business-templates";
import type { BusinessView } from "./business-view";
import type { BusinessRequest } from "./request-intent";

/**
 * The lister's assistant panel on My listings (proposal, "Business mode"). It opens on Today,
 * refreshes on its own while open, and keeps a short history so Back returns to the last
 * screen. Typed requests go to /api/assistant/business; taps call server functions directly.
 */

export const BUSINESS_STARTERS: { label: string; request: BusinessRequest }[] = [
  { label: "Who's waiting on me?", request: { template: "people_list", filters: { waitingOnYou: true } } },
  { label: "How are my listings doing?", request: { template: "performance" } },
  { label: "What do people ask about?", request: { template: "question_insights" } },
  { label: "What's missing on my listings?", request: { template: "quality_check" } },
  { label: "Who's gone quiet?", request: { template: "people_list", filters: { stage: "gone-quiet" } } },
  { label: "My reminders", request: { template: "reminders" } },
];

const NOTICES: Record<NonNullable<BusinessAssistantResponse["notice"]>, string> = {
  allowance_used: "You've used today's typed requests. The buttons still work.",
  busy: "The assistant is busy right now. The buttons still work.",
  ai_unavailable: "I couldn't work that out, so here's Today. Try the buttons below.",
};

/** Screens that are safe to reload in the background: nothing typed or ticked on them. */
const REFRESHABLE = new Set<BusinessView["template"]>(["today", "people_list", "person_detail", "performance", "question_insights", "quality_check"]);
export const REFRESH_MS = 60_000;

type Screen = { request: BusinessRequest; view: BusinessView; id: number };

export function BusinessPanel({ onClose, onBadge }: { onClose: () => void; onBadge?: (count: number) => void }) {
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const nextId = useRef(1);
  const [stack, setStack] = useState<Screen[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const screen = stack.at(-1) ?? null;

  const show = useCallback((request: BusinessRequest, view: BusinessView, mode: "push" | "replace" = "push") => {
    if (view.template === "today") onBadge?.(view.badge);
    const entry = { request, view, id: nextId.current++ };
    setStack((current) => (mode === "replace" && current.length ? [...current.slice(0, -1), entry] : [...current.slice(-9), entry]));
  }, [onBadge]);

  const open = useCallback(async (request: BusinessRequest, mode: "push" | "replace" = "push") => {
    setBusy(true);
    setError(null);
    const result = await getBusinessView(request).catch(() => null);
    setBusy(false);
    if (!result?.success) {
      setError(result?.error ?? "That couldn't load. Try again.");
      return;
    }
    setNotice(null);
    show(request, result.data, mode);
  }, [show]);

  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    inputRef.current?.focus();
    void open({ template: "today" });
  }, [open]);

  // Updates on its own while open, but never under the lister's fingers.
  useEffect(() => {
    if (!screen || !REFRESHABLE.has(screen.view.template)) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void getBusinessView(screen.request).then((result) => {
        if (!result.success) return;
        if (result.data.template === "today") onBadge?.(result.data.badge);
        setStack((current) => (current.at(-1)?.id === screen.id ? [...current.slice(0, -1), { ...screen, view: result.data }] : current));
      }).catch(() => undefined);
    }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [screen, onBadge]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const typed = stripContactDetails(text).trim();
    if (!typed || busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/assistant/business", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: typed.slice(0, 300) }) });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; data?: BusinessAssistantResponse; error?: { message?: string } } | null;
      if (!response.ok || !payload?.ok || !payload.data) {
        setError(payload?.error?.message ?? "That couldn't be answered. Try again.");
        return;
      }
      setText("");
      setNotice(payload.data.notice ? NOTICES[payload.data.notice] : null);
      show(payload.data.request, payload.data.view);
    } catch {
      setError("That couldn't be answered. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const reminders: ReminderActions = {
    save: async (input) => {
      const result = await createReminder(input).catch(() => null);
      return result?.success ? null : result?.error ?? "The reminder couldn't be saved. Try again.";
    },
    done: async (id) => {
      const result = await completeReminder(id).catch(() => null);
      return result?.success ? null : result?.error ?? "That didn't work. Try again.";
    },
    snooze: async (id, choice) => {
      const result = await snoozeReminder(id, choice).catch(() => null);
      return result?.success ? null : result?.error ?? "That didn't work. Try again.";
    },
  };

  const onApprove: TemplateProps["onApprove"] = async (change, itemIds) => {
    const result = await approveChange(change, itemIds).catch(() => null);
    if (!result) return { error: "Approve didn't go through. Check your connection and try again." };
    return result.success ? result.data : { error: result.error };
  };

  if (typeof document === "undefined") return null;
  const title = screen ? TEMPLATE_TITLES[screen.view.template] : "Pinpoint Assistant";

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
      className="fixed inset-x-0 bottom-[var(--app-mobile-nav-offset)] z-[55] flex max-h-[80dvh] flex-col overflow-hidden rounded-t-3xl border border-border/70 bg-panel text-ink shadow-[var(--elevation-3)] lg:inset-x-auto lg:bottom-4 lg:right-4 lg:top-[calc(var(--chrome-h)+1rem)] lg:max-h-none lg:w-[28rem] lg:rounded-3xl"
    >
      <div className="flex shrink-0 items-center gap-1 border-b border-border/70 px-2 py-2">
        {stack.length > 1 ? (
          <button type="button" onClick={() => setStack((current) => current.slice(0, -1))} aria-label="Back" className="flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <ArrowLeft className="size-4" aria-hidden="true" />
          </button>
        ) : (
          <span className="flex size-11 items-center justify-center"><Sparkles className="size-4 text-brand-ink" aria-hidden="true" /></span>
        )}
        <h2 id={titleId} className="min-w-0 flex-1 truncate text-base font-semibold">{title}</h2>
        {busy ? <Loader2 className="size-4 animate-spin text-muted-foreground motion-reduce:animate-none" aria-label="Loading" /> : null}
        <button type="button" onClick={onClose} aria-label="Close assistant" className="flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 pt-3">
        <form onSubmit={handleSubmit} className="flex min-h-11 items-center gap-2 rounded-full border border-border/70 bg-background px-4 focus-within:border-forest focus-within:ring-1 focus-within:ring-forest">
          <input
            ref={inputRef}
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={300}
            aria-label="What do you need?"
            placeholder="Who's serious about my Bellville room?"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <button type="submit" disabled={!text.trim() || busy} aria-label="Ask" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Sparkles className="size-4" aria-hidden="true" />
          </button>
        </form>

        {notice ? <p role="status" className="mt-2 text-sm text-muted-foreground">{notice}</p> : null}
        {error ? <p role="alert" className="mt-2 text-sm text-status-warning-text">{error}</p> : null}

        {screen ? (
          <BusinessTemplate key={screen.id} view={screen.view} onRequest={(request) => void open(request)} onApprove={onApprove} reminders={reminders} />
        ) : !error ? (
          <p role="status" className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> Loading what needs you…
          </p>
        ) : null}

        {screen?.view.template === "today" ? (
          <>
            <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Try asking</h3>
            <ul aria-label="Try asking" className="mt-2 flex flex-wrap gap-2">
              {BUSINESS_STARTERS.map((starter) => (
                <li key={starter.label}>
                  <button type="button" onClick={() => void open(starter.request)} className={cn(chipButton, "border-border bg-background text-ink hover:border-forest/40")}>
                    {starter.label}
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
