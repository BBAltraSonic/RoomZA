import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const search = vi.hoisted(() => vi.fn());
vi.mock("@/features/offers/public-place-data", () => ({ searchOfferDiscoveryPlaces: search }));
import { GET } from "./route";
afterEach(() => vi.resetAllMocks());
describe("anonymous offer place search", () => {
  it("rejects missing, repeated, short and unknown inputs before a catalogue read", async () => {
    for (const query of ["", "?q=a", "?q=Place&q=Place", "?q=Place&actorId=forged"]) {
      expect((await GET(new Request("https://pinpoint.example/api/offers/places" + query))).status).toBe(400);
    }
    expect(search).not.toHaveBeenCalled();
  });
  it("returns bounded search output without caching and distinguishes failure from empty results", async () => {
    search.mockResolvedValueOnce({ data: { places: [] } }).mockRejectedValueOnce(new Error("private database diagnostic"));
    const request = () => new Request("https://pinpoint.example/api/offers/places?q=Place");
    const empty = await GET(request());
    expect(empty.status).toBe(200);
    expect(empty.headers.get("cache-control")).toContain("no-store");
    expect(await empty.json()).toEqual({ data: { places: [] } });
    const failed = await GET(request());
    expect(failed.status).toBe(503);
    expect(await failed.text()).not.toContain("private database");
  });
});
