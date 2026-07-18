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
});
