import { getConversation, getMessages } from "@/features/chat/actions";
import { notFound } from "next/navigation";
import { ChatHeader } from "@/features/chat/chat-header";
import { ChatBox } from "@/features/chat/chat-box";
import { createClient } from "@/lib/supabase/server";

function getProfileDisplayName(profile: { email?: string | null } | null | undefined) {
    if (!profile?.email) return "User";
    return profile.email.split("@")[0] || "User";
}

export default async function MessagePage({ params }: { params: Promise<{ id: string }> }) {
    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) notFound();
    const currentUserId = userData.user.id;
    const { id } = await params;

    const conversation = await getConversation(id);
    if (!conversation) notFound();

    const isLandlord = conversation.landlord_id === currentUserId;
    // The joined relation might return an array or single object depending on PostgREST inference
    const renter = Array.isArray(conversation.renter) ? conversation.renter[0] : conversation.renter;
    const landlord = Array.isArray(conversation.landlord) ? conversation.landlord[0] : conversation.landlord;

    const otherPerson = isLandlord ? renter : landlord;
    const otherPersonName = getProfileDisplayName(otherPerson);

    const messages = await getMessages(id);

    return (
        <div className="flex h-screen flex-col bg-background">
            <ChatHeader
                conversation={conversation}
                backUrl={isLandlord ? `/dashboard/listings/${conversation.listing_id}/applicants` : "/applications"}
            />
            <div className="flex flex-1 items-center justify-center overflow-hidden bg-warm-surface">
                <div className="h-full w-full max-w-4xl border-x border-border bg-panel">
                    <ChatBox
                        initialMessages={messages}
                        conversationId={conversation.id}
                        listingId={conversation.listing_id}
                        currentUserId={currentUserId}
                        otherPersonName={otherPersonName}
                    />
                </div>
            </div>
        </div>
    );
}
