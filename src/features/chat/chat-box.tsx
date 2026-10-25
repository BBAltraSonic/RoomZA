"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ArrowDown, Check, CheckCheck, Clock, MessageCircle, RotateCcw, Send } from "lucide-react";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";

import { Button } from "@/components/ui/button";
import { ReportPanel } from "@/features/admin/components/report-panel";
import { cn } from "@/lib/utils";
import { PendingGlyph } from "@/lib/motion/primitives";
import { listItemVariants } from "@/lib/motion/presets";
import { sanitizeUserText } from "@/lib/sanitize";
import { useScrollPosition } from "@/lib/hooks/use-scroll-position";
import { createClient } from "@/lib/supabase/browser";
import type { Database } from "@/lib/supabase/types";

import { markConversationRead, refreshConversationMessages, sendMessage } from "./actions";

type ChatMessage = Omit<Database["public"]["Tables"]["messages"]["Row"],"system_call_id">;

type SendStatus = "sending" | "sent" | "failed";

type UiMessage = ChatMessage & {
  /** Stable client id used to reconcile optimistic messages with server rows. */
  _clientId?: string;
  _status?: SendStatus;
};

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function formatDayLabel(value: string) {
  const date = new Date(value);
  const today = startOfDay(new Date());
  const day = startOfDay(date);
  const dayMs = 24 * 60 * 60 * 1000;
  if (day === today) return "Today";
  if (day === today - dayMs) return "Yesterday";
  return new Intl.DateTimeFormat("en-ZA", { weekday: "long", day: "numeric", month: "long" }).format(date);
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-ZA", { hour: "numeric", minute: "numeric" }).format(new Date(value));
}

export function ChatBox(props: Parameters<typeof ChatConversation>[0]) {
  return <ChatConversation key={props.conversationId + ":" + props.currentUserId} {...props} />;
}

function ChatConversation({
  initialMessages,
  conversationId,
  listingId,
  currentUserId,
  otherPersonName,
}: {
  initialMessages: ChatMessage[];
  conversationId: string;
  listingId: string;
  currentUserId: string;
  otherPersonName: string;
}) {
  const [messages, setMessages] = useState<UiMessage[]>(initialMessages);
  const [content, setContent] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [realtimeError, setRealtimeError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  const didInitialScrollRef = useRef(false);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [newMessageCount, setNewMessageCount] = useState(0);
  const isMountedRef = useRef(true);
  const sendingRef = useRef(false);
  const inFlightRef = useRef(new Set<string>());
  const confirmedRef = useRef(new Set<string>());
  const failedRef = useRef(new Set<string>());
  const revisionRef = useRef(0);
  const latestChangeRef = useRef(new Map<string, number>());
  const refreshRef = useRef<Promise<void> | null>(null);
  const visibleIdsRef = useRef(new Set(initialMessages.map(message => message.id)));
  const supabase = useMemo(() => createClient(), []);

  const persistScroll = useScrollPosition({
    keyName: `roomza:chat-scroll:${conversationId}`,
    ref: scrollRef,
  });

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    bottomRef.current?.scrollIntoView({ behavior, block: "end" });
    nearBottomRef.current = true;
    setIsNearBottom(true);
    setNewMessageCount(0);
  }, []);

  useEffect(() => {
    const newInbound = messages.filter(message => message.sender_id !== currentUserId && !visibleIdsRef.current.has(message.id)).length;
    visibleIdsRef.current = new Set(messages.map(message => message.id));
    if (!didInitialScrollRef.current) {
      didInitialScrollRef.current = true;
      let hasSavedPosition = false;
      try {
        hasSavedPosition = window.sessionStorage.getItem(`roomza:chat-scroll:${conversationId}`) !== null;
      } catch {
        hasSavedPosition = false;
      }
      if (!hasSavedPosition) {
        bottomRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
      }
      return;
    }

    if (nearBottomRef.current) {
      scrollToBottom("smooth");
    } else if (newInbound > 0) {
      setNewMessageCount((count) => count + newInbound);
    }
  }, [messages, scrollToBottom, conversationId, currentUserId]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const reloadMessages = useCallback(() => {
    if (refreshRef.current) return refreshRef.current;
    setIsRefreshing(true);
    const startedAtRevision = revisionRef.current;
    const request = (async () => {
      try {
        const result = await refreshConversationMessages(conversationId);
        if (!isMountedRef.current) return;
        if (!result.success) { setLoadError(result.error); return; }
        const saved = result.data.messages;
        for (const message of saved) {
          if (message.sender_id === currentUserId) {
            confirmedRef.current.add(message.id);
            failedRef.current.delete(message.id);
          }
        }
        if (!failedRef.current.size) setSendError(null);
        setLoadError(null);
        setMessages(previous => {
          const previousById = new Map(previous.map(message => [message.id, message]));
          const savedIds = new Set(saved.map(message => message.id));
          const next: UiMessage[] = saved.map(message => {
            const existing = previousById.get(message.id);
            return { ...message, _clientId: existing?._clientId, read_at: existing?.read_at ?? message.read_at, _status: "sent" };
          });
          // Keep pending local work and events newer than this snapshot read.
          // Other confirmed rows follow the authoritative snapshot.
          for (const message of previous) {
            if (!savedIds.has(message.id) && ((message._clientId && message._status !== "sent") || (latestChangeRef.current.get(message.id) ?? 0) > startedAtRevision)) next.push(message);
          }
          return next.sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
        });
      } catch {
        if (isMountedRef.current) setLoadError("Messages could not be loaded. Try again.");
      }
    })();
    refreshRef.current = request;
    void request.then(() => {
      if (refreshRef.current === request) refreshRef.current = null;
      if (isMountedRef.current) setIsRefreshing(false);
    });
    return request;
  }, [conversationId, currentUserId]);

  useEffect(() => {
    const online = () => { void reloadMessages(); };
    const visible = () => { if (document.visibilityState === "visible") void reloadMessages(); };
    window.addEventListener("online", online);
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.removeEventListener("online", online);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [reloadMessages]);

  // Mark inbound messages as read whenever the thread changes while open.
  const inboundCount = messages.filter((m) => m.sender_id !== currentUserId).length;
  useEffect(() => {
    void markConversationRead(conversationId).catch(() => {});
  }, [conversationId, inboundCount]);

  useEffect(() => {
    let active = true;
    const channel = supabase
      .channel(`chat_${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          if (!active) return;
          const incoming = payload.new as ChatMessage;
          latestChangeRef.current.set(incoming.id, ++revisionRef.current);
          if (incoming.sender_id === currentUserId) {
            confirmedRef.current.add(incoming.id);
            failedRef.current.delete(incoming.id);
            if (!failedRef.current.size) setSendError(null);
          }
          setMessages((prev) => {
            if (prev.some((message) => message.id === incoming.id)) {
              return prev.map(message => message.id === incoming.id
                ? { ...message, ...incoming, read_at: message.read_at ?? incoming.read_at, _status: "sent" }
                : message);
            }
            return [...prev, incoming];
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          if (!active) return;
          const updated = payload.new as ChatMessage;
          latestChangeRef.current.set(updated.id, ++revisionRef.current);
          setMessages((prev) => prev.map((message) => (message.id === updated.id ? { ...message, read_at: updated.read_at } : message)));
        },
      )
      .subscribe((status) => {
        if (!active) return;
        if (status === "SUBSCRIBED") {
          setRealtimeError(null);
          void reloadMessages();
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setRealtimeError("Realtime delivery is unavailable. New messages may need a refresh.");
        }
      });

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [conversationId, supabase, currentUserId, reloadMessages]);

  const deliver = useCallback(
    async (clientId: string, text: string) => {
      if (inFlightRef.current.has(clientId)) return;
      inFlightRef.current.add(clientId);
      setSendError(null);
      const fail = (error: string) => {
        if (isMountedRef.current && !confirmedRef.current.has(clientId)) {
          failedRef.current.add(clientId);
          setSendError(error);
          setMessages((prev) =>
            prev.map((message) => (message._clientId === clientId ? { ...message, _status: "failed" as const } : message)),
          );
        }
      };
      try {
        const res = await sendMessage(conversationId, text, listingId, clientId);
        if (!res.success) { fail(res.error); return; }
        if (!isMountedRef.current) return;
        confirmedRef.current.add(clientId);
        failedRef.current.delete(clientId);
        latestChangeRef.current.set(res.data.message.id, ++revisionRef.current);
        setMessages((prev) => prev.map((message) => message._clientId === clientId
          ? { ...res.data.message, read_at: message.read_at ?? res.data.message.read_at, _clientId: clientId, _status: "sent" as const }
          : message));
      } catch {
        fail("Delivery could not be confirmed. You can safely retry this message.");
      } finally {
        inFlightRef.current.delete(clientId);
      }
    },
    [conversationId, listingId],
  );

  async function handleSend(event: React.FormEvent) {
    event.preventDefault();
    const text = sanitizeUserText(content);
    if (!text || sendingRef.current) return;

    sendingRef.current = true;
    setIsSending(true);
    const clientId = crypto.randomUUID();
    const optimistic: UiMessage = {
      id: clientId,
      _clientId: clientId,
      _status: "sending",
      conversation_id: conversationId,
      listing_id: listingId,
      sender_id: currentUserId,
      content: text,
      created_at: new Date().toISOString(),
      read_at: null,
    };
    setMessages((prev) => [...prev, optimistic]);
    setContent("");
    scrollToBottom("smooth");
    try {
      await deliver(clientId, text);
    } finally {
      sendingRef.current = false;
      if (isMountedRef.current) setIsSending(false);
    }
  }

  function handleRetry(message: UiMessage) {
    if (!message._clientId || inFlightRef.current.has(message._clientId) || confirmedRef.current.has(message._clientId)) return;
    setMessages((prev) => prev.map((m) => (m._clientId === message._clientId ? { ...m, _status: "sending" } : m)));
    setSendError(null);
    void deliver(message._clientId, message.content);
  }

  const lastMineId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const message = messages[i];
      if (message && message.sender_id === currentUserId) return message.id;
    }
    return null;
  }, [messages, currentUserId]);

  return (
    <div className="flex h-full flex-col bg-panel">
      <div
        ref={scrollRef}
        className="scroll-contained relative flex-1 overflow-y-auto px-4 py-6 sm:px-6"
        onScroll={(event) => {
          persistScroll(event);
          const element = event.currentTarget;
          const nearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 96;
          nearBottomRef.current = nearBottom;
          setIsNearBottom(nearBottom);
          if (nearBottom) setNewMessageCount(0);
        }}
      >
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="rounded-lg border border-border bg-warm-surface p-4">
              <MessageCircle className="size-6 text-forest" />
            </div>
            <p className="mt-4 text-sm font-medium text-muted-foreground">
              Start the conversation with {otherPersonName}
            </p>
          </div>
        ) : (
          <div className="flex flex-col">
            <AnimatePresence initial={false}>
              {messages.map((msg, index) => {
              const isMine = msg.sender_id === currentUserId;
              const prev = messages[index - 1];
              const showDay = !prev || startOfDay(new Date(prev.created_at)) !== startOfDay(new Date(msg.created_at));
              const samePrevSender = prev && prev.sender_id === msg.sender_id && !showDay;
              const isLastMine = isMine && msg.id === lastMineId;

              return (
                <m.div
                  key={msg._clientId ?? msg.id ?? index}
                  layout
                  variants={listItemVariants}
                  initial={false}
                  animate="visible"
                  exit="exit"
                >
                  {showDay ? (
                    <div className="my-4 flex items-center justify-center">
                      <span className="rounded-full bg-warm-surface px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">
                        {formatDayLabel(msg.created_at)}
                      </span>
                    </div>
                  ) : null}
                  <div className={cn("flex", isMine ? "justify-end" : "justify-start", samePrevSender ? "mt-1" : "mt-3")}>
                    <div
                      className={cn(
                        "max-w-[85%] px-4 py-2.5 shadow-[var(--elevation-1)]",
                        isMine
                          ? "rounded-2xl rounded-tr-sm bg-primary text-primary-foreground"
                          : "rounded-2xl rounded-tl-sm border border-border bg-warm-surface text-ink",
                        msg._status === "failed" && "ring-1 ring-destructive/60",
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words text-sm leading-6 tracking-tight">{sanitizeUserText(msg.content)}</p>
                      <span
                        className={cn(
                          "mt-1 flex items-center gap-1 text-[0.6875rem] font-medium",
                          isMine ? "justify-end" : "justify-start",
                        )}
                      >
                        {formatTime(msg.created_at)}
                        {isMine && msg._status === "sending" ? <Clock className="size-3" aria-label="Sending" /> : null}
                        {isMine && msg._status === "failed" ? (
                          <AlertCircle className="size-3 text-destructive" aria-label="Failed to send" />
                        ) : null}
                        {isMine && msg._status !== "sending" && msg._status !== "failed" ? (
                          msg.read_at ? (
                            <CheckCheck className="size-3.5" aria-label="Seen" />
                          ) : (
                            <Check className="size-3.5" aria-label="Sent" />
                          )
                        ) : null}
                      </span>
                      {msg._status === "failed" ? (
                        <button
                          type="button"
                          onClick={() => handleRetry(msg)}
                          className="mt-1 inline-flex items-center gap-1 min-h-11 text-xs font-semibold text-primary-foreground underline underline-offset-2 hover:underline"
                        >
                          <RotateCcw className="size-3" /> Tap to retry
                        </button>
                      ) : null}
                    </div>
                  </div>
                  {isLastMine && msg.read_at && msg._status !== "failed" ? (
                    <p className="mt-1 pr-1 text-right text-[0.65rem] font-semibold text-muted-foreground">Seen</p>
                  ) : null}
                  {!isMine && !msg._clientId ? (
                    <div className="mt-1 flex justify-start">
                      <ReportPanel messageId={msg.id} label="Report message" popover compact />
                    </div>
                  ) : null}
                </m.div>
              );
              })}
            </AnimatePresence>
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {!isNearBottom && messages.length > 0 ? (
        <div className="pointer-events-none -mt-14 flex justify-center px-4">
          <button
            type="button"
            onClick={() => scrollToBottom("smooth")}
            className="pointer-events-auto inline-flex min-h-10 items-center gap-2 rounded-full border border-border bg-panel px-3 text-xs font-semibold text-ink shadow-[var(--elevation-2)] hover:border-forest hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowDown className="size-3.5" />
            {newMessageCount > 0 ? `${newMessageCount} new` : "Newest"}
          </button>
        </div>
      ) : null}

      <div
        className="border-t border-border bg-panel p-4 sm:px-6"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 1rem)" }}
      >
        {loadError || realtimeError ? (
          <div role="alert" className="mb-3 flex items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <p>{loadError ?? realtimeError}</p>
            <Button type="button" variant="outline" size="sm" disabled={isRefreshing} onClick={() => { void reloadMessages(); }}>Reload messages</Button>
          </div>
        ) : null}
        {isRefreshing ? <p role="status" className="mb-2 text-xs text-muted-foreground">Checking messages…</p> : null}
        {sendError ? (
          <div role="alert" className="mb-3 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <p>{sendError}</p>
          </div>
        ) : null}
        <form onSubmit={handleSend} className="relative flex items-center">
          <label htmlFor="message-input" className="sr-only">
            Type a message
          </label>
          <input
            id="message-input"
            type="text"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder={`Message ${otherPersonName}`}
            aria-label="Message content"
            maxLength={2000}
            className="h-12 w-full rounded-full border border-border bg-warm-surface pl-5 pr-14 text-sm outline-none transition-all focus:border-forest/50 focus:ring-4 focus:ring-forest/5 sm:h-11 sm:rounded-md"
          />
          <Button
            type="submit"
            size="icon"
            disabled={isSending || !content.trim()}
            aria-label="Send message"
            className="absolute right-1.5 top-1.5 size-9 rounded-full bg-forest text-primary-foreground shadow-[var(--shadow-control)] transition-colors disabled:opacity-50 sm:size-8 sm:rounded-md sm:active:scale-100"
          >
            {isSending ? <PendingGlyph label="Sending message" /> : <Send className="size-4" />}
          </Button>
        </form>
      </div>
    </div>
  );
}
