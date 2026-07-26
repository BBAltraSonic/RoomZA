import { getConversation, getMessages } from "@/features/chat/actions";
import { getActiveCall } from "@/features/chat/call-actions";
import { notFound } from "next/navigation";
import { ChatHeader } from "@/features/chat/chat-header";
import { ChatBox } from "@/features/chat/chat-box";
import { ConversationCallProvider } from "@/features/chat/conversation-call-provider";
import { ConversationJourneyPanel } from "@/features/chat/conversation-journey-panel";
import { getConversationJourney } from "@/features/chat/conversation-journey-actions";
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

    const [messages, activeCallResult, journey] = await Promise.all([
        getMessages(id),
        getActiveCall(conversation.id),
        conversation.application_id
            ? getConversationJourney(conversation.application_id)
            : Promise.resolve(null),
    ]);
    const initialSession = activeCallResult.success ? activeCallResult.data.session : null;

    return (
        <div className="flex h-dvh flex-col bg-background">
            <ConversationCallProvider
                conversationId={conversation.id}
                currentUserId={currentUserId}
                initialSession={initialSession}
                callerName={otherPersonName}
                sidebar={
                    <ConversationJourneyPanel
                        journey={journey}
                        conversationId={conversation.id}
                        applicationId={conversation.application_id}
                        listingId={conversation.listing_id}
                        listingTitle={conversation.listing.title}
                        isLandlord={isLandlord}
                    />
                }
                header={
                    <ChatHeader
                        conversation={conversation}
                        backUrl="/messages"
                        reportedUserId={isLandlord ? conversation.renter_id : conversation.landlord_id}
                        otherPresence={
                            otherPerson?.presence_status === "available" || otherPerson?.presence_status === "busy"
                                ? otherPerson.presence_status
                                : "offline"
                        }
                    />
                }
            >
                <div className="h-full overflow-hidden bg-panel">
                    <ChatBox
                        initialMessages={messages}
                        conversationId={conversation.id}
                        listingId={conversation.listing_id}
                        currentUserId={currentUserId}
                        otherPersonName={otherPersonName}
                    />
                </div>
            </ConversationCallProvider>
        </div>
    );
}
