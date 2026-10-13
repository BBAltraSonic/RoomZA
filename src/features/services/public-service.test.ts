import { beforeEach, expect, it, vi } from "vitest";
import { readPublicService } from "./data";
import { GET } from "@/app/api/services/[id]/route";

const mocks = vi.hoisted(() => ({ from: vi.fn(), select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(), anonymous: vi.fn(), enrich: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.anonymous }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/env", () => ({ getSupabaseEnv: () => ({ supabaseUrl: "https://fixture.supabase.co", supabaseAnonKey: "fixture-anon" }) }));
vi.mock("@/lib/auth", () => ({ requireUser: vi.fn() }));
vi.mock("@/features/admin/auth", () => ({ requireAdmin: vi.fn() }));
vi.mock("@/features/discovery/presentation-data", () => ({ enrichDiscoveryItems: mocks.enrich }));
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const item = { id, area_id: id, approved_at: "2026-10-11T08:00:00Z", content: { title: "Tap repairs", providerName: "Local plumber", serviceType: "Plumbing", description: "Repairs", areaId: id, address: "10 Fixture Road", latitude: -33, longitude: 18, phone: "021 555 0100" } };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.anonymous.mockReturnValue({ from: mocks.from }); mocks.from.mockReturnValue({ select: mocks.select });
  mocks.select.mockReturnValue({ eq: mocks.eq }); mocks.eq.mockReturnValue({ maybeSingle: mocks.maybeSingle });
  mocks.maybeSingle.mockResolvedValue({ data: item, error: null });
  mocks.enrich.mockImplementation(async items => items);
});
const request = new Request("https://fixture.test/api/services/" + id);
const get = (target = id) => GET(request, { params: Promise.resolve({ id: target }) });

it("reads an individual approved service anonymously and enriches published photos in order", async () => {
  const media = [{ id, url: "https://example.com/first.jpg" }, { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", url: "https://example.com/second.jpg" }];
  mocks.enrich.mockResolvedValue([{ ...item, media }]);
  expect(await readPublicService(id)).toMatchObject({ id, media });
  expect(mocks.from).toHaveBeenCalledExactlyOnceWith("approved_services");
  expect(mocks.eq).toHaveBeenCalledExactlyOnceWith("id", id);
  expect(mocks.enrich).toHaveBeenCalledWith([item], "service");
  expect(mocks.anonymous).toHaveBeenCalledWith("https://fixture.supabase.co", "fixture-anon", expect.objectContaining({ auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }));
});
it("returns a validated no-store response", async () => {
  const result = await get(); expect(result.status).toBe(200); expect(result.headers.get("cache-control")).toBe("no-store");
  expect(await result.json()).toEqual({ item });
});
it("rejects invalid IDs before touching the database", async () => {
  const result = await get("invalid"); expect(result.status).toBe(400); expect(result.headers.get("cache-control")).toBe("no-store");
  expect(mocks.anonymous).not.toHaveBeenCalled();
});
it("returns 404 for missing or unpublished services without consulting submissions or media", async () => {
  mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
  const result = await get(); expect(result.status).toBe(404); expect(await result.json()).toEqual({ item: null });
  expect(result.headers.get("cache-control")).toBe("no-store"); expect(mocks.enrich).not.toHaveBeenCalled();
  expect(mocks.from).toHaveBeenCalledExactlyOnceWith("approved_services");
});
it.each(["database", "malformed", "wrong-id", "media"] as const)("returns 503 when %s fails", async scenario => {
  if (scenario === "database") mocks.maybeSingle.mockResolvedValue({ data: null, error: new Error("Fixture failure") });
  if (scenario === "malformed") mocks.maybeSingle.mockResolvedValue({ data: { ...item, content: {} }, error: null });
  if (scenario === "wrong-id") mocks.maybeSingle.mockResolvedValue({ data: { ...item, id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }, error: null });
  if (scenario === "media") mocks.enrich.mockRejectedValue(new Error("Media unavailable"));
  const result = await get(); expect(result.status).toBe(503); expect(result.headers.get("cache-control")).toBe("no-store");
  expect(await result.json()).toEqual({ error: "Service details could not be loaded." });
});
