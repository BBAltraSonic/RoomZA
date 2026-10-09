import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), claims: vi.fn(), rpc: vi.fn(), admin: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ requireAnyPersona: mocks.auth }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getClaims: mocks.claims } }) }));
vi.mock("@/lib/supabase/admin", () => ({ createUntypedClient: mocks.admin }));
import { runListingCommand } from "./lifecycle-command";
const actor = "11111111-1111-4111-8111-111111111111";
const session = "22222222-2222-4222-8222-222222222222";
const listing = "33333333-3333-4333-8333-333333333333";
const version = "2026-10-06T10:00:00.123456+00:00";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: actor } });
  mocks.claims.mockResolvedValue({ data: { claims: { sub: actor, session_id: session } }, error: null });
  mocks.admin.mockReturnValue({ rpc: mocks.rpc });
  mocks.rpc.mockResolvedValue({ data: { listingId: listing, updatedAt: version }, error: null });
});
describe("trusted Property lifecycle boundary", () => {
  it("passes only the verified actor/session and exact loaded version", async () => {
    expect((await runListingCommand("archive", listing, version)).success).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledWith("pinpoint_property_lifecycle", {
      actor_id: actor, actor_session_id: session, target: listing, expected_updated_at: version, command: "archive",
    });
  });
  it.each(["", "invalid"])("refuses an absent or malformed loaded version: %s", async (value) => {
    expect((await runListingCommand("delete", listing, value)).success).toBe(false);
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it.each([{ sub: listing, session_id: session }, { sub: actor }, { sub: actor, session_id: "forged" }])("refuses mismatched or missing session identity", async (claims) => {
    mocks.claims.mockResolvedValue({ data: { claims }, error: null });
    expect((await runListingCommand("delete", listing, version)).success).toBe(false);
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it("reports a stale conflict without retrying", async () => {
    mocks.rpc.mockResolvedValue({ error: { code: "PT409", message: "private" } });
    const result = await runListingCommand("restore", listing, version);
    expect(result).toEqual({ success: false, error: "This listing changed. Reload it before trying again." });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
  it("refuses an unrelated successful response", async () => {
    mocks.rpc.mockResolvedValue({ data: { listingId: actor, updatedAt: version } });
    expect((await runListingCommand("unpublish", listing, version)).success).toBe(false);
  });
  it("accepts a separate duplicated draft ID", async () => {
    mocks.rpc.mockResolvedValue({ data: { listingId: actor, updatedAt: version } });
    expect((await runListingCommand("duplicate", listing, version)).success).toBe(true);
  });
});
