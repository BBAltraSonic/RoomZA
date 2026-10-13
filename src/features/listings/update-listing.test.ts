import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), client: vi.fn(), scope: vi.fn(), admin: vi.fn(), rpc: vi.fn(),
  from: vi.fn(), select: vi.fn(), eq: vi.fn(), single: vi.fn(), revalidate: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ requireAnyPersona: mocks.auth }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
vi.mock("@/lib/supabase/admin", () => ({ createUntypedClient: mocks.admin, createClient: vi.fn() }));
vi.mock("./management-scope", () => ({ getListingManagementScope: mocks.scope }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn() } }));
import { updateListing, createListing, createListingDraft, publishListing, uploadListingImage, getMyListing } from "./actions";

const listingId = "11111111-1111-4111-8111-111111111111";
const actorId = "22222222-2222-4222-8222-222222222222";
const otherId = "33333333-3333-4333-8333-333333333333";
const orgId = "44444444-4444-4444-8444-444444444444";
const timestamp = "2026-10-02T16:00:00.123456+00:00";
const savedAt = "2026-10-02T16:01:00.654321+00:00";
function form(overrides: Record<string, string> = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    expectedUpdatedAt: timestamp, title: "Updated fixture", listing_type: "rent",
    price: "1000", address: "Synthetic fixture", latitude: "-33.9", longitude: "18.4",
    property_type: "apartment", bedrooms: "1", bathrooms: "1", parking_type: "none",
    parking_count: "0", electricity_type: "prepaid", water_availability: "municipal",
    lease_duration: "12_months", availability_date: "2026-10-03", ...overrides,
  })) data.set(key, value);
  return data;
}
beforeEach(() => {
  vi.resetAllMocks();
  const query = { select: mocks.select, eq: mocks.eq, single: mocks.single };
  mocks.from.mockReturnValue(query); mocks.select.mockReturnValue(query); mocks.eq.mockReturnValue(query);
  mocks.client.mockResolvedValue({ from: mocks.from });
  mocks.auth.mockResolvedValue({ user: { id: actorId } });
  mocks.scope.mockResolvedValue({ managedOrganizationId: null });
  mocks.single.mockResolvedValue({ data: { id: listingId, landlord_id: actorId, organization_id: null } });
  mocks.admin.mockReturnValue({ rpc: mocks.rpc });
  mocks.rpc.mockResolvedValue({ data: { listingId, updatedAt: savedAt }, error: null });
});
describe("version-checked Property content save", () => {
  it("uses the authenticated actor and strips form-supplied ownership/status claims", async () => {
    expect(await updateListing(listingId, form({ actor_id: otherId, landlord_id: otherId, status: "published", organization_id: orgId })))
      .toEqual({ success: true, data: { listingId, updatedAt: savedAt } });
    const args = mocks.rpc.mock.calls[0]![1];
    expect(args.actor_id).toBe(actorId); expect(args.expected_updated_at).toBe(timestamp);
    expect(args.payload).not.toHaveProperty("landlord_id"); expect(args.payload).not.toHaveProperty("status");
    expect(args.payload).not.toHaveProperty("organization_id");
  });
  it("requires the signed-in persona before privileged access", async () => {
    mocks.auth.mockRejectedValue(new Error("auth redirect"));
    await expect(updateListing(listingId, form())).rejects.toThrow("auth redirect");
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it("preserves sale content and normalizes its price for persistence", async () => {
    expect((await updateListing(listingId, form({ listing_type: "sale", sale_price: "300000", price: "1000" }))).success).toBe(true);
    expect(mocks.rpc.mock.calls[0]![1].payload).toMatchObject({ listing_type: "sale", sale_price: 300000, price: 300000 });
  });
  it.each(["", "invalid"])("rejects missing/malformed loaded timestamps (%s)", async (value) => {
    expect((await updateListing(listingId, form({ expectedUpdatedAt: value }))).success).toBe(false);
    expect(mocks.client).not.toHaveBeenCalled(); expect(mocks.admin).not.toHaveBeenCalled();
  });
  it("does not attempt privileged saves for an unrelated listing", async () => {
    mocks.single.mockResolvedValue({ data: { id: listingId, landlord_id: otherId, organization_id: orgId } });
    expect((await updateListing(listingId, form())).success).toBe(false);
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it("allows a current manager precheck and delegates the atomic membership recheck", async () => {
    mocks.single.mockResolvedValue({ data: { id: listingId, landlord_id: otherId, organization_id: orgId } });
    mocks.scope.mockResolvedValue({ managedOrganizationId: orgId });
    expect((await updateListing(listingId, form())).success).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledWith("pinpoint_property_save", expect.objectContaining({ actor_id: actorId, target: listingId }));
  });
  it("shows a conflict without retrying or reporting a successful save", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "PT409" } });
    const result = await updateListing(listingId, form());
    expect(result.success).toBe(false); if (!result.success) expect(result.error).toMatch(/Copy your edits.*reload/);
    expect(mocks.rpc).toHaveBeenCalledTimes(1); expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it("keeps persistence failures private", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "private diagnostic" } });
    expect(JSON.stringify(await updateListing(listingId, form()))).not.toContain("private diagnostic");
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it("does not confirm a malformed persistence response", async () => {
    mocks.rpc.mockResolvedValue({ data: { listingId: otherId, updatedAt: savedAt }, error: null });
    expect((await updateListing(listingId, form())).success).toBe(false);
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
});


describe("guest Property direct requests", () => {
  it.each([
    ["create", () => createListing(form())],
    ["create draft", () => createListingDraft(form())],
    ["publish", () => publishListing(listingId,timestamp)],
    ["upload media", () => uploadListingImage(listingId,new FormData())],
    ["read private detail", () => getMyListing(listingId)],
  ] as const)("requires sign-in before %s can access database or storage", async (_name, invoke) => {
    mocks.auth.mockRejectedValue(new Error("auth redirect"));
    await expect(invoke()).rejects.toThrow("auth redirect");
    expect(mocks.client).not.toHaveBeenCalled();
    expect(mocks.admin).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
