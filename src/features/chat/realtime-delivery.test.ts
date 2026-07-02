import { describe, expect, it } from "vitest";

import {
  deliveryTimeoutMessage,
  isMessageDeliveryAck,
  matchesExpectedDeliveryAck,
  shouldAcknowledgeMessage,
  type ChatMessage,
} from "./realtime-delivery";

const baseMessage: ChatMessage = {
  id: "message-1",
  conversation_id: "conversation-1",
  listing_id: "listing-1",
  sender_id: "landlord-1",
  content: "Hello",
  created_at: "2026-07-01T10:00:00.000Z",
  read_at: null,
};

describe("chat realtime delivery acknowledgement", () => {
  it("acknowledges only inbound messages", () => {
    expect(shouldAcknowledgeMessage(baseMessage, "renter-1")).toBe(true);
    expect(shouldAcknowledgeMessage(baseMessage, "landlord-1")).toBe(false);
  });

  it("accepts well-formed delivery acknowledgements", () => {
    expect(
      isMessageDeliveryAck({
        messageId: "message-1",
        conversationId: "conversation-1",
        recipientId: "renter-1",
        deliveredAt: "2026-07-01T10:00:01.000Z",
      }),
    ).toBe(true);
  });

  it("rejects malformed delivery acknowledgements", () => {
    expect(isMessageDeliveryAck(null)).toBe(false);
    expect(isMessageDeliveryAck({ messageId: "message-1" })).toBe(false);
    expect(
      isMessageDeliveryAck({
        messageId: "message-1",
        conversationId: "conversation-1",
        recipientId: "renter-1",
        deliveredAt: "not-a-date",
      }),
    ).toBe(false);
  });

  it("matches acknowledgements to the expected message and recipient", () => {
    const ack = {
      messageId: "message-1",
      conversationId: "conversation-1",
      recipientId: "renter-1",
      deliveredAt: "2026-07-01T10:00:01.000Z",
    };

    expect(matchesExpectedDeliveryAck(ack, ack)).toBe(true);
    expect(matchesExpectedDeliveryAck(ack, { ...ack, recipientId: "landlord-1" })).toBe(false);
  });

  it("uses the explicit two-second delivery timeout message", () => {
    expect(deliveryTimeoutMessage()).toContain("2s");
  });
});
