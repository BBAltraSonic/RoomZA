// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CallSession } from "./call-actions";

const mocks = vi.hoisted(() => ({ start: vi.fn(), active: vi.fn(), join: vi.fn(), decline: vi.fn(), end: vi.fn(), listing: vi.fn(), push: vi.fn(), toast: vi.fn() }));
vi.mock("./call-actions", () => ({ startCall: mocks.start, getActiveCall: mocks.active, joinCall: mocks.join, declineCall: mocks.decline, endCall: mocks.end }));
vi.mock("./actions", () => ({ requestListingVideoCall: mocks.listing }));
vi.mock("./conversation-call-provider", () => ({ useConversationCallController: () => null }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("sonner", () => ({ toast: { error: mocks.toast, info: vi.fn() } }));
vi.mock("@/lib/supabase/browser", () => ({ createClient: () => ({ channel: () => { const channel = { on: () => channel, subscribe: () => channel }; return channel; }, removeChannel: vi.fn() }) }));
import { CallButton } from "./call-button";
import { ListingVideoCallButton } from "./listing-video-call-button";
import { IncomingCallBanner } from "./incoming-call-banner";
import { ConversationCall } from "./conversation-call";

function session(status: CallSession["status"] = "ringing"): CallSession {
  return { id: "call-1", conversation_id: "thread-1", listing_id: "home-1", caller_id: "owner-1", callee_id: "renter-1", status, provider: "jitsi", media_mode: "video", room_id: "fixture-room", join_url: "https://meet.jit.si/fixture-room", started_at: new Date().toISOString(), created_at: new Date().toISOString(), answered_at: null, ended_at: null };
}
function pending<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
beforeEach(() => {
  vi.clearAllMocks();
  for (const mock of [mocks.start, mocks.active, mocks.join, mocks.decline, mocks.end, mocks.listing]) mock.mockReset();
  mocks.active.mockResolvedValue({ success: true, data: { session: session("active") } });
});
afterEach(cleanup);

describe("Call controls under uncertain transport", () => {
  it("releases Start after a thrown request and explains that its outcome is uncertain", async () => {
    mocks.start.mockRejectedValue(new Error("Transport lost"));
    render(<CallButton conversationId="thread-1" />);
    fireEvent.click(screen.getByRole("button", { name: "Start video call" }));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.stringMatching(/could not be confirmed/i), { style: { pointerEvents: "none" } }));
    expect(screen.getByRole("button", { name: "Start video call" })).toBeEnabled();
  });
  it("sends one start request for same-turn double activation", async () => {
    mocks.start.mockReturnValue(new Promise(() => {}));
    render(<CallButton conversationId="thread-1" />);
    const button = screen.getByRole("button", { name: "Start video call" });
    act(() => { fireEvent.click(button); fireEvent.click(button); });
    expect(mocks.start).toHaveBeenCalledTimes(1);
  });
  it("releases Start if restoring an already committed call throws", async () => {
    mocks.start.mockResolvedValue({ success: false, error: "A call is already active in this conversation." });
    mocks.active.mockRejectedValue(new Error("Read unavailable"));
    render(<CallButton conversationId="thread-1" />);
    fireEvent.click(screen.getByRole("button", { name: "Start video call" }));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.stringMatching(/could not be confirmed/i), { style: { pointerEvents: "none" } }));
    expect(screen.getByRole("button", { name: "Start video call" })).toBeEnabled();
  });
  it("does not describe a failed call-status read as a vanished call", async () => {
    mocks.start.mockResolvedValue({ success: false, error: "A call is already active in this conversation." });
    mocks.active.mockResolvedValue({ success: false, error: "Call status could not be loaded. Try again." });
    render(<CallButton conversationId="thread-1" />);
    fireEvent.click(screen.getByRole("button", { name: "Start video call" }));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith("Call status could not be loaded. Try again.", { style: { pointerEvents: "none" } }));
    expect(mocks.toast).not.toHaveBeenCalledWith("That call is no longer available.", expect.anything());
    expect(screen.getByRole("button", { name: "Start video call" })).toBeEnabled();
  });
  it("does not publish an old conversation's late start into the next conversation", async () => {
    const request = pending<{ success: true; data: { session: CallSession } }>(); mocks.start.mockReturnValue(request.promise);
    const publish = vi.fn();
    const view = render(<CallButton conversationId="thread-1" onCallStarted={publish} />);
    fireEvent.click(screen.getByRole("button", { name: "Start video call" }));
    view.rerender(<CallButton conversationId="thread-2" onCallStarted={publish} />);
    await act(async () => request.resolve({ success: true, data: { session: session() } }));
    expect(publish).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Start video call" })).toBeEnabled();
  });
  it("recovers the listing call action after a thrown request", async () => {
    mocks.listing.mockRejectedValue(new Error("Transport lost"));
    render(<ListingVideoCallButton listingId="home-1" />);
    fireEvent.click(screen.getByRole("button", { name: "Video call" }));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.stringMatching(/could not be confirmed/i), { style: { pointerEvents: "none" } }));
    expect(screen.getByRole("button", { name: "Video call" })).toBeEnabled(); expect(mocks.push).not.toHaveBeenCalled();
  });
  it("does not navigate from a listing action that belongs to a previous card", async () => {
    const request = pending<{ success: true; data: { conversationId: string } }>(); mocks.listing.mockReturnValue(request.promise);
    const view = render(<ListingVideoCallButton listingId="home-1" />);
    fireEvent.click(screen.getByRole("button", { name: "Video call" }));
    view.rerender(<ListingVideoCallButton listingId="home-2" />);
    await act(async () => request.resolve({ success: true, data: { conversationId: "thread-1" } }));
    expect(mocks.push).not.toHaveBeenCalled(); expect(screen.getByRole("button", { name: "Video call" })).toBeEnabled();
  });
  it("sends one listing request and keeps navigation pending until it commits", async () => {
    const request = pending<{ success: true; data: { conversationId: string } }>(); mocks.listing.mockReturnValue(request.promise);
    render(<ListingVideoCallButton listingId="home-1" />);
    const button = screen.getByRole("button", { name: "Video call" });
    act(() => { fireEvent.click(button); fireEvent.click(button); }); expect(mocks.listing).toHaveBeenCalledTimes(1);
    await act(async () => request.resolve({ success: true, data: { conversationId: "thread-1" } }));
    expect(mocks.push).toHaveBeenCalledWith("/messages/thread-1"); expect(button).toBeDisabled();
  });
  for (const action of ["Accept", "Decline"] as const) {
    it(`keeps ${action} usable after a thrown request`, async () => {
      (action === "Accept" ? mocks.join : mocks.decline).mockRejectedValue(new Error("Transport lost"));
      mocks.active.mockRejectedValue(new Error("Read also unavailable"));
      render(<IncomingCallBanner conversationId="thread-1" currentUserId="renter-1" initialSession={session()} />);
      fireEvent.click(screen.getByRole("button", { name: `${action} call` }));
      expect(await screen.findByText(/could not be confirmed/i)).toBeVisible();
      expect(screen.getByRole("button", { name: "Accept call" })).toBeEnabled(); expect(screen.getByRole("button", { name: "Decline call" })).toBeEnabled();
    });
  }
  it("locks competing accept/decline events synchronously", () => {
    mocks.join.mockReturnValue(new Promise(() => {})); mocks.decline.mockReturnValue(new Promise(() => {}));
    render(<IncomingCallBanner conversationId="thread-1" currentUserId="renter-1" initialSession={session()} />);
    const accept = screen.getByRole("button", { name: "Accept call" }), decline = screen.getByRole("button", { name: "Decline call" });
    act(() => { fireEvent.click(accept); fireEvent.click(decline); });
    expect(mocks.join).toHaveBeenCalledTimes(1); expect(mocks.decline).not.toHaveBeenCalled();
  });
  it("reconciles an accepted call without requiring a realtime event", async () => {
    mocks.join.mockResolvedValue({ success: true, data: { status: "active" } });
    const publish = vi.fn(); const active = session("active"); mocks.active.mockResolvedValue({ success: true, data: { session: active } });
    render(<IncomingCallBanner conversationId="thread-1" currentUserId="renter-1" initialSession={session()} onSessionUpdate={publish} />);
    fireEvent.click(screen.getByRole("button", { name: "Accept call" }));
    await waitFor(() => expect(publish).toHaveBeenCalledWith(active));
  });
  it("drops a declined invitation even if realtime never delivers its terminal event", async () => {
    mocks.decline.mockResolvedValue({ success: true, data: { status: "declined" } });
    mocks.active.mockResolvedValue({ success: true, data: { session: null } }); const publish = vi.fn();
    render(<IncomingCallBanner conversationId="thread-1" currentUserId="renter-1" initialSession={session()} onSessionUpdate={publish} />);
    fireEvent.click(screen.getByRole("button", { name: "Decline call" }));
    await waitFor(() => expect(publish).toHaveBeenCalledWith(null));
  });
  it("ignores an old invitation's late accept after another call replaces it", async () => {
    const request = pending<{ success: true; data: { status: "active" } }>(); mocks.join.mockReturnValue(request.promise); const publish = vi.fn();
    const view = render(<IncomingCallBanner conversationId="thread-1" currentUserId="renter-1" initialSession={session()} onSessionUpdate={publish} />);
    fireEvent.click(screen.getByRole("button", { name: "Accept call" }));
    view.rerender(<IncomingCallBanner conversationId="thread-1" currentUserId="renter-1" initialSession={{ ...session(), id: "call-2" }} onSessionUpdate={publish} />);
    await act(async () => request.resolve({ success: true, data: { status: "active" } }));
    expect(publish).not.toHaveBeenCalled(); expect(mocks.active).not.toHaveBeenCalled(); expect(screen.getByRole("button", { name: "Accept call" })).toBeEnabled();
  });
  it("keeps End call usable and retains the call surface after transport rejection", async () => {
    mocks.end.mockRejectedValue(new Error("Transport lost"));
    const ended = vi.fn(); render(<ConversationCall session={session("active")} onEnded={ended} />);
    fireEvent.click(screen.getByRole("button", { name: "End call" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not be confirmed/i);
    expect(screen.getByRole("button", { name: "End call" })).toBeEnabled(); expect(ended).not.toHaveBeenCalled();
    expect(screen.getByTitle("Pinpoints video call fixture-room")).toBeInTheDocument();
  });
  it("sends one end request for same-turn double activation", () => {
    mocks.end.mockReturnValue(new Promise(() => {})); render(<ConversationCall session={session("active")} />);
    const button = screen.getByRole("button", { name: "End call" });
    act(() => { fireEvent.click(button); fireEvent.click(button); }); expect(mocks.end).toHaveBeenCalledTimes(1);
  });
  it("does not dismiss a new call when an old End response arrives", async () => {
    const request = pending<{ success: true; data: { status: "ended" } }>(); mocks.end.mockReturnValue(request.promise); const ended = vi.fn();
    const view = render(<ConversationCall session={session("active")} onEnded={ended} />);
    fireEvent.click(screen.getByRole("button", { name: "End call" }));
    view.rerender(<ConversationCall session={{ ...session("active"), id: "call-2" }} onEnded={ended} />);
    await act(async () => request.resolve({ success: true, data: { status: "ended" } }));
    expect(ended).not.toHaveBeenCalled(); expect(screen.getByRole("button", { name: "End call" })).toBeEnabled();
  });
});
