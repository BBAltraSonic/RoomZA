import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getUser: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: mocks.getUser } }) }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw Object.assign(new Error("NEXT_REDIRECT"), { path }); } }));
import VerifyEmailPage from "./page";

beforeEach(() => vi.clearAllMocks());

it("continues a signed-in account without checking email markers", async () => {
  mocks.getUser.mockResolvedValue({ data: { user: { id: "user", email_confirmed_at: null } } });
  await expect(VerifyEmailPage({ searchParams: Promise.resolve({ redirect: "/saved" }) })).rejects.toMatchObject({ path: "/saved" });
});

it("sends a guest to password login with the intended destination", async () => {
  mocks.getUser.mockResolvedValue({ data: { user: null } });
  await expect(VerifyEmailPage({ searchParams: Promise.resolve({ redirect: "/dashboard" }) })).rejects.toMatchObject({ path: "/auth?redirect=%2Fdashboard" });
});

it.each(["https://evil.example", "//evil.example", "/auth/verify-email"])("rejects unsafe or looping legacy destinations: %s", async redirect => {
  mocks.getUser.mockResolvedValue({ data: { user: { id: "user" } } });
  await expect(VerifyEmailPage({ searchParams: Promise.resolve({ redirect }) })).rejects.toMatchObject({ path: "/" });
});
