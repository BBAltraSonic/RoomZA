import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getUserMock = vi.fn();

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
  })),
}));

import { updateSession } from "@/lib/supabase/middleware";

describe("updateSession", () => {
  beforeEach(() => {
    getUserMock.mockReset();
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
    expect(response.cookies.get("sb-roomza-auth-token")?.value).toBe("refreshed-token");
  });
});
