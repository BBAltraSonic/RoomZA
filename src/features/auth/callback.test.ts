import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), membership: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/features/admin/auth", () => ({ getAdminMembership: mocks.membership }));
import { handleAuthCallback } from "./callback";

beforeEach(() => { vi.clearAllMocks(); mocks.membership.mockResolvedValue(null); });

function client(role: string | null, needsMfa = false, signupRole?: string) {
  const query = {
    upsert: () => query, select: () => query,
    single: async () => ({ data: { role, email_verified_at: "2026-10-03T00:00:00Z" } }),
    eq: () => query,
    order: async () => ({ data: [], error: null }),
    insert: async () => ({ error: null }),
    then: (resolve: (value: { error: null }) => unknown) => resolve({ error: null }),
  };
  mocks.createClient.mockResolvedValue({
    from: () => query,
    auth: {
      exchangeCodeForSession: async () => ({ data: { user: { id: "fixture-user", email: "fixture@pinpoint.invalid", email_confirmed_at: "2026-10-03T00:00:00Z", user_metadata: { signup_role: signupRole } } }, error: null }),
      mfa: { getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: "aal1", nextLevel: needsMfa ? "aal2" : "aal1" } }) },
    },
  });
}

async function destination(path: string) {
  const response = await handleAuthCallback(new NextRequest("https://roomza.local/auth/callback?code=fixture&next=" + encodeURIComponent(path)));
  return new URL(response.headers.get("location")!).pathname + new URL(response.headers.get("location")!).search;
}

it.each(["/post/services", "/post/entries/event"])("returns a confirmed poster without a Property role to %s", async path => {
  client(null); mocks.membership.mockResolvedValue({ level: "admin" });
  expect(await destination(path)).toBe(path);
});

it("keeps public Services and Specials detail return paths for a renter", async () => {
  client("renter");
  for (const path of ["/services?view=feed&q=plumbing", "/specials/55555555-5555-4555-8555-555555555555?from=discovery"])
    expect(await destination(path)).toBe(path);
  expect(await destination("/dashboard/listings/new")).toBe("/");
});

it("retains the MFA gate before returning to an independent poster workspace", async () => {
  client(null, true);
  expect(await destination("/post/services")).toBe("/auth/mfa?redirect=%2Fpost%2Fservices");
});

it.each([["renter", "/?welcome=renter"], ["buyer", "/?welcome=buyer"], ["landlord", "/dashboard"], ["seller", "/dashboard"]])("retains the selected %s signup role through a legacy callback", async (role, expected) => {
  client(null, false, role);
  expect(await destination("/")).toBe(expected);
});

it("ignores privileged signup metadata", async () => {
  client(null, false, "admin");
  expect(await destination("/")).toBe("/onboarding?redirect=%2F");
});

it("requires MFA before applying a signup preference", async () => {
  client(null, true, "seller");
  expect(await destination("/dashboard")).toBe("/auth/mfa?redirect=%2Fdashboard");
});
