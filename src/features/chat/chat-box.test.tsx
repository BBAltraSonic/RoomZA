// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  markConversationRead: vi.fn(),
  sendMessage: vi.fn(),
  refreshConversationMessages: vi.fn(),
  removeChannel: vi.fn(),
  listeners: {} as Record<string, (payload: { new: Record<string, unknown> }) => void>,
  connectionStatus: null as ((status: string) => void) | null,
}));

vi.mock("./actions", () => ({
  markConversationRead: mocks.markConversationRead,
  sendMessage: mocks.sendMessage,
  refreshConversationMessages: mocks.refreshConversationMessages,
}));

vi.mock("@/features/admin/components/report-panel", () => ({
  ReportPanel: () => null,
}));

vi.mock("@/lib/supabase/browser", () => ({
  createClient: () => {
    const channel = {
      on: vi.fn((_kind: string, filter: { event: string }, callback: (payload: { new: Record<string, unknown> }) => void) => {
        mocks.listeners[filter.event] = callback;
        return channel;
      }),
      subscribe: vi.fn((callback: (status: string) => void) => {
        mocks.connectionStatus = callback;
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
  mocks.refreshConversationMessages.mockReset().mockResolvedValue({ success: true, data: { messages: [] } });
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
  mocks.listeners = {};
  mocks.connectionStatus = null;
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
});

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const pendingId = "7d0a3124-d0ea-43e0-b6dd-4f39c5e27dc6";
function delivered(id = pendingId, readAt: string | null = null) {
  return { success: true as const, data: { recipientId: "landlord-1", message: {
    id, conversation_id: "conversation-1", listing_id: "listing-1", sender_id: "renter-1",
    content: "Hi", created_at: "2026-07-18T16:28:00.000Z", read_at: readAt,
  } } };
}
function deferred() {
  let resolve!: (result: ReturnType<typeof delivered>) => void;
  const promise = new Promise<ReturnType<typeof delivered>>(done => { resolve = done; });
  return { promise, resolve };
}
function compose() {
  vi.spyOn(crypto, "randomUUID").mockReturnValue(pendingId);
  render(<ChatBox initialMessages={[]} conversationId="conversation-1" listingId="listing-1" currentUserId="renter-1" otherPersonName="Landlord" />);
  const input = screen.getByRole("textbox", { name: "Message content" });
  fireEvent.change(input, { target: { value: "Hi" } });
  return input.closest("form")!;
}

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
    expect(mocks.sendMessage).toHaveBeenCalledWith("conversation-1", "Hi", "listing-1", expect.any(String));
    expect(screen.queryByText(/Delivery could not be confirmed/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Tap to retry/i)).not.toBeInTheDocument();
  });

  it("recovers from a thrown send and retries with the original message identity", async () => {
    mocks.sendMessage.mockRejectedValueOnce(new Error("Synthetic transport failure")).mockResolvedValue(delivered());
    fireEvent.submit(compose());
    expect(await screen.findByRole("button", { name: /retry/i })).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent(/could not be confirmed/i);
    expect(screen.queryByLabelText("Sending")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(await screen.findByLabelText("Sent")).toBeVisible();
    expect(mocks.sendMessage.mock.calls).toEqual([
      ["conversation-1", "Hi", "listing-1", pendingId],
      ["conversation-1", "Hi", "listing-1", pendingId],
    ]);
    expect(screen.getAllByText("Hi")).toHaveLength(1);
  });

  it("blocks duplicate submit events before React commits pending state", async () => {
    const pending = deferred(); mocks.sendMessage.mockReturnValue(pending.promise);
    const form = compose();
    act(() => { fireEvent.submit(form); fireEvent.submit(form); });
    expect(mocks.sendMessage).toHaveBeenCalledTimes(1);
    await act(async () => pending.resolve(delivered()));
    expect(screen.getAllByText("Hi")).toHaveLength(1);
  });

  it("locks a retry until its existing request finishes", async () => {
    const pending = deferred();
    mocks.sendMessage.mockResolvedValueOnce({ success: false, error: "Unauthenticated" }).mockReturnValue(pending.promise);
    fireEvent.submit(compose());
    const retry = await screen.findByRole("button", { name: /retry/i });
    act(() => { fireEvent.click(retry); fireEvent.click(retry); });
    expect(mocks.sendMessage).toHaveBeenCalledTimes(2);
    await act(async () => pending.resolve(delivered()));
    expect(await screen.findByLabelText("Sent")).toBeVisible();
  });

  it("keeps a realtime confirmation and read receipt when the HTTP response arrives later", async () => {
    const pending = deferred(); mocks.sendMessage.mockReturnValue(pending.promise);
    fireEvent.submit(compose());
    act(() => mocks.listeners.INSERT!({ new: delivered().data.message }));
    expect(screen.getByLabelText("Sent")).toBeVisible();
    act(() => mocks.listeners.UPDATE!({ new: delivered(pendingId, "2026-07-18T16:29:00.000Z").data.message }));
    await act(async () => pending.resolve(delivered()));
    expect(screen.getByLabelText("Seen")).toBeVisible();
    expect(screen.getAllByText("Hi")).toHaveLength(1);
  });

  it("does not confuse another message with identical text for this pending send", async () => {
    const pending = deferred(); mocks.sendMessage.mockReturnValue(pending.promise);
    fireEvent.submit(compose());
    act(() => mocks.listeners.INSERT!({ new: delivered("ee90d51c-10b8-45bd-9490-2d35df60b704").data.message }));
    expect(screen.getAllByText("Hi")).toHaveLength(2);
    expect(screen.getByLabelText("Sending")).toBeVisible();
    await act(async () => pending.resolve(delivered()));
    expect(screen.getAllByText("Hi")).toHaveLength(2);
  });

  it("does not downgrade a realtime-confirmed send when the action subsequently fails", async () => {
    let reject!: (error: Error) => void;
    mocks.sendMessage.mockReturnValue(new Promise((_resolve, fail) => { reject = fail; }));
    fireEvent.submit(compose());
    act(() => mocks.listeners.INSERT!({ new: delivered().data.message }));
    await act(async () => reject(new Error("Lost action response")));
    await waitFor(() => expect(screen.queryByLabelText("Sending")).not.toBeInTheDocument());
    expect(screen.getByLabelText("Sent")).toBeVisible();
    expect(screen.queryByRole("button", { name: /retry/i })).not.toBeInTheDocument();
  });

  it("keeps a failed-send explanation visible when realtime reconnects", async () => {
    mocks.sendMessage.mockResolvedValue({ success: false, error: "Unauthenticated" });
    fireEvent.submit(compose());
    expect(await screen.findByRole("alert")).toHaveTextContent("Unauthenticated");
    act(() => mocks.connectionStatus!("SUBSCRIBED"));
    expect(screen.getByRole("alert")).toHaveTextContent("Unauthenticated");
    expect(screen.getByRole("button", { name: /retry/i })).toBeVisible();
  });

  it("removes an old thread's pending state when the conversation changes", async () => {
    const pending = deferred(); mocks.sendMessage.mockReturnValue(pending.promise);
    const view = render(<ChatBox initialMessages={[]} conversationId="conversation-1" listingId="listing-1" currentUserId="renter-1" otherPersonName="Landlord" />);
    fireEvent.change(screen.getByRole("textbox", { name: "Message content" }), { target: { value: "Hi" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    view.rerender(<ChatBox initialMessages={[]} conversationId="conversation-2" listingId="listing-2" currentUserId="renter-1" otherPersonName="Another owner" />);
    await act(async () => pending.resolve(delivered()));
    expect(screen.queryByText("Hi")).not.toBeInTheDocument();
    expect(screen.getByText("Start the conversation with Another owner")).toBeVisible();
  });

  it("loads messages missed between the initial render and a subscription", async () => {
    const missed = { ...delivered().data.message, sender_id: "landlord-1", content: "Missed while disconnected" };
    mocks.refreshConversationMessages.mockResolvedValue({ success: true, data: { messages: [missed] } });
    compose();
    expect(await screen.findByText(missed.content)).toBeVisible();
    act(() => mocks.listeners.INSERT!({ new: missed }));
    expect(screen.getAllByText(missed.content)).toHaveLength(1);
  });

  it("reloads messages when realtime reconnects", async () => {
    compose();
    const missed = { ...delivered().data.message, sender_id: "landlord-1", content: "Arrived offline" };
    await waitFor(() => expect(mocks.refreshConversationMessages).toHaveBeenCalledTimes(1));
    mocks.refreshConversationMessages.mockResolvedValue({ success: true, data: { messages: [missed] } });
    act(() => mocks.connectionStatus!("CHANNEL_ERROR"));
    act(() => mocks.connectionStatus!("SUBSCRIBED"));
    expect(await screen.findByText(missed.content)).toBeVisible();
    expect(mocks.refreshConversationMessages).toHaveBeenCalledTimes(2);
  });

  it("keeps existing history during a refresh failure and offers a real retry", async () => {
    const existing = { ...delivered().data.message, content: "Existing history" };
    mocks.refreshConversationMessages.mockResolvedValueOnce({ success: false, error: "Messages could not be loaded. Try again." })
      .mockResolvedValue({ success: true, data: { messages: [existing] } });
    render(<ChatBox initialMessages={[existing]} conversationId="conversation-1" listingId="listing-1" currentUserId="renter-1" otherPersonName="Landlord" />);
    const retry = await screen.findByRole("button", { name: "Reload messages" });
    expect(screen.getByText(existing.content)).toBeVisible();
    fireEvent.click(retry);
    await waitFor(() => expect(screen.queryByText(/could not be loaded/i)).not.toBeInTheDocument());
    expect(screen.getByText(existing.content)).toBeVisible();
    expect(mocks.refreshConversationMessages).toHaveBeenCalledTimes(2);
  });

  it("does not discard a realtime event arriving during an older snapshot read", async () => {
    let resolve!: (value: unknown) => void;
    mocks.refreshConversationMessages.mockReturnValue(new Promise(done => { resolve = done; }));
    compose();
    expect(mocks.refreshConversationMessages).toHaveBeenCalledTimes(1);
    const incoming = { ...delivered().data.message, sender_id: "landlord-1", content: "Newer than the snapshot" };
    act(() => mocks.listeners.INSERT!({ new: incoming }));
    await act(async () => resolve({ success: true, data: { messages: [] } }));
    expect(screen.getByText(incoming.content)).toBeVisible();
  });

  it("reconciles a failed optimistic message after a refresh confirms it was saved", async () => {
    mocks.sendMessage.mockRejectedValue(new Error("Lost action response"));
    fireEvent.submit(compose());
    expect(await screen.findByRole("button", { name: /retry/i })).toBeVisible();
    mocks.refreshConversationMessages.mockResolvedValue({ success: true, data: { messages: [delivered().data.message] } });
    act(() => mocks.connectionStatus!("SUBSCRIBED"));
    expect(await screen.findByLabelText("Sent")).toBeVisible();
    expect(screen.queryByRole("button", { name: /retry/i })).not.toBeInTheDocument();
    expect(screen.getAllByText("Hi")).toHaveLength(1);
  });

  it("offers a refresh after an unexpectedly closed realtime channel", async () => {
    compose();
    await waitFor(() => expect(mocks.refreshConversationMessages).toHaveBeenCalledTimes(1));
    act(() => mocks.connectionStatus!("CLOSED"));
    expect(screen.getByRole("button", { name: "Reload messages" })).toBeVisible();
  });

  it("does not announce old history as new messages after a refresh", async () => {
    const existing = { ...delivered().data.message, sender_id: "landlord-1", content: "Existing history" };
    mocks.refreshConversationMessages.mockResolvedValue({ success: true, data: { messages: [existing] } });
    render(<ChatBox initialMessages={[existing]} conversationId="conversation-1" listingId="listing-1" currentUserId="renter-1" otherPersonName="Landlord" />);
    await waitFor(() => expect(mocks.refreshConversationMessages).toHaveBeenCalledTimes(1));
    const scroller = screen.getByText(existing.content).closest(".scroll-contained")!;
    Object.defineProperties(scroller, { scrollHeight: { configurable: true, value: 2000 }, clientHeight: { configurable: true, value: 500 } });
    fireEvent.scroll(scroller);
    act(() => mocks.connectionStatus!("SUBSCRIBED"));
    await waitFor(() => expect(mocks.refreshConversationMessages).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("button", { name: "Newest" })).toBeVisible();
    expect(screen.queryByRole("button", { name: /\d+ new/ })).not.toBeInTheDocument();
  });
});
