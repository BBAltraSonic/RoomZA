"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Check, CheckCheck, Clock, Loader2, MessageCircle, RotateCcw, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/browser";
import type { Database } from "@/lib/supabase/types";

import { markConversationRead, sendMessage } from "./actions";

type ChatMessage = Database["public"]["Tables"]["messages"]["Row"];

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

export function ChatBox({
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
  const bottomRef = useRef<HTMLDivElement>(null);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Mark inbound messages as read whenever the thread changes while open.
  const inboundCount = messages.filter((m) => m.sender_id !== currentUserId).length;
  useEffect(() => {
    void markConversationRead(conversationId);
  }, [conversationId, inboundCount]);

  useEffect(() => {
    const channel = supabase
      .channel(`chat_${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const incoming = payload.new as ChatMessage;
          setMessages((prev) => {
            if (prev.some((message) => message.id === incoming.id)) return prev;
            // Reconcile an optimistic bubble that hasn't been confirmed yet.
            if (incoming.sender_id === currentUserId) {
              const pendingIndex = prev.findIndex(
                (message) => message._clientId && message.id === message._clientId && message.content === incoming.content,
              );
              if (pendingIndex !== -1) {
                const next = [...prev];
                next[pendingIndex] = { ...incoming, _status: "sent" };
                return next;
              }
            }
            return [...prev, incoming];
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const updated = payload.new as ChatMessage;
          setMessages((prev) => prev.map((message) => (message.id === updated.id ? { ...message, read_at: updated.read_at } : message)));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, supabase, currentUserId]);

  const deliver = useCallback(
    async (clientId: string, text: string) => {
      const res = await sendMessage(conversationId, text, listingId);
      setMessages((prev) =>
        prev.map((message) => {
          if (message._clientId !== clientId) return message;
          if (res.success && res.message) return { ...res.message, _clientId: clientId, _status: "sent" as const };
          return { ...message, _status: "failed" as const };
        }),
      );
    },
    [conversationId, listingId],
  );

  async function handleSend(event: React.FormEvent) {
    event.preventDefault();
    const text = content.trim();
    if (!text || isSending) return;

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
    await deliver(clientId, text);
    setIsSending(false);
  }

  function handleRetry(message: UiMessage) {
    if (!message._clientId) return;
    setMessages((prev) => prev.map((m) => (m._clientId === message._clientId ? { ...m, _status: "sending" } : m)));
    void deliver(message._clientId, message.content);
  }

  const lastMineId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].sender_id === currentUserId) return messages[i].id;
    }
    return null;
  }, [messages, currentUserId]);

  return (
    <div className="flex h-full flex-col bg-panel">
      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
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
            {messages.map((msg, index) => {
              const isMine = msg.sender_id === currentUserId;
              const prev = messages[index - 1];
              const showDay = !prev || startOfDay(new Date(prev.created_at)) !== startOfDay(new Date(msg.created_at));
              const samePrevSender = prev && prev.sender_id === msg.sender_id && !showDay;
              const isLastMine = isMine && msg.id === lastMineId;

              return (
                <div key={msg._clientId ?? msg.id ?? index}>
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
                          ? "rounded-2xl rounded-tr-sm bg-forest text-primary-foreground"
                          : "rounded-2xl rounded-tl-sm border border-border bg-warm-surface text-ink",
                        msg._status === "failed" && "ring-1 ring-destructive/60",
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words text-sm leading-6 tracking-tight">{msg.content}</p>
                      <span
                        className={cn(
                          "mt-1 flex items-center gap-1 text-[0.65rem] font-semibold opacity-70",
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
                          className="mt-1 inline-flex items-center gap-1 text-[0.65rem] font-bold text-destructive underline-offset-2 hover:underline"
                        >
                          <RotateCcw className="size-3" /> Tap to retry
                        </button>
                      ) : null}
                    </div>
                  </div>
                  {isLastMine && msg.read_at && msg._status !== "failed" ? (
                    <p className="mt-1 pr-1 text-right text-[0.65rem] font-semibold text-muted-foreground">Seen</p>
                  ) : null}
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div
        className="border-t border-border bg-panel p-4 sm:px-6"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 1rem)" }}
      >
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
            className="h-12 w-full rounded-full border border-border bg-warm-surface pl-5 pr-14 text-sm outline-none transition-all focus:border-forest/50 focus:ring-4 focus:ring-forest/5 sm:h-11 sm:rounded-md"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!content.trim()}
            aria-label="Send message"
            className="absolute right-1.5 top-1.5 size-9 rounded-full bg-forest text-primary-foreground shadow-sm transition-all active:scale-90 disabled:opacity-50 sm:size-8 sm:rounded-md sm:active:scale-100"
          >
            {isSending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </form>
      </div>
    </div>
  );
}
