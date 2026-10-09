// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useNavigationAccount } from "./use-navigation-account";
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), profile: vi.fn(), subscribe: vi.fn(), unsubscribe: vi.fn(), authChange: undefined as undefined | ((event: string, session?: { user: { id: string; email: string } }) => void) }));
vi.mock("@/lib/supabase/browser", () => ({ createClient: () => ({ auth: { getUser: mocks.getUser, onAuthStateChange: (callback: typeof mocks.authChange) => { mocks.subscribe(); mocks.authChange = callback; return { data: { subscription: { unsubscribe: mocks.unsubscribe } } }; } }, from: () => ({ select: () => ({ eq: () => ({ abortSignal: () => ({ maybeSingle: mocks.profile }) }) }) }) }) }));
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(res => { resolve = res; }); return { promise, resolve }; }
beforeEach(() => { mocks.getUser.mockResolvedValue({ data: { user: { id: "a", email: "a@example.test" } } }); mocks.profile.mockResolvedValue({ data: { role: "renter", email: "a@example.test" } }); vi.stubGlobal("fetch", vi.fn(async () => Response.json({ hasAdminAccess: false }))); });
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
describe("progressive navigation account", () => {
  it("shows identity without waiting for either optional read and settles each independently", async () => {
    const profile = deferred<{ data: { role: string; email: string } }>(); const admin = deferred<Response>();
    mocks.profile.mockReturnValue(profile.promise); vi.stubGlobal("fetch", vi.fn(() => admin.promise));
    const { result } = renderHook(() => useNavigationAccount("/"));
    expect(result.current.status).toBe("loading");
    await waitFor(() => expect(result.current.status).toBe("authenticated"));
    expect(result.current.userEmail).toBe("a@example.test"); expect(result.current.currentRole).toBeNull();
    await act(async () => { profile.resolve({ data: { role: "landlord", email: "profile@example.test" } }); });
    expect(result.current.currentRole).toBe("landlord"); expect(result.current.hasAdminAccess).toBe(false);
    await act(async () => { admin.resolve(Response.json({ hasAdminAccess: true })); });
    expect(result.current.hasAdminAccess).toBe(true);
  });
  it("deduplicates pending route refreshes without resubscribing", async () => {
    const profile = deferred<{ data: null }>(); mocks.profile.mockReturnValue(profile.promise);
    const { rerender } = renderHook(({ path }) => useNavigationAccount(path), { initialProps: { path: "/" } });
    await waitFor(() => expect(mocks.profile).toHaveBeenCalled()); rerender({ path: "/profile" }); rerender({ path: "/saved" });
    expect(mocks.subscribe).toHaveBeenCalledTimes(1); expect(mocks.getUser).toHaveBeenCalledTimes(1);
  });
  it("ignores delayed profile/admin parsing after sign-out", async () => {
    const profile = deferred<{ data: { role: string; email: string } }>(); const body = deferred<{ hasAdminAccess: boolean }>();
    mocks.profile.mockReturnValue(profile.promise); vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: () => body.promise })));
    const { result } = renderHook(() => useNavigationAccount("/")); await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
    await act(async () => { mocks.authChange?.("SIGNED_OUT"); profile.resolve({ data: { role: "landlord", email: "old@example.test" } }); body.resolve({ hasAdminAccess: true }); });
    expect(result.current.status).toBe("guest"); expect(result.current.hasAdminAccess).toBe(false); expect(result.current.userEmail).toBeNull();
  });
  it("rejects the earlier user's responses after an identity switch", async () => {
    const old = deferred<{ data: { role: string; email: string } }>(); mocks.profile.mockReturnValueOnce(old.promise).mockResolvedValue({ data: { role: "renter", email: "b@example.test" } });
    const { result } = renderHook(() => useNavigationAccount("/")); await waitFor(() => expect(mocks.profile).toHaveBeenCalled());
    mocks.getUser.mockResolvedValue({ data: { user: { id: "b", email: "b@example.test" } } });
    await act(async () => { mocks.authChange?.("SIGNED_IN", { user: { id: "b", email: "b@example.test" } }); });
    await waitFor(() => expect(result.current.currentRole).toBe("renter"));
    await act(async () => { old.resolve({ data: { role: "landlord", email: "old@example.test" } }); });
    expect(result.current.userEmail).toBe("b@example.test"); expect(result.current.currentRole).toBe("renter");
  });
  it("keeps a known user signed in when optional reads fail", async () => {
    mocks.profile.mockRejectedValue(new Error("Offline")); vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("Offline"); }));
    const { result } = renderHook(() => useNavigationAccount("/")); await waitFor(() => expect(result.current.status).toBe("authenticated"));
    expect(result.current.userEmail).toBe("a@example.test");
  });
  it("bounds stalled reads and releases the subscription on unmount", async () => {
    vi.useFakeTimers(); mocks.getUser.mockReturnValue(new Promise(() => {}));
    const { result, unmount } = renderHook(() => useNavigationAccount("/"));
    await act(async () => { await vi.advanceTimersByTimeAsync(5001); });
    expect(result.current.status).toBe("guest"); unmount(); expect(mocks.unsubscribe).toHaveBeenCalledTimes(1);
  });
});
