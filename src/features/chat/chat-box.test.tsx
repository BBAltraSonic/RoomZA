// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  markConversationRead: vi.fn(),
  sendMessage: vi.fn(),
  removeChannel: vi.fn(),
}));

vi.mock("./actions", () => ({
  markConversationRead: mocks.markConversationRead,
  sendMessage: mocks.sendMessage,
}));

vi.mock("@/features/admin/components/report-panel", () => ({
  ReportPanel: () => null,
}));

vi.mock("@/lib/supabase/browser", () => ({
  createClient: () => {
    const channel = {
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn((callback: (status: string) => void) => {
        callback("SUBSCRIBED");
        return channel;
      }),
    };

    return {
      channel: vi.fn(() => channel),
      removeChannel: mocks.removeChannel,
    };
  },
}));

import { ChatBox } from "./chat-box";

beforeEach(() => {
  mocks.markConversationRead.mockReset().mockResolvedValue({ success: true });
  mocks.sendMessage.mockReset().mockResolvedValue({
    success: true,
    data: {
      recipientId: "landlord-1",
      message: {
        id: "message-1",
        conversation_id: "conversation-1",
        listing_id: "listing-1",
        sender_id: "renter-1",
        content: "Hi",
        created_at: "2026-07-18T16:28:00.000Z",
        read_at: null,
      },
    },
  });
  mocks.removeChannel.mockReset();
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
});

afterEach(() => cleanup());

describe("ChatBox message delivery", () => {
  it("marks a persisted message as sent without waiting for the recipient to be online", async () => {
    render(
      <ChatBox
        initialMessages={[]}
        conversationId="conversation-1"
        listingId="listing-1"
        currentUserId="renter-1"
        otherPersonName="Landlord"
      />,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Message content" }), {
      target: { value: "Hi" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    expect(await screen.findByLabelText("Sent")).toBeVisible();
    expect(mocks.sendMessage).toHaveBeenCalledWith("conversation-1", "Hi", "listing-1");
    expect(screen.queryByText(/Delivery could not be confirmed/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Tap to retry/i)).not.toBeInTheDocument();
  });
});
