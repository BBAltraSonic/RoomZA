import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDiscoveryPlaceByProviderId: vi.fn(),
  searchDiscoveryPlaces: vi.fn(),
  consumeRateLimit: vi.fn(),
}));

vi.mock("@/features/places/server", () => ({
  getDiscoveryPlaceByProviderId: (...args: unknown[]) => mocks.getDiscoveryPlaceByProviderId(...args),
  searchDiscoveryPlaces: (...args: unknown[]) => mocks.searchDiscoveryPlaces(...args),
}));
vi.mock("@/lib/rate-limit", () => ({
  getClientIp: () => "127.0.0.1",
  consumeRateLimit: (...args: unknown[]) => mocks.consumeRateLimit(...args),
}));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));

import { GET } from "./route";

function request(query: string) {
  return new Request(`http://localhost/api/places?${query}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.consumeRateLimit.mockResolvedValue({ success: true });
  mocks.getDiscoveryPlaceByProviderId.mockResolvedValue(null);
  mocks.searchDiscoveryPlaces.mockResolvedValue([]);
});

describe("GET /api/places legacy links", () => {
  it("returns the app UUID for a stored geocoder ID without calling the geocoder", async () => {
    const place = { id: "7a4f8a21-694b-43de-8e72-efc81947b4b5", providerId: "neighbourhood.rondebosch" };
    mocks.getDiscoveryPlaceByProviderId.mockResolvedValue(place);
    const response = await GET(request("providerId=neighbourhood.rondebosch"));
    expect(response.status).toBe(200);
    expect((await response.json()).data.places).toEqual([place]);
    expect(mocks.searchDiscoveryPlaces).not.toHaveBeenCalled();
  });

  it("only accepts the exact old ID from geocoder results", async () => {
    mocks.searchDiscoveryPlaces.mockResolvedValue([
      { id: "wrong", providerId: "neighbourhood.similar" },
      { id: "right", providerId: "neighbourhood.rondebosch" },
    ]);
    const response = await GET(request("q=Rondebosch&providerId=neighbourhood.rondebosch"));
    expect(response.status).toBe(200);
    expect((await response.json()).data.places).toEqual([{ id: "right", providerId: "neighbourhood.rondebosch" }]);
  });

  it("returns no place for an unmatched old ID", async () => {
    mocks.searchDiscoveryPlaces.mockResolvedValue([{ id: "wrong", providerId: "neighbourhood.similar" }]);
    const response = await GET(request("q=Rondebosch&providerId=neighbourhood.missing"));
    expect((await response.json()).data.places).toEqual([]);
  });
});
