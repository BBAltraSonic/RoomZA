import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const signOutMock = vi.fn();
const createClientMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => createClientMock(),
}));

import { handleSignOut } from "@/features/auth/sign-out";

describe("handleSignOut", () => {
  beforeEach(() => {
    signOutMock.mockReset();
    createClientMock.mockReset();
    createClientMock.mockResolvedValue({
      auth: {
        signOut: signOutMock,
      },
    });
  });

  it("terminates the Supabase session and redirects to the public landing route", async () => {
    const response = await handleSignOut(new NextRequest("https://roomza.test/auth/sign-out"));

    expect(signOutMock).toHaveBeenCalledOnce();
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://roomza.test/");
  });
});
