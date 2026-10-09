// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), profile: vi.fn(), unsubscribe: vi.fn(), authChange: undefined as undefined | ((event: string) => void) }));
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("@/lib/supabase/browser", () => ({ createClient: () => ({ auth: { getUser: mocks.getUser, onAuthStateChange: (callback: (event: string) => void) => { mocks.authChange = callback; return { data: { subscription: { unsubscribe: mocks.unsubscribe } } }; } }, from: () => ({ select: () => ({ eq: () => ({ abortSignal: () => ({ maybeSingle: mocks.profile }) }) }) }) }) }));
vi.mock("@/components/navigation/navigation", () => ({ Navigation: ({ children, isAuthenticated, currentRole }: { children: React.ReactNode; isAuthenticated: boolean; currentRole: string | null }) => <div><span data-testid="account">{isAuthenticated ? currentRole ?? "member" : "guest"}</span>{children}</div> }));
vi.mock("@/features/presence/presence-heartbeat", () => ({ PresenceHeartbeat: ({ enabled }: { enabled: boolean }) => <span data-testid="heartbeat">{String(enabled)}</span> }));
vi.mock("@/lib/motion/provider", () => ({ MotionProvider: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("sonner", () => ({ Toaster: () => null }));
import { AppShell } from "./app-shell";
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); });
describe("shared AppShell account boundary", () => {
  it("renders every screen before account loading and keeps anonymous presence disabled", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    render(<AppShell><h1>Discovery</h1></AppShell>);
    expect(screen.getByRole("heading", { name: "Discovery" })).toBeTruthy();
    expect(screen.getByTestId("account").textContent).toBe("guest");
    await waitFor(() => expect(mocks.getUser).toHaveBeenCalled());
    expect(screen.getByTestId("heartbeat").textContent).toBe("false");
  });
  it("clears account and presence on sign-out before an old profile read resolves", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "self", email: "self@example.test" } } });
    let completeProfile!: (value: { data: { role: string; email: string } }) => void;
    mocks.profile.mockImplementation(() => new Promise(resolve => { completeProfile = resolve; }));
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ hasAdminAccess: true })));
    const { unmount } = render(<AppShell><h1>Screen</h1></AppShell>);
    await waitFor(() => expect(mocks.profile).toHaveBeenCalled());
    await act(async () => { mocks.authChange?.("SIGNED_OUT"); completeProfile({ data: { role: "landlord", email: "self@example.test" } }); });
    expect(screen.getByTestId("account").textContent).toBe("guest");
    expect(screen.getByTestId("heartbeat").textContent).toBe("false");
    unmount();expect(mocks.unsubscribe).toHaveBeenCalled();
  });
});
