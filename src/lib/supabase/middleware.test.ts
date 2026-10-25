import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getUserMock = vi.fn();
const rpcMock = vi.fn();

vi.mock("@/lib/env", () => ({
  getSupabaseEnv: () => ({
    supabaseUrl: "https://roomza.supabase.co",
    supabaseAnonKey: "anon-key",
  }),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn((_url: string, _key: string, options: { cookies: { setAll: (cookies: Array<{ name: string; value: string; options: { path: string } }>) => void } }) => ({
    auth: {
      getUser: () => getUserMock(options),
    },
    rpc: (...args: unknown[]) => rpcMock(...args),
  })),
}));

import { updateSession } from "@/lib/supabase/middleware";

describe("updateSession", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    rpcMock.mockReset().mockResolvedValue({ data: true, error: null });
  });

  it("refreshes the Supabase session and persists refreshed auth cookies", async () => {
    getUserMock.mockImplementationOnce((options: { cookies: { setAll: (cookies: Array<{ name: string; value: string; options: { path: string } }>) => void } }) => {
      options.cookies.setAll([
        {
          name: "sb-roomza-auth-token",
          value: "refreshed-token",
          options: { path: "/" },
        },
      ]);
      return Promise.resolve({ data: { user: { id: "user-1" } }, error: null });
    });

    const response = await updateSession(new NextRequest("https://roomza.test/dashboard"));

    expect(getUserMock).toHaveBeenCalledOnce();
    expect(rpcMock).toHaveBeenCalledWith("is_current_account_active");
    expect(response.cookies.get("sb-roomza-auth-token")?.value).toBe("refreshed-token");
  });

  it("redirects a suspended account before a private page is served", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    rpcMock.mockResolvedValue({ data: false, error: null });

    const response = await updateSession(new NextRequest("https://roomza.test/dashboard?tab=listings"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://roomza.test/account-suspended");
  });

  it("keeps public routes available when the auth service cannot be reached", async () => {
    getUserMock.mockRejectedValue(new TypeError("fetch failed"));

    const response = await updateSession(new NextRequest("https://roomza.test/auth"));

    expect(response.status).toBe(200);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it.each(["/profile/edit", "/settings/security", "/dashboard/listings/new?type=sale"])("preserves the complete guest destination %s before a parent layout redirects", async path => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });
    const response = await updateSession(new NextRequest("https://roomza.test" + path));
    expect(new URL(response.headers.get("location")!).searchParams.get("redirect")).toBe(path);
    expect(rpcMock).not.toHaveBeenCalled();
    expect(response.headers.get("x-request-id")).toBeTruthy();
  });

  it("retains cookie cleanup on a guest redirect after a failed refresh", async () => {
    getUserMock.mockImplementationOnce((options: { cookies: { setAll: (values: { name: string; value: string; options: { path: string } }[]) => void } }) => {
      options.cookies.setAll([{ name: "expired-session", value: "", options: { path: "/" } }]);
      return Promise.resolve({ data: { user: null }, error: null });
    });
    const response = await updateSession(new NextRequest("https://roomza.test/profile/edit"));
    expect(response.status).toBe(307);
    expect(response.cookies.get("expired-session")?.value).toBe("");
  });

  it("leaves API authentication envelopes and POST action handling with their entry points", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });
    expect((await updateSession(new NextRequest("https://roomza.test/api/private/offers"))).headers.get("location")).toBeNull();
    expect((await updateSession(new NextRequest("https://roomza.test/dashboard", { method: "POST" }))).headers.get("location")).toBeNull();
  });

  it("requires permanent sign-in for an anonymous session without losing the destination", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "anonymous", is_anonymous: true } }, error: null });
    const response = await updateSession(new NextRequest("https://roomza.test/profile/edit"));
    expect(new URL(response.headers.get("location")!).searchParams.get("redirect")).toBe("/profile/edit");
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
