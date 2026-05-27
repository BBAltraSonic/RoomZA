"use server";

import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { enqueueNotificationEvent } from "@/features/notifications/outbox";

type ConversationMessage = {
    id: string;
    content: string;
    created_at: string;
    sender_id: string;
};

export async function getOrCreateApplicationConversation(applicationId: string) {
    const { user } = await requireRole("landlord");
    const supabase = await createClient();

    // Verify application and ownership
    const { data: application } = await supabase
        .from("applications")
        .select(`
            id, listing_id, renter_id,
            listing:listings!inner(landlord_id)
        `)
        .eq("id", applicationId)
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
        return { success: false, error: error?.message || "Failed to create conversation" };
    }

    return { success: true, conversationId: newConvo.id };
}

export async function getConversation(conversationId: string) {
    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return null;

    const { data, error } = await supabase
        .from("conversations")
        .select(`
            *,
            listing:listings(title, address, price, listing_images(public_url)),
            renter:profiles!renter_id(id, email),
            landlord:profiles!landlord_id(id, email)
        `)
        .eq("id", conversationId)
        .or(`renter_id.eq.${userData.user.id},landlord_id.eq.${userData.user.id}`)
        .single();

    if (error || !data) return null;
    return data;
}

export async function sendMessage(conversationId: string, content: string, listingId: string) {
    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return { success: false, error: "Unauthenticated" };

    if (!content || content.trim().length === 0) return { success: false, error: "Empty message" };

    const { error } = await supabase
        .from("messages")
        .insert({
            conversation_id: conversationId,
            sender_id: userData.user.id,
            listing_id: listingId,
            content: content.trim(),
        });

    if (error) return { success: false, error: error.message };

    // Create notification for the other participant
    const { data: convo } = await supabase
        .from("conversations")
        .select("renter_id, landlord_id")
        .eq("id", conversationId)
        .single();

    if (convo) {
        const recipientId =
            convo.renter_id === userData.user.id
                ? convo.landlord_id
                : convo.renter_id;

        if (recipientId) {
            const { data: notification } = await supabase.from("notification_events").insert({
                recipient_id: recipientId,
                type: "new_message" as const,
                idempotency_key: `new_message:${conversationId}:${Date.now()}`,
                payload: {
                    conversationId,
                    listingId,
                    message: "You have a new message.",
                },
            }).select("id").single();

            if (notification?.id) {
                await enqueueNotificationEvent(notification.id);
            }
        }
    }

    return { success: true };
}

export async function getMessages(conversationId: string) {
    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return [];

    const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
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
    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return { success: false, error: "Unauthenticated" };

    const renterId = userData.user.id;

    // Get the listing details to find the landlord
    const { data: listingData } = await supabase
        .from("listings")
        .select("landlord_id")
        .eq("id", listingId)
        .single();

    if (!listingData) return { success: false, error: "Listing not found" };

    if (listingData.landlord_id === renterId) {
        return { success: false, error: "Cannot message yourself about your own listing" };
    }

    // Check if conversation already exists
    const { data: existing } = await supabase
        .from("conversations")
        .select("id")
        .eq("listing_id", listingId)
        .eq("renter_id", renterId)
        .maybeSingle();

    if (existing) {
        return { success: true, conversationId: existing.id };
    }

    // Create a new inquiry conversation
    const { data: newConvo, error } = await supabase
        .from("conversations")
        .insert({
            listing_id: listingId,
            renter_id: renterId,
            landlord_id: listingData.landlord_id,
            type: "inquiry" as const,
        })
        .select("id")
        .single();

    if (error || !newConvo) {
        return { success: false, error: error?.message || "Failed to create conversation" };
    }

    return { success: true, conversationId: newConvo.id };
}
