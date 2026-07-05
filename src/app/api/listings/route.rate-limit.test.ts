import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  consumeRateLimit: vi.fn(),
  getClientIp: vi.fn(() => "203.0.113.7"),
  getListingsInViewport: vi.fn(),
  parseBbox: vi.fn(),
  getPublishedListingApiPayload: vi.fn(),
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib/rate-limit", () => ({
  consumeRateLimit: (options: unknown) => mocks.consumeRateLimit(options),
  getClientIp: (request: Request) => mocks.getClientIp(request),
}));

vi.mock("@/features/listings/api", () => ({
  getListingsInViewport: (...args: unknown[]) => mocks.getListingsInViewport(...args),
  parseBbox: (...args: unknown[]) => mocks.parseBbox(...args),
  getPublishedListingApiPayload: (...args: unknown[]) => mocks.getPublishedListingApiPayload(...args),
}));

vi.mock("@/lib/logger", () => ({
  logger: mocks.logger,
}));

import { GET as getListings } from "./route";
import { GET as getListingDetail } from "./[id]/route";

const LISTING_ID = "11111111-1111-4111-8111-111111111111";

/**
 * A rate limiter result that reports the ceiling has been exceeded, mirroring
 * the shape returned by `consumeRateLimit` (`@upstash/ratelimit`).
 */
function limitExceededResult() {
  return {
    success: false,
    limit: 120,
    remaining: 0,
    // 45s until the window resets → Retry-After should be ~45.
    reset: Date.now() + 45_000,
    pending: Promise.resolve(),
  };
}

function withinLimitResult() {
  return {
    success: true,
    limit: 120,
    remaining: 119,
    reset: Date.now() + 60_000,
    pending: Promise.resolve(),
  };
}

describe("rate limiting on the discovery API routes (Requirements 14.1, 14.2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getClientIp.mockReturnValue("203.0.113.7");
  });

  describe("GET /api/listings", () => {
    it("returns 429 with Retry-After and X-RateLimit headers once the 120/min ceiling is exceeded", async () => {
      mocks.consumeRateLimit.mockResolvedValue(limitExceededResult());

      const request = new Request(
        "https://roomza.test/api/listings?bbox=18.1,-34.2,18.6,-33.8",
      );
      const response = await getListings(request);

      expect(response.status).toBe(429);
      expect(response.headers.get("Retry-After")).toBeTruthy();
      expect(Number(response.headers.get("Retry-After"))).toBeGreaterThanOrEqual(1);
      expect(response.headers.get("X-RateLimit-Limit")).toBe("120");
      expect(response.headers.get("X-RateLimit-Remaining")).toBe("0");

      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe("rate_limited");

      // The rate limiter short-circuits before the query layer is touched.
      expect(mocks.getListingsInViewport).not.toHaveBeenCalled();
    });

    it("uses a 120-request-per-1-minute window keyed by client IP", async () => {
      mocks.consumeRateLimit.mockResolvedValue(limitExceededResult());

      await getListings(new Request("https://roomza.test/api/listings?bbox=18.1,-34.2,18.6,-33.8"));

      expect(mocks.consumeRateLimit).toHaveBeenCalledWith(
        expect.objectContaining({ key: "listings:203.0.113.7", requests: 120, window: "1 m" }),
      );
    });

    it("passes a within-limit request through to the query layer", async () => {
      mocks.consumeRateLimit.mockResolvedValue(withinLimitResult());
      mocks.parseBbox.mockReturnValue({ bbox: { west: 18.1, south: -34.2, east: 18.6, north: -33.8 } });
      mocks.getListingsInViewport.mockResolvedValue({ listings: [] });

      const response = await getListings(
        new Request("https://roomza.test/api/listings?bbox=18.1,-34.2,18.6,-33.8"),
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("X-RateLimit-Limit")).toBeNull();
      expect(mocks.getListingsInViewport).toHaveBeenCalledTimes(1);
    });
  });

  describe("GET /api/listings/[id]", () => {
    const params = Promise.resolve({ id: LISTING_ID });

    it("returns 429 with Retry-After and X-RateLimit headers once the 120/min ceiling is exceeded", async () => {
      mocks.consumeRateLimit.mockResolvedValue(limitExceededResult());

      const request = new Request(`https://roomza.test/api/listings/${LISTING_ID}`);
      const response = await getListingDetail(request, { params });

      expect(response.status).toBe(429);
      expect(response.headers.get("Retry-After")).toBeTruthy();
      expect(Number(response.headers.get("Retry-After"))).toBeGreaterThanOrEqual(1);
      expect(response.headers.get("X-RateLimit-Limit")).toBe("120");
      expect(response.headers.get("X-RateLimit-Remaining")).toBe("0");

      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe("rate_limited");

      expect(mocks.getPublishedListingApiPayload).not.toHaveBeenCalled();
    });

    it("uses a 120-request-per-1-minute window keyed by client IP", async () => {
      mocks.consumeRateLimit.mockResolvedValue(limitExceededResult());

      await getListingDetail(new Request(`https://roomza.test/api/listings/${LISTING_ID}`), { params });

      expect(mocks.consumeRateLimit).toHaveBeenCalledWith(
        expect.objectContaining({ key: "listing-detail:203.0.113.7", requests: 120, window: "1 m" }),
      );
    });

    it("passes a within-limit request through to the query layer", async () => {
      mocks.consumeRateLimit.mockResolvedValue(withinLimitResult());
      mocks.getPublishedListingApiPayload.mockResolvedValue({
        listing: { id: LISTING_ID },
        imagesLoaded: true,
      });

      const response = await getListingDetail(
        new Request(`https://roomza.test/api/listings/${LISTING_ID}`),
        { params: Promise.resolve({ id: LISTING_ID }) },
      );

      expect(response.status).toBe(200);
      expect(mocks.getPublishedListingApiPayload).toHaveBeenCalledTimes(1);
    });
  });
});
