import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), membership: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => { const client = await mocks.createClient(); return { ...client, rpc: client.rpc ?? mocks.rpc }; } }));
vi.mock("@/features/admin/auth", () => ({ getAdminMembership: mocks.membership }));
import { handleAuthCallback } from "./callback";

beforeEach(() => { vi.clearAllMocks(); mocks.rpc.mockResolvedValue({ error: null }); mocks.membership.mockResolvedValue(null); });

function client(role: string | null, needsMfa = false, signupRole?: string, personas: Array<{ persona: string; is_active: boolean }> = [], profileVerifiedAt: string | null = "2026-10-03T00:00:00Z", profileError: { message: string } | null = null) {
  const query = {
    upsert: vi.fn(() => query), select: () => query,
    single: async () => ({ data: { role, email_verified_at: profileVerifiedAt }, error: profileError }),
    eq: () => query,
    order: async () => ({ data: personas, error: null }),
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
  return query;
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
  expect(await destination("/dashboard/listings/new")).toBe("/dashboard/listings/new");
});

it("retains the MFA gate before returning to an independent poster workspace", async () => {
  client(null, true);
  expect(await destination("/post/services")).toBe("/auth/mfa?redirect=%2Fpost%2Fservices");
});

it.each([["renter", "/"], ["buyer", "/"], ["landlord", "/"], ["seller", "/"]])("ignores the legacy %s signup preference for redirects", async (role, expected) => {
  client(null, false, role);
  expect(await destination("/")).toBe(expected);
});

it("ignores privileged signup metadata", async () => {
  client(null, false, "admin");
  expect(await destination("/")).toBe("/");
});

it("requires MFA before applying a signup preference", async () => {
  client(null, true, "seller");
  expect(await destination("/dashboard")).toBe("/auth/mfa?redirect=%2Fdashboard");
});

it.each(["buyer", "seller"])("keeps the existing %s workspace on Google sign-in", async (persona) => {
  client(null, false, undefined, [{ persona, is_active: true }]);
  expect(await destination(persona === "buyer" ? "/saved" : "/dashboard")).toBe(persona === "buyer" ? "/saved" : "/dashboard");
});

it("uses the active marketplace persona instead of the legacy Property role", async () => {
  client("landlord", false, undefined, [{ persona: "seller", is_active: false }, { persona: "buyer", is_active: true }]);
  expect(await destination("/saved")).toBe("/saved");
});

it("returns a new Google account directly to its intended workflow", async () => {
  client(null);
  expect(await destination("/saved")).toBe("/saved");
});

it("returns Google cancellation to sign-in without exchanging a code", async () => {
  const response = await handleAuthCallback(new NextRequest("https://roomza.local/auth/callback?error=access_denied&next=%2Fsaved"));
  expect(response.headers.get("location")).toBe("https://roomza.local/auth?error=callback&redirect=%2Fsaved");
  expect(mocks.createClient).not.toHaveBeenCalled();
});

it("reads the trigger-created Google profile without updating protected columns", async () => {
  const query = client("renter");
  expect(await destination("/saved")).toBe("/saved");
  expect(query.upsert).not.toHaveBeenCalled();
});

it("accepts Auth-confirmed email when the profile verification marker is stale", async () => {
  client("renter", false, undefined, [], null);
  expect(await destination("/saved")).toBe("/saved");
});

it("returns a profile read failure to sign-in with the requested destination", async () => {
  client("renter", false, undefined, [], null, { message: "profile unavailable" });
  expect(await destination("/saved")).toBe("/auth?error=callback&redirect=%2Fsaved");
});
