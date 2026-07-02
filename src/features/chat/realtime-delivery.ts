import type { Database } from "@/lib/supabase/types";

export const CHAT_DELIVERY_EVENT = "message_delivered";
export const CHAT_DELIVERY_TIMEOUT_MS = 2_000;

export type ChatMessage = Database["public"]["Tables"]["messages"]["Row"];

export type MessageDeliveryAck = {
  messageId: string;
  conversationId: string;
  recipientId: string;
  deliveredAt: string;
};

export function shouldAcknowledgeMessage(message: ChatMessage, currentUserId: string) {
  return message.sender_id !== currentUserId;
}

export function isMessageDeliveryAck(value: unknown): value is MessageDeliveryAck {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.messageId === "string" &&
    candidate.messageId.length > 0 &&
    typeof candidate.conversationId === "string" &&
    candidate.conversationId.length > 0 &&
    typeof candidate.recipientId === "string" &&
    candidate.recipientId.length > 0 &&
    typeof candidate.deliveredAt === "string" &&
    !Number.isNaN(Date.parse(candidate.deliveredAt))
  );
}

export function matchesExpectedDeliveryAck(
  ack: MessageDeliveryAck,
  expected: Pick<MessageDeliveryAck, "messageId" | "conversationId" | "recipientId">,
) {
  return (
    ack.messageId === expected.messageId &&
    ack.conversationId === expected.conversationId &&
    ack.recipientId === expected.recipientId
  );
}

export function deliveryTimeoutMessage(timeoutMs = CHAT_DELIVERY_TIMEOUT_MS) {
  return `Delivery could not be confirmed within ${Math.round(timeoutMs / 1_000)}s.`;
}
