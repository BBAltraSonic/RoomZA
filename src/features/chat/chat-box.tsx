"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, MessageCircle, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/browser";
import type { Database } from "@/lib/supabase/types";

import { sendMessage } from "./actions";

type ChatMessage = Database["public"]["Tables"]["messages"]["Row"];

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
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [content, setContent] = useState("");
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const channel = supabase
      .channel(`chat_${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const nextMessage = payload.new as ChatMessage;
          setMessages((prev) => {
            if (prev.some((message) => message.id === nextMessage.id)) return prev;
            return [...prev, nextMessage];
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, supabase]);

  async function handleSend(event: React.FormEvent) {
    event.preventDefault();
    if (!content.trim() || isSending) return;

    setIsSending(true);
    const tempContent = content;
    setContent("");
    const res = await sendMessage(conversationId, tempContent, listingId);
    if (!res.success) setContent(tempContent);
    setIsSending(false);
  }

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
          <div className="flex flex-col space-y-4">
            {messages.map((msg, index) => {
              const isMine = msg.sender_id === currentUserId;
              return (
                <div key={msg.id || index} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={cn(
                      "max-w-[85%] px-4 py-3 shadow-[var(--elevation-1)]",
                      isMine
                        ? "rounded-2xl rounded-tr-sm bg-forest text-primary-foreground"
                        : "rounded-2xl rounded-tl-sm border border-border bg-warm-surface text-ink"
                    )}
                  >
                    <p className="text-sm leading-6 tracking-tight">{msg.content}</p>
                    <span className={cn("mt-1.5 block text-[0.65rem] font-bold opacity-70", isMine ? "text-right" : "text-left")}>
                      {new Intl.DateTimeFormat("en-ZA", { hour: "numeric", minute: "numeric" }).format(new Date(msg.created_at))}
                    </span>
                  </div>
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
            disabled={isSending}
            aria-label="Message content"
            className="h-12 w-full rounded-full border border-border bg-warm-surface pl-5 pr-14 text-sm outline-none transition-all focus:border-forest/50 focus:ring-4 focus:ring-forest/5 disabled:opacity-50 sm:h-11 sm:rounded-md"
          />
          <Button
            type="submit"
            size="icon"
            disabled={isSending || !content.trim()}
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
