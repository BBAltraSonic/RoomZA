import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ assurance: null as string | null }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => { throw new Error(`redirect:${url}`); },
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: {
    getUser: async () => ({ data: { user: { id: "admin-user", email: "admin@pinpoint.invalid" } } }),
    mfa: {
      listFactors: async () => ({ data: { totp: [{ status: "verified" }] } }),
      getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: state.assurance } }),
    },
  } }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createUntypedClient: () => ({ from: (table: string) => {
    const query = {
      select: () => query,
      eq: () => query,
      is: () => query,
      maybeSingle: async () => ({ error: null, data: table === "admin_memberships"
        ? { user_id: "admin-user", level: "admin", revoked_at: null }
        : null }),
    };
    return query;
  } }),
}));

import { requireAdmin, requireAdminMembership } from "./auth";

describe("admin assurance boundary", () => {
  beforeEach(() => { state.assurance = null; });

  it.each([null, "aal3", "unrecognized"])("keeps unsupported assurance %s behind the MFA challenge", async (assurance) => {
    state.assurance = assurance;
    expect((await requireAdminMembership()).assuranceLevel).toBeNull();
    await expect(requireAdmin()).rejects.toThrow("redirect:/admin/security/mfa/challenge");
  });

  it("requires a challenge at aal1 and admits the verified admin at aal2", async () => {
    state.assurance = "aal1";
    expect((await requireAdminMembership()).assuranceLevel).toBe("aal1");
    await expect(requireAdmin()).rejects.toThrow("redirect:/admin/security/mfa/challenge");
    state.assurance = "aal2";
    expect((await requireAdmin()).assuranceLevel).toBe("aal2");
  });
});
