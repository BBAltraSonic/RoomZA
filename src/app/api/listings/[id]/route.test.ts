import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  consumeRateLimit: vi.fn(),
  getPublishedListingApiPayload: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  consumeRateLimit: (...args: unknown[]) => mocks.consumeRateLimit(...args),
  getClientIp: () => "203.0.113.7",
}));

vi.mock("@/features/listings/api", async () => {
  const actual = await vi.importActual<typeof import("@/features/listings/api")>("@/features/listings/api");
  return {
    ...actual,
    getPublishedListingApiPayload: (...args: unknown[]) => mocks.getPublishedListingApiPayload(...args),
  };
});

vi.mock("@/lib/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), fatal: vi.fn() },
}));

import { GET } from "./route";

const KNOWN_ID = "11111111-1111-4111-8111-111111111111";
const UNKNOWN_ID = "22222222-2222-4222-8222-222222222222";

function makeRequest(id: string) {
  return new Request(`https://roomza.test/api/listings/${id}`);
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
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

function fullDetail(id: string) {
  return {
    id,
    title: "Braam Studio",
    address: "Braamfontein",
    price: 7200,
    latitude: -33.9,
    longitude: 18.4,
    bedrooms: 1,
    bathrooms: 1,
    parking_type: "street",
    parking_count: 1,
    electricity_type: "prepaid",
    water_availability: "municipal",
    property_type: "apartment",
    electricity_included: false,
    electricity_estimate: 350,
    water_included: true,
    water_estimate: null,
    wifi_available: true,
    wifi_included: false,
    wifi_estimate: 500,
    parking_included: true,
    parking_estimate: null,
    security_fee_estimate: 200,
    lease_duration: "12 months",
    availability_date: "2026-08-01",
    created_at: "2026-07-01T08:00:00.000Z",
    metadata: { source: "seed" },
    images: [
      { id: "image-1", public_url: "https://example.com/one.webp", sort_order: 0 },
      { id: "image-2", public_url: "https://example.com/two.webp", sort_order: 1 },
    ],
  };
}

describe("GET /api/listings/[id] not-found and payload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    allowRateLimit();
  });

  it("returns HTTP 404 when the id is unknown or unpublished", async () => {
    mocks.getPublishedListingApiPayload.mockResolvedValue({ error: "not_found" });

    const response = await GET(makeRequest(UNKNOWN_ID), makeParams(UNKNOWN_ID));

    expect(response.status).toBe(404);
    expect(mocks.getPublishedListingApiPayload).toHaveBeenCalledWith(UNKNOWN_ID);

    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("not_found");
  });

  it("returns HTTP 400 when the id is not a valid uuid without querying the payload", async () => {
    const response = await GET(makeRequest("not-a-uuid"), makeParams("not-a-uuid"));

    expect(response.status).toBe(400);
    expect(mocks.getPublishedListingApiPayload).not.toHaveBeenCalled();

    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("validation_failed");
  });

  it("returns the full detail payload in a single response for a known published id", async () => {
    const detail = fullDetail(KNOWN_ID);
    mocks.getPublishedListingApiPayload.mockResolvedValue({ listing: detail, imagesLoaded: true });

    const response = await GET(makeRequest(KNOWN_ID), makeParams(KNOWN_ID));

    expect(response.status).toBe(200);
    expect(mocks.getPublishedListingApiPayload).toHaveBeenCalledTimes(1);
    expect(mocks.getPublishedListingApiPayload).toHaveBeenCalledWith(KNOWN_ID);

    const body = await response.json();
    expect(body.ok).toBe(true);
    // The complete detail payload is returned in this single response.
    expect(body.data).toEqual(detail);
    expect(body.data.images).toHaveLength(2);
  });
});
