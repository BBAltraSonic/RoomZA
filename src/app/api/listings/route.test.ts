import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  consumeRateLimit: vi.fn(),
  getListingsInViewport: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  consumeRateLimit: (...args: unknown[]) => mocks.consumeRateLimit(...args),
  getClientIp: () => "203.0.113.7",
}));

vi.mock("@/features/listings/api", async () => {
  const actual = await vi.importActual<typeof import("@/features/listings/api")>("@/features/listings/api");
  return {
    ...actual,
    getListingsInViewport: (...args: unknown[]) => mocks.getListingsInViewport(...args),
  };
});

vi.mock("@/lib/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), fatal: vi.fn() },
}));

import { GET } from "./route";

const CACHE_CONTROL = "public, max-age=0, s-maxage=30, stale-while-revalidate=120";
const VALID_BBOX = "18.100000,-34.200000,18.600000,-33.800000";

function makeRequest(query: string) {
  return new Request(`https://roomza.test/api/listings${query}`);
}

function allowRateLimit() {
  mocks.consumeRateLimit.mockResolvedValue({
    success: true,
    limit: 120,
    remaining: 119,
    reset: Date.now() + 60_000,
    pending: Promise.resolve(),
  });
}

describe("GET /api/listings validation and caching", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    allowRateLimit();
  });

  it("returns HTTP 400 when bbox is missing", async () => {
    const response = await GET(makeRequest(""));

    expect(response.status).toBe(400);
    expect(mocks.getListingsInViewport).not.toHaveBeenCalled();

    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("validation_failed");
  });

  it("returns HTTP 400 when bbox is malformed", async () => {
    const response = await GET(makeRequest("?bbox=not-a-valid-bbox"));

    expect(response.status).toBe(400);
    expect(mocks.getListingsInViewport).not.toHaveBeenCalled();

    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("validation_failed");
  });

  it("returns HTTP 400 when bbox has fewer than four coordinates", async () => {
    const response = await GET(makeRequest("?bbox=18.1,-34.2,18.6"));

    expect(response.status).toBe(400);
    expect(mocks.getListingsInViewport).not.toHaveBeenCalled();
  });

  it("returns HTTP 400 when bbox coordinates are out of range", async () => {
    const response = await GET(makeRequest("?bbox=181,-34.2,18.6,-33.8"));

    expect(response.status).toBe(400);
    expect(mocks.getListingsInViewport).not.toHaveBeenCalled();
  });

  it("returns the exact Cache-Control header on a successful response", async () => {
    mocks.getListingsInViewport.mockResolvedValue({
      listings: [
        {
          id: "listing-1",
          title: "Braam Studio",
          area: "Braamfontein",
          price: 7200,
          latitude: -33.9,
          longitude: 18.4,
          bedrooms: 1,
          bathrooms: 1,
          imageUrls: [],
          availabilityDate: null,
          propertyType: "apartment",
          created_at: "2026-07-01T08:00:00.000Z",
          agent: null,
        },
      ],
    });

    const response = await GET(makeRequest(`?bbox=${VALID_BBOX}`));

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(CACHE_CONTROL);

    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.data.listings).toHaveLength(1);
    expect(mocks.getListingsInViewport).toHaveBeenCalledTimes(1);
  });
});
