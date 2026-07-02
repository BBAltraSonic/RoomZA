import { getConversation, getMessages } from "@/features/chat/actions";
import { getActiveCall } from "@/features/chat/call-actions";
import { notFound } from "next/navigation";
import { ChatHeader } from "@/features/chat/chat-header";
import { ChatBox } from "@/features/chat/chat-box";
import { ConversationCallProvider } from "@/features/chat/conversation-call-provider";
import { requireUser } from "@/lib/auth";

import { getProfileDisplayName } from "@/lib/utils";

export default async function MessagePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const { user } = await requireUser({ redirectTo: `/messages/${id}` });
    const currentUserId = user.id;

    const conversation = await getConversation(id);
    if (!conversation) notFound();

    const isLandlord = conversation.landlord_id === currentUserId;
    // The joined relation might return an array or single object depending on PostgREST inference
    const renter = Array.isArray(conversation.renter) ? conversation.renter[0] : conversation.renter;
    const landlord = Array.isArray(conversation.landlord) ? conversation.landlord[0] : conversation.landlord;

    const otherPerson = isLandlord ? renter : landlord;
    const otherPersonName = getProfileDisplayName(otherPerson);

    const messages = await getMessages(id);

    const activeCallResult = await getActiveCall(conversation.id);
    const initialSession = activeCallResult.success ? activeCallResult.data.session : null;

    return (
        <div className="flex h-dvh flex-col bg-background">
            <ChatHeader
                conversation={conversation}
                backUrl="/messages"
            />
            <div className="flex flex-1 items-center justify-center overflow-hidden bg-warm-surface">
                <div className="h-full w-full max-w-4xl border-x border-border bg-panel">
                    <ConversationCallProvider
                        conversationId={conversation.id}
                        currentUserId={currentUserId}
                        initialSession={initialSession}
                        callerName={otherPersonName}
                    >
                        <ChatBox
                            initialMessages={messages}
                            conversationId={conversation.id}
                            listingId={conversation.listing_id}
                            currentUserId={currentUserId}
                            otherPersonName={otherPersonName}
                        />
                    </ConversationCallProvider>
                </div>
            </div>
        </div>
    );
}
