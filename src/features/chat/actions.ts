"use server";

import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";

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

    // Check if conversation already exists
    const { data: existing } = await supabase
        .from("conversations")
        .select("id")
        .eq("application_id", applicationId)
        .eq("type", "application" as const)
        .maybeSingle();

    if (existing) {
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
            await supabase.from("notification_events").insert({
                recipient_id: recipientId,
                type: "new_message" as const,
                payload: {
                    conversationId,
                    listingId,
                    message: "You have a new message.",
                },
            });
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
