// Feature: discovery-page-experience, Task 9.2
// Spatial viewport query + bounded fallback path.
// Validates: Requirements 3.1, 3.2, 3.5, 3.6 (example-based unit tests).
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  consumeRateLimit: vi.fn(),
  getClientIp: vi.fn(() => "test-ip"),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => mocks.createClient(),
}));

vi.mock("@/lib/rate-limit", () => ({
  consumeRateLimit: (...args: unknown[]) => mocks.consumeRateLimit(...args),
  getClientIp: (...args: unknown[]) => mocks.getClientIp(...args),
}));

// Keep logger output quiet while still exercising the real error/warn paths.
vi.mock("@/lib/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), fatal: vi.fn() },
}));

import { getListingsInViewport } from "./api";
import { GET } from "@/app/api/listings/route";

const BBOX = { west: 28, south: -26.3, east: 28.2, north: -26.1 } as const;
const NO_FILTERS = {};

/**
 * Builds a fallback-table query stub whose terminal `.order(...)` resolves to
 * the supplied rows/error. Records every filter call so tests can assert the
 * published-only constraint and the bbox bounds.
 */
function makeFallbackQuery(result: { data: unknown[] | null; error: unknown }) {
  const calls: Record<string, unknown[][]> = { select: [], eq: [], gte: [], lte: [], order: [] };
  const query: Record<string, unknown> = {};
  const chain = (name: string) =>
    vi.fn((...args: unknown[]) => {
      calls[name]?.push(args);
      return query;
    });
  query.select = chain("select");
  query.eq = chain("eq");
  query.gte = chain("gte");
  query.lte = chain("lte");
  query.order = vi.fn((...args: unknown[]) => {
    calls.order?.push(args);
    return Promise.resolve(result);
  });
  return { query, calls };
}

describe("getListingsInViewport — single spatial query (Req 3.1, 3.5)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls the single published spatial RPC and returns all card/marker fields with no per-listing query", async () => {
    const rpc = vi.fn(async () => ({
      data: [
        {
          id: "listing-1",
          title: "Braam Studio",
          address: "Braamfontein",
          price: 7200,
          latitude: "-26.1930",
          longitude: "28.0341",
          bedrooms: "1",
          bathrooms: "1",
          image_urls: ["https://example.com/a.webp", "https://example.com/b.webp"],
          availability_date: "2026-08-01",
          property_type: "apartment",
          created_at: "2026-07-01T08:00:00.000Z",
        },
      ],
      error: null,
    }));
    const from = vi.fn();
    mocks.createClient.mockResolvedValue({ rpc, from });

    const result = await getListingsInViewport(BBOX, NO_FILTERS);

    // Exactly one spatial query, and it is the published-scoped RPC (Req 3.1, 3.5).
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("get_published_listings_in_bbox_with_query", expect.objectContaining(BBOX));

    // No separate per-listing table query was issued (Req 3.1 — no N+1).
    expect(from).not.toHaveBeenCalled();

    // The single response carries every card/marker field the view models need.
    expect("listings" in result).toBe(true);
    if ("listings" in result) {
      expect(result.listings).toEqual([
        {
          id: "listing-1",
          title: "Braam Studio",
          area: "Braamfontein",
          price: 7200,
          latitude: -26.193,
          longitude: 28.0341,
          bedrooms: 1,
          bathrooms: 1,
          imageUrls: ["https://example.com/a.webp", "https://example.com/b.webp"],
          availabilityDate: "2026-08-01",
          propertyType: "apartment",
          created_at: "2026-07-01T08:00:00.000Z",
          agent: null,
        },
      ]);
      // The RPC path does not set the fallback marker.
      expect("missingSpatialIndex" in result).toBe(false);
    }
  });
});

describe("getListingsInViewport — bounded fallback (Req 3.2, 3.5)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("routes a missing-spatial-index error to the published, bbox-bounded fallback and records the fallback path", async () => {
    const rpc = vi.fn(async () => ({
      data: null,
      error: {
        code: "P0002",
        message: "Required spatial index public.listings_location_gix is missing",
      },
    }));
    const { query, calls } = makeFallbackQuery({
      data: [
        {
          id: "listing-1",
          title: "Braam Studio",
          address: "Braamfontein",
          price: 7200,
          latitude: "-26.1930",
          longitude: "28.0341",
          bedrooms: "1",
          bathrooms: "1",
          created_at: "2026-07-01T08:00:00.000Z",
          availability_date: "2026-08-01",
          property_type: "apartment",
          listing_images: [{ public_url: "https://example.com/thumb.webp", sort_order: 0 }],
          landlord: null,
        },
      ],
      error: null,
    });
    const from = vi.fn(() => query);
    mocks.createClient.mockResolvedValue({ rpc, from });

    const result = await getListingsInViewport(BBOX, NO_FILTERS);

    // Fallback targets the listings table, published-only, bounded to the bbox.
    expect(from).toHaveBeenCalledWith("listings");
    expect(calls.eq).toContainEqual(["status", "published"]);
    expect(calls.gte).toContainEqual(["longitude", 28]);
    expect(calls.lte).toContainEqual(["longitude", 28.2]);
    expect(calls.gte).toContainEqual(["latitude", -26.3]);
    expect(calls.lte).toContainEqual(["latitude", -26.1]);

    // The fallback path is recorded so the route can log it (Req 3.2).
    expect("missingSpatialIndex" in result && result.missingSpatialIndex).toBe(true);
    if ("listings" in result) {
      expect(result.listings).toHaveLength(1);
      expect(result.listings[0]?.id).toBe("listing-1");
      expect(result.listings[0]?.imageUrls).toEqual(["https://example.com/thumb.webp"]);
    }
  });

  it("caps the fallback result to 250 listings", async () => {
    const rpc = vi.fn(async () => ({
      data: null,
      error: { code: "P0002", message: "spatial index missing: listings_location_gix" },
    }));
    // 300 published rows inside the bbox that pass the (empty) filter set.
    const rows = Array.from({ length: 300 }, (_, index) => ({
      id: `listing-${index}`,
      title: `Home ${index}`,
      address: "Somewhere",
      price: 5000 + index,
      latitude: "-26.2",
      longitude: "28.1",
      bedrooms: "2",
      bathrooms: "1",
      created_at: `2026-07-01T00:00:00.000Z`,
      availability_date: "2026-08-01",
      property_type: "apartment",
      listing_images: [],
      landlord: null,
    }));
    const { query } = makeFallbackQuery({ data: rows, error: null });
    const from = vi.fn(() => query);
    mocks.createClient.mockResolvedValue({ rpc, from });

    const result = await getListingsInViewport(BBOX, NO_FILTERS);

    expect("listings" in result).toBe(true);
    if ("listings" in result) {
      expect(result.listings).toHaveLength(250);
      // The cap preserves the leading rows in query order.
      expect(result.listings[0]?.id).toBe("listing-0");
      expect(result.listings[249]?.id).toBe("listing-249");
    }
    expect("missingSpatialIndex" in result && result.missingSpatialIndex).toBe(true);
  });
});

describe("getListingsInViewport — non-index failure (Req 3.6)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the error shape (not the fallback) when the spatial query fails for a non-index reason", async () => {
    const dbError = { code: "57014", message: "canceling statement due to statement timeout" };
    const rpc = vi.fn(async () => ({ data: null, error: dbError }));
    const from = vi.fn();
    mocks.createClient.mockResolvedValue({ rpc, from });

    const result = await getListingsInViewport(BBOX, NO_FILTERS);

    // A non-index failure must NOT trigger the fallback table query.
    expect(from).not.toHaveBeenCalled();
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toEqual(dbError);
    }
  });
});

describe("Listings_API route — non-index failure surfaces 500 with correlation requestId (Req 3.6)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.consumeRateLimit.mockResolvedValue({
      success: true,
      limit: 120,
      remaining: 119,
      reset: Date.now() + 60_000,
      pending: Promise.resolve(),
    });
  });

  it("returns HTTP 500 and echoes the request id when the spatial query fails for a non-index reason", async () => {
    const rpc = vi.fn(async () => ({
      data: null,
      error: { code: "57014", message: "canceling statement due to statement timeout" },
    }));
    const from = vi.fn();
    mocks.createClient.mockResolvedValue({ rpc, from });

    const request = new Request("https://roomza.test/api/listings?bbox=28,-26.3,28.2,-26.1", {
      headers: { "x-request-id": "req-correlation-123" },
    });

    const response = await GET(request);
    const body = (await response.json()) as {
      ok: boolean;
      error: { code: string; message: string };
      requestId: string;
    };

    expect(response.status).toBe(500);
    expect(from).not.toHaveBeenCalled();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("server_error");
    // Correlation id flows through the body and the response header (Req 3.6).
    expect(body.requestId).toBe("req-correlation-123");
    expect(response.headers.get("x-request-id")).toBe("req-correlation-123");
  });
});
