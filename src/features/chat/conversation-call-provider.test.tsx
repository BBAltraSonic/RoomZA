// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import type { ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CallSession } from "./call-actions";
const mocks = vi.hoisted(() => ({ read: vi.fn(), update: null as null | ((session: CallSession | null) => void), reconnect: null as null | (() => void) }));
vi.mock("./call-actions", () => ({ getActiveCall: mocks.read }));
vi.mock("./incoming-call-banner", () => ({ IncomingCallBanner: ({ onSessionUpdate, onReconnect }: { onSessionUpdate: (session: CallSession | null) => void; onReconnect?: () => void }) => { mocks.update = onSessionUpdate; mocks.reconnect = onReconnect ?? null; return null; } }));
vi.mock("next/dynamic", () => ({ default: () => ({ session }: { session: CallSession }) => <div role="region" aria-label={`Active call ${session.id}`} /> }));
import { ConversationCallProvider } from "./conversation-call-provider";

const active: CallSession = { id: "call-1", conversation_id: "thread-1", listing_id: "listing-1", caller_id: "owner-1", callee_id: "renter-1", status: "active", provider: "jitsi", media_mode: "video", room_id: "fixture", join_url: "https://meet.jit.si/fixture", started_at: "2026-10-16T00:00:00Z", created_at: "2026-10-16T00:00:00Z", answered_at: "2026-10-16T00:00:01Z", ended_at: null };
function host(props: { conversationId?: string; children?: ReactNode } = {}) { return <ConversationCallProvider conversationId="thread-1" currentUserId="renter-1" {...props}><span>Conversation retained</span></ConversationCallProvider>; }
function pending<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
beforeEach(() => { vi.clearAllMocks(); mocks.read.mockReset().mockResolvedValue({ success: true, data: { session: null } }); mocks.update = null; mocks.reconnect = null; });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("Call-state recovery", () => {
  it("loads a missed active call when the browser returns online", async () => {
    render(host()); await waitFor(() => expect(mocks.read).toHaveBeenCalledTimes(1));
    mocks.read.mockResolvedValue({ success: true, data: { session: active } });
    fireEvent(window, new Event("online"));
    expect(await screen.findByRole("region", { name: "Active call call-1" })).toBeVisible();
  });
  it("reconciles a call on realtime rejoin without a page reload", async () => {
    render(host()); await waitFor(() => expect(mocks.read).toHaveBeenCalledTimes(1));
    mocks.read.mockResolvedValue({ success: true, data: { session: active } });
    expect(mocks.reconnect).toBeTypeOf("function"); act(() => mocks.reconnect!());
    expect(await screen.findByRole("region", { name: "Active call call-1" })).toBeVisible();
  });
  it("shows a retry after a failed status read and keeps the conversation usable", async () => {
    mocks.read.mockResolvedValueOnce({ success: false, error: "Call status could not be loaded." });
    render(host()); expect(await screen.findByRole("alert")).toHaveTextContent("Call status could not be loaded.");
    expect(screen.getByText("Conversation retained")).toBeVisible();
    mocks.read.mockResolvedValue({ success: true, data: { session: active } });
    fireEvent.click(screen.getByRole("button", { name: "Reload call status" }));
    expect(await screen.findByRole("region", { name: "Active call call-1" })).toBeVisible(); expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
  it("keeps a confirmed call visible when a later status read throws", async () => {
    mocks.read.mockResolvedValueOnce({ success: true, data: { session: active } }); render(host());
    expect(await screen.findByRole("region", { name: "Active call call-1" })).toBeVisible();
    mocks.read.mockRejectedValue(new Error("Transport lost")); fireEvent(window, new Event("online"));
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not be confirmed/i); expect(screen.getByRole("region", { name: "Active call call-1" })).toBeVisible();
  });
  it("does not let an older status snapshot erase a newer realtime call", async () => {
    const request = pending<{ success: true; data: { session: null } }>(); mocks.read.mockReturnValue(request.promise); render(host());
    act(() => mocks.update!(active)); expect(screen.getByRole("region", { name: "Active call call-1" })).toBeVisible();
    await act(async () => request.resolve({ success: true, data: { session: null } }));
    expect(screen.getByRole("region", { name: "Active call call-1" })).toBeVisible();
  });
  it("coalesces browser and channel recovery while one read is pending", async () => {
    render(host()); await waitFor(() => expect(mocks.read).toHaveBeenCalledTimes(1));
    const request = pending<{ success: true; data: { session: CallSession } }>(); mocks.read.mockReturnValue(request.promise);
    act(() => { fireEvent(window, new Event("online")); mocks.reconnect!(); fireEvent(window, new Event("online")); });
    expect(mocks.read).toHaveBeenCalledTimes(2);
    await act(async () => request.resolve({ success: true, data: { session: active } }));
    expect(screen.getByRole("region", { name: "Active call call-1" })).toBeVisible();
  });
  it("refreshes when returning to a visible page, without fetching while hidden", async () => {
    const visibility = vi.spyOn(document, "visibilityState", "get");
    render(host()); await waitFor(() => expect(mocks.read).toHaveBeenCalledTimes(1));
    visibility.mockReturnValue("hidden"); fireEvent(document, new Event("visibilitychange")); expect(mocks.read).toHaveBeenCalledTimes(1);
    mocks.read.mockResolvedValue({ success: true, data: { session: active } }); visibility.mockReturnValue("visible"); fireEvent(document, new Event("visibilitychange"));
    expect(await screen.findByRole("region", { name: "Active call call-1" })).toBeVisible();
  });
  it("does not show a late old-conversation status in a new conversation", async () => {
    const request = pending<{ success: true; data: { session: CallSession } }>(); mocks.read.mockReturnValueOnce(request.promise);
    const view = render(host()); view.rerender(host({ conversationId: "thread-2" }));
    await waitFor(() => expect(mocks.read).toHaveBeenCalledTimes(2));
    await act(async () => request.resolve({ success: true, data: { session: active } }));
    expect(screen.queryByRole("region")).not.toBeInTheDocument(); expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
