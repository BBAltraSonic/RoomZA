import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => mocks.createClient(),
}));

import { getListingsInViewport, parseBbox } from "./api";

describe("parseBbox", () => {
  it("accepts a valid west,south,east,north bbox", () => {
    expect(parseBbox("18.1,-34.2,18.6,-33.8")).toEqual({
      bbox: { west: 18.1, south: -34.2, east: 18.6, north: -33.8 },
    });
  });

  it("rejects missing, malformed, and out-of-range bbox values", () => {
    expect(parseBbox(null)).toEqual({ error: "Missing bbox query parameter." });
    expect(parseBbox("18,not-a-number,19,20")).toEqual({
      error: "bbox must be four comma-separated numbers: west,south,east,north.",
    });
    expect(parseBbox("181,-34,18,-33")).toEqual({
      error: "bbox longitude values must be between -180 and 180.",
    });
    expect(parseBbox("18,-91,19,-33")).toEqual({
      error: "bbox latitude values must be between -90 and 90.",
    });
  });
});

describe("getListingsInViewport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("queries the filtered viewport RPC and maps listing rows", async () => {
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
          thumbnail_url: "https://example.com/thumb.webp",
          created_at: "2026-07-01T08:00:00.000Z",
          availability_date: "2026-08-01",
          property_type: "apartment",
        },
      ],
      error: null,
    }));
    mocks.createClient.mockResolvedValue({ rpc });

    const result = await getListingsInViewport(
      { west: 28, south: -26.3, east: 28.2, north: -26.1 },
      {
        q: "Braam",
        minPrice: 6000,
        maxPrice: 9000,
        beds: 1,
        baths: 1,
        type: "apartment",
      },
    );

    expect(rpc).toHaveBeenCalledWith("get_published_listings_in_bbox_with_query", {
      west: 28,
      south: -26.3,
      east: 28.2,
      north: -26.1,
      search_query: "Braam",
      min_price: 6000,
      max_price: 9000,
      min_beds: 1,
      min_baths: 1,
      property_type_filter: "apartment",
    });
    expect(result).toEqual({
      listings: [
        {
          id: "listing-1",
          title: "Braam Studio",
          area: "Braamfontein",
          price: 7200,
          latitude: -26.193,
          longitude: 28.0341,
          bedrooms: 1,
          bathrooms: 1,
          imageUrls: ["https://example.com/thumb.webp"],
          availabilityDate: "2026-08-01",
          propertyType: "apartment",
          created_at: "2026-07-01T08:00:00.000Z",
          agent: null,
        },
      ],
    });
  });

  it("falls back to a bounded table query and records a missing spatial index condition", async () => {
    const rpc = vi.fn(async () => ({
      data: null,
      error: {
        code: "P0002",
        message: "Required spatial index public.listings_location_gix is missing",
      },
    }));

    type FallbackQuery = {
      select: ReturnType<typeof vi.fn>;
      eq: ReturnType<typeof vi.fn>;
      gte: ReturnType<typeof vi.fn>;
      lte: ReturnType<typeof vi.fn>;
      order: ReturnType<typeof vi.fn>;
    };
    const query = {} as FallbackQuery;
    query.select = vi.fn(() => query);
    query.eq = vi.fn(() => query);
    query.gte = vi.fn(() => query);
    query.lte = vi.fn(() => query);
    query.order = vi.fn(async () => ({
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
          landlord: {
            id: "landlord-1",
            full_name: "A Landlord",
            avatar_url: null,
            phone_verified: true,
          },
        },
        {
          id: "listing-2",
          title: "Ignored House",
          address: "Melville",
          price: 12000,
          latitude: "-26.1700",
          longitude: "28.0000",
          bedrooms: "3",
          bathrooms: "2",
          created_at: "2026-07-01T07:00:00.000Z",
          availability_date: "2026-08-01",
          property_type: "house",
          listing_images: [],
          landlord: null,
        },
      ],
      error: null,
    }));
    const from = vi.fn(() => query);
    mocks.createClient.mockResolvedValue({ rpc, from });

    const result = await getListingsInViewport(
      { west: 28, south: -26.3, east: 28.2, north: -26.1 },
      {
        q: "Braam",
        minPrice: 6000,
        maxPrice: 9000,
        beds: 1,
        baths: 1,
        type: "apartment",
      },
    );

    expect(from).toHaveBeenCalledWith("listings");
    expect(query.gte).toHaveBeenCalledWith("longitude", 28);
    expect(query.lte).toHaveBeenCalledWith("longitude", 28.2);
    expect(query.gte).toHaveBeenCalledWith("latitude", -26.3);
    expect(query.lte).toHaveBeenCalledWith("latitude", -26.1);
    expect(result).toEqual({
      missingSpatialIndex: true,
      listings: [
        {
          id: "listing-1",
          title: "Braam Studio",
          area: "Braamfontein",
          price: 7200,
          latitude: -26.193,
          longitude: 28.0341,
          bedrooms: 1,
          bathrooms: 1,
          imageUrls: ["https://example.com/thumb.webp"],
          availabilityDate: "2026-08-01",
          propertyType: "apartment",
          created_at: "2026-07-01T08:00:00.000Z",
          agent: {
            id: "landlord-1",
            name: "A Landlord",
            avatarUrl: undefined,
            isVerified: true,
          },
        },
      ],
    });
  });

  it("omits invalid numeric filters before calling the RPC", async () => {
    const rpc = vi.fn(async () => ({ data: [], error: null }));
    mocks.createClient.mockResolvedValue({ rpc });

    await getListingsInViewport(
      { west: 28, south: -26.3, east: 28.2, north: -26.1 },
      { minPrice: Number.NaN, maxPrice: Number.NaN, beds: Number.NaN, baths: Number.NaN },
    );

    expect(rpc).toHaveBeenCalledWith(
      "get_published_listings_in_bbox_with_query",
      expect.objectContaining({
        min_price: undefined,
        max_price: undefined,
        min_beds: undefined,
        min_baths: undefined,
      }),
    );
  });
});
