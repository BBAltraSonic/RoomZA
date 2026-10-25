import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ user: vi.fn(), rpc: vi.fn(), admin: vi.fn(), from: vi.fn(), limit: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: mocks.user }, rpc: mocks.rpc }) }));
vi.mock("@/lib/supabase/admin", () => ({ createUntypedClient: mocks.admin, createClient: mocks.admin }));
vi.mock("@/lib/rate-limit", () => ({ consumeRateLimit: mocks.limit }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }));
import { submitModerationReport } from "./actions";

const actorId = "11111111-1111-4111-8111-111111111111";
const input = { messageId: "22222222-2222-4222-8222-222222222222", category: "harassment", details: "A sufficiently detailed synthetic report." };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.user.mockResolvedValue({ data: { user: { id: actorId, is_anonymous: false } } });
  mocks.rpc.mockResolvedValue({ data: true, error: null });
  mocks.admin.mockReturnValue({ from: mocks.from });
  mocks.limit.mockResolvedValue({ success: true });
});
describe("report account access", () => {
  it.each([
    { data: false, error: null },
    { data: null, error: null },
    { data: true, error: { code: "PGRST000", message: "Contained access lookup failure" } },
  ])("fails closed before privileged reads and quota when access is unavailable: %j", async access => {
    mocks.rpc.mockResolvedValue(access);
    expect(await submitModerationReport(input)).toMatchObject({ success: false, details: { code: "account_access_required" } });
    expect(mocks.admin).not.toHaveBeenCalled(); expect(mocks.limit).not.toHaveBeenCalled();
  });
  it("requires an ordinary account before checking access", async () => {
    mocks.user.mockResolvedValue({ data: { user: { id: actorId, is_anonymous: true } } });
    expect(await submitModerationReport(input)).toMatchObject({ success: false, details: { code: "authentication_required" } });
    expect(mocks.rpc).not.toHaveBeenCalled(); expect(mocks.admin).not.toHaveBeenCalled();
  });
  it("retains the own-account reporting denial for an active account", async () => {
    expect(await submitModerationReport({ reportedUserId: actorId, category: "harassment", details: input.details })).toMatchObject({ success: false, error: "You cannot report your own account." });
    expect(mocks.rpc).toHaveBeenCalledWith("is_current_account_active"); expect(mocks.from).not.toHaveBeenCalled();
  });
});
