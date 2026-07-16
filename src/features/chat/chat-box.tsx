"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ArrowDown, Check, CheckCheck, Clock, MessageCircle, RotateCcw, Send } from "lucide-react";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PendingGlyph } from "@/lib/motion/primitives";
import { listItemVariants } from "@/lib/motion/presets";
import { sanitizeUserText } from "@/lib/sanitize";
import { useScrollPosition } from "@/lib/hooks/use-scroll-position";
import { createClient } from "@/lib/supabase/browser";
import type { Database } from "@/lib/supabase/types";

import { markConversationRead, sendMessage } from "./actions";
import {
  CHAT_DELIVERY_EVENT,
  CHAT_DELIVERY_TIMEOUT_MS,
  deliveryTimeoutMessage,
  isMessageDeliveryAck,
  matchesExpectedDeliveryAck,
  shouldAcknowledgeMessage,
  type MessageDeliveryAck,
} from "./realtime-delivery";

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
  const [sendError, setSendError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  const didInitialScrollRef = useRef(false);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [newMessageCount, setNewMessageCount] = useState(0);
  const isMountedRef = useRef(true);
  const supabase = useMemo(() => createClient(), []);
  const deliveredAckKeysRef = useRef(new Set<string>());
  const pendingDeliveryRef = useRef(
    new Map<
      string,
      {
        expected: Pick<MessageDeliveryAck, "messageId" | "conversationId" | "recipientId">;
        resolve: () => void;
      }
    >(),
  );

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
    } else {
      setNewMessageCount((count) => count + 1);
    }
  }, [messages, scrollToBottom, conversationId]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Mark inbound messages as read whenever the thread changes while open.
  const inboundCount = messages.filter((m) => m.sender_id !== currentUserId).length;
  useEffect(() => {
    void markConversationRead(conversationId);
  }, [conversationId, inboundCount]);

  useEffect(() => {
    const pendingDeliveries = pendingDeliveryRef.current;
    const deliveredAckKeys = deliveredAckKeysRef.current;

    function ackKey(expected: Pick<MessageDeliveryAck, "messageId" | "conversationId" | "recipientId">) {
      return `${expected.messageId}:${expected.conversationId}:${expected.recipientId}`;
    }

    function recordAck(ack: MessageDeliveryAck) {
      const key = ackKey(ack);
      deliveredAckKeysRef.current.add(key);

      const pending = pendingDeliveryRef.current.get(key);
      if (pending && matchesExpectedDeliveryAck(ack, pending.expected)) {
        pendingDeliveryRef.current.delete(key);
        pending.resolve();
      }
    }

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

          if (shouldAcknowledgeMessage(incoming, currentUserId)) {
            void channel.send({
              type: "broadcast",
              event: CHAT_DELIVERY_EVENT,
              payload: {
                messageId: incoming.id,
                conversationId: incoming.conversation_id,
                recipientId: currentUserId,
                deliveredAt: new Date().toISOString(),
              } satisfies MessageDeliveryAck,
            });
          }
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
      .on("broadcast", { event: CHAT_DELIVERY_EVENT }, (payload) => {
        if (isMessageDeliveryAck(payload.payload)) {
          recordAck(payload.payload);
        }
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setSendError(null);
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setSendError("Realtime delivery is unavailable. New messages may need a refresh.");
        }
      });

    return () => {
      pendingDeliveries.clear();
      deliveredAckKeys.clear();
      supabase.removeChannel(channel);
    };
  }, [conversationId, supabase, currentUserId]);

  const waitForDeliveryAck = useCallback(
    (expected: Pick<MessageDeliveryAck, "messageId" | "conversationId" | "recipientId">) =>
      new Promise<boolean>((resolve) => {
        const key = `${expected.messageId}:${expected.conversationId}:${expected.recipientId}`;

        if (deliveredAckKeysRef.current.has(key)) {
          resolve(true);
          return;
        }

        const timeout = window.setTimeout(() => {
          pendingDeliveryRef.current.delete(key);
          resolve(false);
        }, CHAT_DELIVERY_TIMEOUT_MS);

        pendingDeliveryRef.current.set(key, {
          expected,
          resolve: () => {
            window.clearTimeout(timeout);
            resolve(true);
          },
        });
      }),
    [],
  );

  const deliver = useCallback(
    async (clientId: string, text: string) => {
      setSendError(null);
      const res = await sendMessage(conversationId, text, listingId);
      if (!res.success) {
        if (isMountedRef.current) {
          setSendError(res.error);
          setMessages((prev) =>
            prev.map((message) => (message._clientId === clientId ? { ...message, _status: "failed" as const } : message)),
          );
        }
        return;
      }

      if (!isMountedRef.current) return;

      setMessages((prev) =>
        prev.map((message) =>
          message._clientId === clientId ? { ...res.data.message, _clientId: clientId, _status: "sending" as const } : message,
        ),
      );

      const delivered = await waitForDeliveryAck({
        messageId: res.data.message.id,
        conversationId,
        recipientId: res.data.recipientId,
      });

      if (!isMountedRef.current) return;

      setMessages((prev) =>
        prev.map((message) => {
          if (message._clientId !== clientId) return message;
          if (delivered) return { ...res.data.message, _clientId: clientId, _status: "sent" as const };
          return { ...res.data.message, _clientId: clientId, _status: "failed" as const };
        }),
      );

      if (!delivered) {
        setSendError(deliveryTimeoutMessage());
      }
    },
    [conversationId, listingId, waitForDeliveryAck],
  );

  async function handleSend(event: React.FormEvent) {
    event.preventDefault();
    const text = sanitizeUserText(content);
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
    scrollToBottom("smooth");
    await deliver(clientId, text);
    setIsSending(false);
  }

  function handleRetry(message: UiMessage) {
    if (!message._clientId) return;
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
                  initial="hidden"
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
                          ? "rounded-2xl rounded-tr-sm bg-forest text-primary-foreground"
                          : "rounded-2xl rounded-tl-sm border border-border bg-warm-surface text-ink",
                        msg._status === "failed" && "ring-1 ring-destructive/60",
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words text-sm leading-6 tracking-tight">{sanitizeUserText(msg.content)}</p>
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
        {sendError ? (
          <div className="mb-3 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">
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
            className="h-12 w-full rounded-full border border-border bg-warm-surface pl-5 pr-14 text-sm outline-none transition-all focus:border-forest/50 focus:ring-4 focus:ring-forest/5 sm:h-11 sm:rounded-md"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!content.trim()}
            aria-label="Send message"
            className="absolute right-1.5 top-1.5 size-9 rounded-full bg-forest text-primary-foreground shadow-sm transition-all active:scale-90 disabled:opacity-50 sm:size-8 sm:rounded-md sm:active:scale-100"
          >
            {isSending ? <PendingGlyph label="Sending message" /> : <Send className="size-4" />}
          </Button>
        </form>
      </div>
    </div>
  );
}
