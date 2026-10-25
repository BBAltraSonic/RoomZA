import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ requireUser: vi.fn(), createClient: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
import { getMyPurchases } from "./data";
beforeEach(() => { vi.clearAllMocks(); mocks.requireUser.mockResolvedValue({ user: { id: "current-user" } }); });

describe("private purchase overview", () => {
  function setup(error: object | null = null) {
    const interests = { select: vi.fn(), eq: vi.fn(), order: vi.fn() };
    interests.select.mockReturnValue(interests); interests.eq.mockReturnValue(interests);
    interests.order.mockResolvedValue({ data: [{ id: "interest", listing_id: "listing" }], error });
    const stages = { select: vi.fn(), eq: vi.fn() };
    stages.select.mockReturnValue(stages); stages.eq.mockResolvedValue({ data: [{ listing_id: "listing", current_stage: "contacted_seller", completed_stages: [] }], error: null });
    mocks.createClient.mockResolvedValue({ from: (table: string) => table === "buyer_interests" ? interests : stages });
    return { interests, stages };
  }
  it("uses the current session for both interest and progress and combines by listing", async () => {
    const { interests, stages } = setup();
    const result = await getMyPurchases();
    expect(mocks.requireUser).toHaveBeenCalledWith({ redirectTo: "/purchases" });
    expect(interests.eq).toHaveBeenCalledWith("buyer_id", "current-user");
    expect(stages.eq).toHaveBeenCalledWith("user_id", "current-user");
    expect(result).toMatchObject({ success: true, data: [{ id: "interest", progress: { current_stage: "contacted_seller" } }] });
  });
  it("reports a read failure instead of a misleading empty overview", async () => {
    setup({ message: "denied" }); expect(await getMyPurchases()).toMatchObject({ success: false });
  });
  it("preserves the viewings destination when authentication is required", async () => {
    setup(); await getMyPurchases("/viewings");
    expect(mocks.requireUser).toHaveBeenCalledWith({ redirectTo: "/viewings" });
  });
});
