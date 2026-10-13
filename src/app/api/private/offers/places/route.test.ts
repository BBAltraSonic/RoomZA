import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn(), search: vi.fn(), limit: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireUser: mocks.user }));
vi.mock("@/features/places/catalogue", () => ({ searchLocationCatalogue: mocks.search }));
vi.mock("@/lib/rate-limit", () => ({ consumeRateLimit: mocks.limit, getClientIp: () => "127.0.0.1" }));
import { GET } from "./route";
const request = (q = "Soweto") => new Request(`https://pinpoint.example/api/private/offers/places?q=${q}`);
beforeEach(() => { vi.clearAllMocks(); mocks.user.mockResolvedValue({ id: "user" }); mocks.limit.mockResolvedValue({ success: true }); mocks.search.mockResolvedValue({ data: { places: [] } }); });
it("keeps the posting authentication gate before searching", async () => {
  mocks.user.mockRejectedValueOnce(new Error("Sign in required"));
  await expect(GET(request())).rejects.toThrow("Sign in required");
  expect(mocks.search).not.toHaveBeenCalled();
});
it("uses shared autocomplete with private caching, validation and rate limiting", async () => {
  const response = await GET(request());
  expect(mocks.search).toHaveBeenCalledWith("Soweto");
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect((await GET(request("a"))).status).toBe(400);
  mocks.limit.mockResolvedValueOnce({ success: false });
  expect((await GET(request())).status).toBe(429);
});
it("distinguishes unavailable search from a valid empty location search", async () => {
  mocks.search.mockRejectedValueOnce(new Error("private diagnostics"));
  const failed = await GET(request());
  expect(failed.status).toBe(503);
  expect(await failed.text()).not.toContain("diagnostics");
  expect((await GET(request())).status).toBe(200);
});
