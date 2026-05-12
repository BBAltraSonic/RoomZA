"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Send, Loader2, MessageCircle } from "lucide-react";
import { sendMessage } from "./actions";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/browser";
import type { Database } from "@/lib/supabase/types";

type ChatMessage = Database["public"]["Tables"]["messages"]["Row"];

export function ChatBox({ initialMessages, conversationId, listingId, currentUserId, otherPersonName }: {
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
                        if (prev.some((message) => message.id === nextMessage.id)) {
                            return prev;
                        }
                        return [...prev, nextMessage];
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [conversationId, supabase]);

    async function handleSend(e: React.FormEvent) {
        e.preventDefault();
        if (!content.trim() || isSending) return;

        setIsSending(true);
        const tempContent = content;
        setContent("");
        const res = await sendMessage(conversationId, tempContent, listingId);
        if (!res.success) {
            setContent(tempContent);
        }
        setIsSending(false);
    }

    return (
        <div className="flex h-full flex-col bg-white">
            {/* Scrollable messages container */}
            <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
                {messages.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center space-y-3 text-center opacity-70">
                        <div className="rounded-full bg-zinc-100 p-4">
                            <MessageCircle className="size-6 text-zinc-400" />
                        </div>
                        <p className="text-sm font-medium text-muted-foreground">Start the conversation with {otherPersonName}</p>
                    </div>
                ) : (
                    <div className="flex flex-col space-y-6">
                        {messages.map((msg, i) => {
                            const isMine = msg.sender_id === currentUserId;
                            return (
                                <div key={msg.id || i} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                                    <div className={`max-w-[75%] rounded-2xl px-5 py-3 shadow-sm ${isMine
                                            ? "rounded-br-sm bg-[#173b33] text-white"
                                            : "rounded-bl-sm border border-border/40 bg-zinc-50 text-zinc-800"
                                        }`}>
                                        <p className="text-sm leading-relaxed">{msg.content}</p>
                                        <span className={`mt-1.5 block text-[10px] uppercase tracking-wider opacity-60 ${isMine ? "text-right" : "text-left"}`}>
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

            {/* Input Form */}
            <div className="border-t border-border/40 bg-white p-4 sm:px-6 sm:py-5">
                <form onSubmit={handleSend} className="relative flex items-center">
                    <input
                        type="text"
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder={`Message ${otherPersonName}...`}
                        disabled={isSending}
                        className="w-full rounded-full border border-border/60 bg-zinc-50/50 pb-3 pl-5 pr-14 pt-3 text-sm transition-all focus:border-[#173b33]/40 focus:outline-none focus:ring-1 focus:ring-[#173b33]/40 disabled:opacity-50"
                    />
                    <Button
                        type="submit"
                        size="icon"
                        disabled={isSending || !content.trim()}
                        className="absolute right-1.5 top-1.5 size-9 rounded-full bg-[#173b33] text-white shadow-sm transition-transform hover:scale-105 hover:bg-[#102a24] active:scale-95 disabled:scale-100 disabled:opacity-50"
                    >
                        {isSending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4 ml-0.5" />}
                    </Button>
                </form>
            </div>
        </div>
    );
}
