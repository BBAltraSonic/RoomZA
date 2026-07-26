"use server";

import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { enqueueNotificationEvent } from "@/features/notifications/outbox";
import { actionSuccess, actionFailure, type ActionResult } from "@/lib/action-result";
import { startCall, type CallSession } from "@/features/chat/call-actions";
import { logger } from "@/lib/logger";
import type { Database } from "@/lib/supabase/types";
import { z } from "zod";
import { sanitizeUserText } from "@/lib/sanitize";

type ConversationMessage = Pick<
    Database["public"]["Tables"]["messages"]["Row"],
    "id" | "content" | "created_at" | "sender_id"
>;

type SentMessage = Database["public"]["Tables"]["messages"]["Row"];

type ConversationParticipants = {
    renter_id: string;
    landlord_id: string;
    listing_id: string;
};

const idInputSchema = z.string().min(1, "Invalid id.");
const messageInputSchema = z.object({
    conversationId: z.string().min(1, "Invalid conversation id."),
    content: z.string().trim().min(1, "Message cannot be empty.").max(2_000, "Message is too long."),
    listingId: z.string().min(1, "Invalid listing id."),
});

export async function getOrCreateApplicationConversation(applicationId: string) {
    const parsedInput = idInputSchema.safeParse(applicationId);
    if (!parsedInput.success) return { success: false, error: "Invalid application id" };

    const { user } = await requireRole("landlord");
    const supabase = await createClient();

    // Verify application and ownership
    const { data: application } = await supabase
        .from("applications")
        .select(`
            id, listing_id, renter_id,
            listing:listings!inner(landlord_id)
        `)
        .eq("id", parsedInput.data)
        .single();

    if (!application) return { success: false, error: "Application not found" };

    const listingData = application.listing as unknown as { landlord_id: string };
    if (listingData.landlord_id !== user.id) {
        return { success: false, error: "Access denied" };
    }

    // Check if conversation already exists by using the unique constraint (listing_id, renter_id)
    const { data: existing } = await supabase
        .from("conversations")
        .select("id, type, application_id")
        .eq("listing_id", application.listing_id)
        .eq("renter_id", application.renter_id)
        .maybeSingle();

    if (existing) {
        // Upgrade inquiry to application if needed
        if (existing.type === "inquiry" || !existing.application_id) {
            await supabase.from("conversations").update({ type: "application", application_id: application.id }).eq("id", existing.id);
        }
        return { success: true, conversationId: existing.id };
    }

    // Create a new conversation
    const { data: newConvo, error } = await supabase
        .from("conversations")
        .insert({
            listing_id: application.listing_id,
            renter_id: application.renter_id,
            landlord_id: listingData.landlord_id,
            application_id: application.id,
            type: "application" as const,
        })
        .select("id")
        .single();

    if (error || !newConvo) {
        // Concurrent create — reuse the existing conversation if the unique
        // (listing_id, renter_id) constraint tripped, and upgrade it.
        const { data: raced } = await supabase
            .from("conversations")
            .select("id, type, application_id")
            .eq("listing_id", application.listing_id)
            .eq("renter_id", application.renter_id)
            .maybeSingle();
        if (raced) {
            if (raced.type === "inquiry" || !raced.application_id) {
                await supabase.from("conversations").update({ type: "application", application_id: application.id }).eq("id", raced.id);
            }
            return { success: true, conversationId: raced.id };
        }
        return { success: false, error: error?.message || "Failed to create conversation" };
    }

    return { success: true, conversationId: newConvo.id };
}

export async function getConversation(conversationId: string) {
    const parsedInput = idInputSchema.safeParse(conversationId);
    if (!parsedInput.success) return null;

    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return null;

    const { data, error } = await supabase
        .from("conversations")
        .select(`
            *,
            listing:listings(title, address, price, listing_images(public_url)),
            renter:profiles!renter_id(id, email, full_name, presence_status),
            landlord:profiles!landlord_id(id, email, full_name, presence_status)
        `)
        .eq("id", parsedInput.data)
        .or(`renter_id.eq.${userData.user.id},landlord_id.eq.${userData.user.id}`)
        .single();

    if (error || !data) return null;
    return data;
}

export async function sendMessage(
    conversationId: string,
    content: string,
    listingId: string,
): Promise<ActionResult<{ message: SentMessage; recipientId: string }>> {
    const parsedInput = messageInputSchema.safeParse({ conversationId, content, listingId });
    if (!parsedInput.success) {
        return actionFailure(parsedInput.error.issues[0]?.message ?? "Invalid message.");
    }

    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return actionFailure("Unauthenticated");

    const { conversationId: parsedConversationId, listingId: parsedListingId } = parsedInput.data;
    const trimmed = sanitizeUserText(parsedInput.data.content);
    if (!trimmed) return actionFailure("Empty message");

    const { data: conversation, error: conversationError } = await supabase
        .from("conversations")
        .select("renter_id, landlord_id, listing_id")
        .eq("id", parsedConversationId)
        .eq("listing_id", parsedListingId)
        .single();

    if (conversationError || !conversation) {
        logger.warn("Failed to resolve message conversation", {
            conversationId: parsedConversationId,
            listingId: parsedListingId,
            userId: userData.user.id,
            error: conversationError?.message,
        });
        return actionFailure("Conversation not found.");
    }

    const participants = conversation as ConversationParticipants;
    const senderId = userData.user.id;
    const recipientId =
        participants.renter_id === senderId
            ? participants.landlord_id
            : participants.landlord_id === senderId
                ? participants.renter_id
                : null;

    if (!recipientId) {
        logger.warn("Blocked message from non-participant", {
            conversationId: parsedConversationId,
            listingId: parsedListingId,
            userId: senderId,
        });
        return actionFailure("You are not part of this conversation.");
    }

    const { data: inserted, error } = await supabase
        .from("messages")
        .insert({
            conversation_id: parsedConversationId,
            sender_id: senderId,
            listing_id: parsedListingId,
            content: trimmed,
        })
        .select("id, conversation_id, sender_id, listing_id, content, created_at, read_at")
        .single();

    if (error || !inserted) {
        logger.error("Failed to insert chat message", {
            conversationId: parsedConversationId,
            listingId: parsedListingId,
            userId: senderId,
            error: error?.message,
        });
        return actionFailure("Failed to send message.");
    }

    // Idempotency keyed on the message id so retries dedupe correctly.
    const { data: notification, error: notificationError } = await supabase.from("notification_events").insert({
        recipient_id: recipientId,
        type: "new_message" as const,
        idempotency_key: `new_message:${inserted.id}`,
        payload: {
            conversationId: parsedConversationId,
            listingId: parsedListingId,
            message: "You have a new message.",
        },
    }).select("id").single();

    if (notificationError) {
        logger.warn("Failed to enqueue chat notification event", {
            conversationId: parsedConversationId,
            listingId: parsedListingId,
            messageId: inserted.id,
            recipientId,
            error: notificationError.message,
        });
    }

    if (notification?.id) {
        await enqueueNotificationEvent(notification.id);
    }

    return actionSuccess({ message: inserted, recipientId });
}

/**
 * Marks all inbound (not-sent-by-me) messages in a conversation as read.
 * Safe to call repeatedly; the `read_at is null` filter makes it idempotent.
 */
export async function markConversationRead(conversationId: string): Promise<ActionResult> {
    const parsedInput = idInputSchema.safeParse(conversationId);
    if (!parsedInput.success) return actionFailure("Invalid conversation id.");

    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return actionFailure("Unauthenticated");

    const { data: conversation } = await supabase
        .from("conversations")
        .select("id")
        .eq("id", parsedInput.data)
        .or(`renter_id.eq.${userData.user.id},landlord_id.eq.${userData.user.id}`)
        .maybeSingle();

    if (!conversation) {
        logger.warn("Blocked message read marker from non-participant", {
            conversationId: parsedInput.data,
            userId: userData.user.id,
        });
        return actionFailure("Conversation not found.");
    }

    const { error } = await supabase
        .from("messages")
        .update({ read_at: new Date().toISOString() })
        .eq("conversation_id", parsedInput.data)
        .neq("sender_id", userData.user.id)
        .is("read_at", null);

    if (error) return actionFailure(error.message);
    return actionSuccess(undefined);
}

export async function getMessages(conversationId: string) {
    const parsedInput = idInputSchema.safeParse(conversationId);
    if (!parsedInput.success) return [];

    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return [];

    const { data: conversation } = await supabase
        .from("conversations")
        .select("id")
        .eq("id", parsedInput.data)
        .or(`renter_id.eq.${userData.user.id},landlord_id.eq.${userData.user.id}`)
        .maybeSingle();

    if (!conversation) {
        logger.warn("Blocked message list read from non-participant", {
            conversationId: parsedInput.data,
            userId: userData.user.id,
        });
        return [];
    }

    const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", parsedInput.data)
        .order("created_at", { ascending: true });

    return data || [];
}

export async function getConversations() {
    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return [];

    const { data, error } = await supabase
        .from("conversations")
        .select(`
            *,
            listing:listings(title, address, price, listing_images(public_url)),
            renter:profiles!renter_id(id, email),
            landlord:profiles!landlord_id(id, email),
            messages (
                id,
                content,
                created_at,
                sender_id
            )
        `)
        .or(`renter_id.eq.${userData.user.id},landlord_id.eq.${userData.user.id}`)
        .order("created_at", { ascending: false });

    if (error || !data) return [];

    // Sort messages to get the latest one per conversation and format data
    const conversationsWithLatestMessage = data.map((convo) => {
        const sortedMessages = ((convo.messages as ConversationMessage[] | null) || []).sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        return {
            ...convo,
            latest_message: sortedMessages[0] || null
        };
    });

    // Sort conversations by latest message time
    return conversationsWithLatestMessage.sort((a, b) => {
        const timeA = a.latest_message ? new Date(a.latest_message.created_at).getTime() : new Date(a.created_at).getTime();
        const timeB = b.latest_message ? new Date(b.latest_message.created_at).getTime() : new Date(b.created_at).getTime();
        return timeB - timeA;
    });
}

export async function getOrCreateInquiryConversation(listingId: string) {
    const parsedInput = idInputSchema.safeParse(listingId);
    if (!parsedInput.success) return { success: false, error: "Invalid listing id" };

    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return { success: false, error: "Unauthenticated" };

    const renterId = userData.user.id;

    // Get the listing details to find the landlord
    const { data: listingData } = await supabase
        .from("listings")
        .select("landlord_id")
        .eq("id", parsedInput.data)
        .single();

    if (!listingData) return { success: false, error: "Listing not found" };

    if (listingData.landlord_id === renterId) {
        return { success: false, error: "Cannot message yourself about your own listing" };
    }

    // Check if conversation already exists
    const { data: existing } = await supabase
        .from("conversations")
        .select("id")
        .eq("listing_id", parsedInput.data)
        .eq("renter_id", renterId)
        .maybeSingle();

    if (existing) {
        return { success: true, conversationId: existing.id };
    }

    // Create a new inquiry conversation
    const { data: newConvo, error } = await supabase
        .from("conversations")
        .insert({
            listing_id: parsedInput.data,
            renter_id: renterId,
            landlord_id: listingData.landlord_id,
            type: "inquiry" as const,
        })
        .select("id")
        .single();

    if (error || !newConvo) {
        // A concurrent request may have created it first (unique listing_id+renter_id).
        const { data: raced } = await supabase
            .from("conversations")
            .select("id")
            .eq("listing_id", parsedInput.data)
            .eq("renter_id", renterId)
            .maybeSingle();
        if (raced) return { success: true, conversationId: raced.id };
        return { success: false, error: error?.message || "Failed to create conversation" };
    }

    return { success: true, conversationId: newConvo.id };
}

/**
 * Requests a video call from a listing card (Requirements 5.1, 5.2, 5.4).
 *
 * Reuses `getOrCreateInquiryConversation` to resolve (or create) the inquiry
 * conversation between the renter and the listing's landlord — which already
 * rejects calling about your own listing (Req 5.4) — then starts a call on that
 * conversation through the shared `startCall` path (Req 5.2). On success it
 * returns the `conversationId` alongside the new `CallSession` so the client can
 * route to `/messages/[conversationId]` with the call active (Req 5.3).
 *
 * Failures are propagated: if the conversation cannot be resolved/created, its
 * error is surfaced; if starting the call fails, that failure is returned.
 */
export async function requestListingVideoCall(
    listingId: string,
): Promise<ActionResult<{ conversationId: string; session: CallSession }>> {
    return requestListingCall(listingId, "video");
}

export async function requestListingVoiceCall(
    listingId: string,
): Promise<ActionResult<{ conversationId: string; session: CallSession }>> {
    return requestListingCall(listingId, "voice");
}

async function requestListingCall(
    listingId: string,
    mediaMode: "voice" | "video",
): Promise<ActionResult<{ conversationId: string; session: CallSession }>> {
    const parsedInput = idInputSchema.safeParse(listingId);
    if (!parsedInput.success) return actionFailure("Invalid listing id.");

    const conversation = await getOrCreateInquiryConversation(parsedInput.data);

    if (!conversation.success || !conversation.conversationId) {
        return actionFailure(conversation.error ?? "Failed to resolve the conversation.");
    }

    const conversationId = conversation.conversationId;
    const callResult = await startCall(conversationId, mediaMode);

    if (!callResult.success) {
        return callResult;
    }

    return actionSuccess({ conversationId, session: callResult.data.session });
}
