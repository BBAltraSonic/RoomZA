import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ search: vi.fn(), limit: vi.fn() }));
vi.mock("@/features/places/catalogue", () => ({ searchLocationCatalogue: mocks.search }));
vi.mock("@/lib/rate-limit", () => ({ consumeRateLimit: mocks.limit, getClientIp: () => "127.0.0.1" }));
import { GET } from "./route";
const request = (query = "") => new Request(`https://pinpoint.example/api/discovery/places${query}`);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.limit.mockResolvedValue({ success: true });
  mocks.search.mockResolvedValue({ data: { places: [], recentPlaces: [] } });
});
it("offers suggestions without a query and resolves only valid recent IDs", async () => {
  expect((await GET(request())).status).toBe(200);
  expect(mocks.search).toHaveBeenCalledWith("", []);
  const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const response = await GET(request(`?recent=${id}`));
  expect(response.status).toBe(200);
  expect(mocks.search).toHaveBeenCalledWith("", [id]);
  expect(response.headers.get("cache-control")).toContain("no-store");
});
it("rejects invalid, repeated and unexpected parameters before reading the catalogue", async () => {
  for (const query of ["?q=a", `?q=${"a".repeat(101)}`, "?q=Ronde&q=Cape", "?recent=forged", "?q=Ronde&actorId=forged"]) {
    expect((await GET(request(query))).status).toBe(400);
  }
  expect(mocks.search).not.toHaveBeenCalled();
});
it("limits searches and distinguishes database failure from an empty catalogue", async () => {
  mocks.limit.mockResolvedValueOnce({ success: false });
  expect((await GET(request("?q=Ronde"))).status).toBe(429);
  expect(mocks.search).not.toHaveBeenCalled();
  mocks.search.mockRejectedValueOnce(new Error("private database diagnostic"));
  const failed = await GET(request("?q=Ronde"));
  expect(failed.status).toBe(503);
  expect(await failed.text()).not.toContain("private database");
  expect((await GET(request("?q=Ronde"))).status).toBe(200);
});
